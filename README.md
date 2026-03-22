# AstroAI

Hosted-ready astrology app with:

- `client/` -> React web app
- `server/` -> Node.js API with MongoDB, SMTP email verification, OpenAI chat, and per-user chat history

## Local development

Install dependencies:

```bash
cd /Users/lakhendrakushwaha/Workspace/CodexProjects/client
npm install

cd /Users/lakhendrakushwaha/Workspace/CodexProjects/server
npm install
```

Run the API:

```bash
cd /Users/lakhendrakushwaha/Workspace/CodexProjects/server
npm run dev
```

Run the client:

```bash
cd /Users/lakhendrakushwaha/Workspace/CodexProjects/client
npm run dev
```

## Environment

- Client env example: `client/.env.example`
- Server env example: `server/.env.example`

## Hosting

For production:

1. Deploy `server/`
2. Set `CLIENT_URL` in the server environment to the hosted frontend URL
3. Set `VITE_API_BASE_URL` in the client environment to the hosted backend API URL, for example:

```env
VITE_API_BASE_URL=https://your-api-domain.com/api
```

4. Build the client:

```bash
cd /Users/lakhendrakushwaha/Workspace/CodexProjects/client
npm run build
```
# AIAstro-Simple
