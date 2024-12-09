export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const allowedDomains = [
      'agentornot.com',
      'www.agentornot.com',
      'localhost:8787',
    ];
    const requestHost = new URL(request.url).host;

    // Check if request is from allowed domain
    if (!allowedDomains.includes(requestHost)) {
      return new Response('Unauthorized', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // Common headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': `https://${requestHost}`, // Only allow specific domain
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Handle GET requests for static files
    if (request.method === 'GET') {
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const object = await env.BUCKET.get('index.html');
        if (object === null) {
          return new Response('Not Found', {
            status: 404,
            headers: corsHeaders,
          });
        }

        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('content-type', 'text/html;charset=UTF-8');

        return new Response(object.body, {
          headers,
        });
      }

      // Handle favicon specifically
      if (url.pathname === '/favicon.png') {
        const object = await env.BUCKET.get('favicon.png');
        if (object === null) {
          return new Response('Not Found', {
            status: 404,
            headers: corsHeaders,
          });
        }

        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('content-type', 'image/png');
        headers.set('cache-control', 'public, max-age=31536000'); // Cache for 1 year

        return new Response(object.body, {
          headers,
        });
      }

      // Handle other static files if needed
      const object = await env.BUCKET.get(url.pathname.slice(1));
      if (object === null) {
        return new Response('Not Found', {
          status: 404,
          headers: corsHeaders,
        });
      }

      const headers = new Headers(corsHeaders);
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);

      return new Response(object.body, {
        headers,
      });
    }

    // Handle POST requests for API endpoints
    if (request.method === 'POST' && url.pathname === '/analyze') {
      try {
        const formData = await request.formData();
        let productIdea = formData.get('productIdea');

        if (!productIdea) {
          throw new Error('Product idea is required');
        }

        // Limit product idea to 1000 characters
        if (productIdea.length > 1000) {
          productIdea = productIdea.slice(0, 1000) + '... (truncated)';
        }

        const jsonStructure = {
          factors: {
            autonomy: { score: 0, explanation: '' },
            goalOriented: { score: 0, explanation: '' },
            persistence: { score: 0, explanation: '' },
            adaptability: { score: 0, explanation: '' },
          },
          overall: { score: 0, explanation: '' },
        };

        const promptTemplate = `
          You are an expert in AI agents. Analyze the following product idea and provide a JSON response.
          Be brutally honest and critic with the scores and explanation.
          Remove the jargon buzzwords and analyse the underlying idea only.
          Your response must strictly follow this format (replace values only):
          ${JSON.stringify(jsonStructure, null, 2)}

          Rules:
          - Scores must be integers between 0 and 100
          - Explanations must be clear and concise
          - Do not add any additional fields
          - Response must be valid JSON
        `;

        // Initialize results
        let gpt4Analysis = null;
        let claudeAnalysis = null;
        let errors = [];

        function validateAnalysis(analysis) {
          // Check if it's valid JSON
          let parsed;
          try {
            parsed =
              typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
          } catch (e) {
            throw new Error('Invalid JSON response');
          }

          // Validate structure matches expected format
          const validate = (obj, template) => {
            for (const key in template) {
              if (!(key in obj)) throw new Error(`Missing field: ${key}`);
              if (typeof obj[key] !== typeof template[key])
                throw new Error(`Invalid type for field: ${key}`);
              if (typeof obj[key] === 'object')
                validate(obj[key], template[key]);
            }
            // Check scores are valid
            if (
              'score' in obj &&
              (obj.score < 0 || obj.score > 100 || !Number.isInteger(obj.score))
            )
              throw new Error('Score must be an integer between 0 and 100');
          };

          validate(parsed, jsonStructure);
          return parsed;
        }

        // GPT-4 Analysis
        try {
          const gpt4Response = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                max_tokens: 1000,
                response_format: { type: 'json_object' },
                messages: [
                  {
                    role: 'system',
                    content: promptTemplate,
                  },
                  {
                    role: 'user',
                    content: productIdea,
                  },
                ],
              }),
            }
          );

          if (!gpt4Response.ok) {
            throw new Error(`GPT-4 API error: ${gpt4Response.status}`);
          }

          const gpt4Data = await gpt4Response.json();
          gpt4Analysis = validateAnalysis(gpt4Data.choices[0].message.content);
        } catch (error) {
          console.error('GPT-4 Error:', error);
          errors.push(`GPT-4: ${error.message}`);
        }

        // Claude Analysis
        try {
          const claudeResponse = await fetch(
            'https://api.anthropic.com/v1/messages',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000,
                messages: [
                  {
                    role: 'user',
                    content: `${promptTemplate}\n\nProduct idea: ${productIdea}`,
                  },
                ],
              }),
            }
          );

          if (!claudeResponse.ok) {
            throw new Error(`Claude API error: ${claudeResponse.status}`);
          }

          const claudeData = await claudeResponse.json();
          claudeAnalysis = validateAnalysis(claudeData.content[0].text);
        } catch (error) {
          console.error('Claude Error:', error);
          errors.push(`Claude: ${error.message}`);
        }

        // If both services failed, throw error
        if (!gpt4Analysis && !claudeAnalysis) {
          throw new Error(`All services failed: ${errors.join('; ')}`);
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              gpt4Analysis,
              claudeAnalysis,
              errors: errors.length > 0 ? errors : undefined,
            },
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        console.error('Error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || 'Something went wrong',
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Return 405 for any other methods or paths
    return new Response('Method not allowed', {
      status: 405,
      headers: {
        ...corsHeaders,
        Allow: 'GET, POST, OPTIONS',
      },
    });
  },
};
