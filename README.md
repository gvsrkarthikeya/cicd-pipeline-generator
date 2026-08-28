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