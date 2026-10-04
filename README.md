# cicd-pipeline-generator

Scaffold for a CI/CD pipeline generator with three parts:

- `frontend/` React app built with Vite
- `backend/` Express API plus shared core engine
- `mcp-server/` MCP server with one tool per file

## Layout

```text
cicd-pipeline-generator/
├── frontend/
├── backend/
├── mcp-server/
├── .env.example
├── .gitignore
└── README.md
```

## Run

Install dependencies inside each package directory:

```bash
cd frontend && npm install
cd ../backend && npm install
cd ../mcp-server && npm install
```

Start each service from its own folder:

```bash
cd frontend && npm run dev
cd backend && node src/app.js
cd mcp-server && npm start
```

The backend exposes `GET /health` for a quick readiness check.

## Testing

### Backend health check

From the backend folder:

```bash
cd backend
node src/app.js
curl http://localhost:8000/health
```

If the app is running, the endpoint should respond successfully.

### MCP server smoke test

The MCP server uses stdio transport and exposes tools such as `analyze_repo`, `generate_pipeline`, `customize_pipeline`, `explain_decision`, and `suggest_optimizations`.

Run the built-in client:

```bash
cd mcp-server
npm install
node src/test-client.js
```

This script connects to the server and invokes the core tools to confirm that the MCP server is working end-to-end.

### MCP Inspector

You can also inspect the MCP server through the official MCP Inspector.

```bash
cd mcp-server
npm install
npx @modelcontextprotocol/inspector
```

In the Inspector UI:

- Transport: `stdio`
- Command: `bash`
- Arguments:

```bash
-lc "cd /Users/karthikeya.gudluru/Downloads/M.Tech/Subjects/Project/project-work/cicd-pipeline-generator/mcp-server && node src/index.js"
```

This ensures the service starts from the `mcp-server` folder, where the project’s MCP entry file exists.

Then connect and test the available tools. For example, try the `analyze_repo` tool with:

```json
{
  "repoUrl": "https://github.com/pallets/flask",
  "branch": "main"
}
```

## Branching Strategy

```text
main
	└── develop
				├── feature/<feature-name1>
				└── feature/<feature-name2>
```

#### Branch Rules

**`main`**

- Always deployable — Render deploys from this
- Never commit directly to main
- Only merged into via pull request from develop
- Represents your live demo URL at all times

**`develop`**

- Your active development branch
- All feature branches merge into here first
- When a milestone is complete and tested, merge develop → main

**`feature/*`**

- One branch per feature or module
- Created from develop, merged back into develop
- Name it after what you're building

#### Commit Message Convention

Use this format:

```text
feat: add <feature-summary>
fix: correct <bug-summary>
docs: update <document-or-section>
test: add <test-coverage-summary>
```