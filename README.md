# Agent or Not!

A tool to analyze how "agentic" your AI product really is. Uses GPT-4 and Claude to provide honest scores on autonomy, goal-oriented behavior, persistence, and adaptability.

## Description

Tired of every AI product calling itself an "agent"? This tool helps you analyze how truly agentic your AI product idea is by:
- Scoring key agent characteristics (autonomy, goal-oriented behavior, persistence, adaptability)
- Getting brutally honest feedback from both GPT-4 and Claude
- Providing detailed explanations for each score
- Showing an overall "agenticity" score

## Deployment

### Prerequisites
1. Cloudflare account
2. OpenAI API key (GPT-4 access required)
3. Anthropic API key (Claude access required)
4. Node.js and npm installed
5. Wrangler CLI installed (`npm install -g wrangler`)

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/agent-or-not.git
   cd agent-or-not
   ```

2. Create an R2 bucket in Cloudflare dashboard named `agent-or-not`

3. Copy wrangler.toml.example to wrangler.toml:
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

4. Update the API keys in wrangler.toml:
   ```toml
   [vars]
   OPENAI_API_KEY = "your-openai-api-key"
   CLAUDE_API_KEY = "your-claude-api-key"
   ```

5. Login to Cloudflare using Wrangler:
   ```bash
   wrangler login
   ```

6. Deploy the static assets to R2:
   ```bash
   npm run deploy:html
   ```

7. Deploy the worker:
   ```bash
   npm run deploy:worker
   ```

### Development

1. Run local development server:
   ```bash
   npm run dev
   ```

2. The server will be available at `http://localhost:8787`

### Custom Domain Setup

1. Add your domain in Cloudflare dashboard
2. Update wrangler.toml with your domain:
   ```toml
   [[routes]]
   pattern = "yourdomain.com"
   custom_domain = true
   ```

3. Deploy again:
   ```bash
   npm run deploy
   ```

## Environment Variables

Required environment variables in wrangler.toml:
- `OPENAI_API_KEY`: Your OpenAI API key with GPT-4 access
- `CLAUDE_API_KEY`: Your Anthropic API key for Claude access

## License

MIT License

## Author

Shyjal





