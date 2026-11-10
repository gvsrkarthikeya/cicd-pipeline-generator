# MCP-Based CI/CD Pipeline Generator (PipelineKit)

A tool that analyses a GitHub repository and generates a GitHub Actions workflow for it, and explains every decision it made. It is built as an M.Tech dissertation project (BITS Pilani WILP).

Live application: https://cicd-pipeline-generator.onrender.com (free hosting tier, so the first request after inactivity can take about 30 seconds).

## What it does

Given a repository URL and branch, the tool:

1. Reads the repository's file tree and key files through the GitHub API.
2. Detects the language, framework, test framework, linter, build tool, project type and deployment style.
3. Applies deterministic rules with weighted confidence scores to choose the pipeline steps.
4. Generates a GitHub Actions workflow and validates it by parsing it back.
5. Records a reasoning trail for every decision (signal, rule, inference, confidence, action).
6. Suggests improvements in three categories: performance (caching), quality (linting and tests) and security (pinned actions, scoped permissions, secrets).

The same input always produces the same pipeline and the same reasoning. No AI model or paid API is used.

### Features

- Node.js, Python and Java supported; unknown stacks get a low-confidence generic fallback pipeline.
- Monorepo support: when the root has no recognised stack, sub-folders (depth up to 2, at most 5) are scanned and one job is generated per sub-project.
- Public repositories, and private repositories using a per-repository GitHub token that is verified before it is saved.
- Web application: signup, login, profile and password management, multi-repository dashboard, repository page with Overview, Pipeline, History and Recommendations tabs.
- Pipeline customisation: add, edit and delete steps; apply recommendations with one click.
- History: every generation, customisation and applied recommendation is logged with before and after state, and can be reverted.
- Shareable read-only snapshots of a history entry, viewable without login.
- MCP server exposing five tools for AI-enabled IDEs such as Claude Desktop.

## Architecture

All intelligence lives in a shared core engine (`backend/src/core`). The web backend and the MCP server are thin adapters over it, so a rule change is made once and applies to both.

```text
Web UI (React) ---- REST + JWT ----> Express API ---\
                                                     >--> Core engine --> GitHub API
MCP client (Claude Desktop) -- stdio --> MCP server -/         |
                                                          Supabase (PostgreSQL)
```

Core modules (`backend/src/core`): `analyzer`, `inferenceEngine`, `yamlGenerator`, `explainability`, `recommender`, `applyRecommendation`, `pipelineCustomizer`, `pipelineService`.

## Tech stack

| Layer | Technology |
|---|---|
| Backend and core | Node.js 20+ (ES modules), Express 5 |
| Frontend | React 19, Vite, React Router, Axios, CodeMirror |
| Database | Supabase (PostgreSQL) |
| GitHub access | `@octokit/rest` |
| YAML | `js-yaml` (generated output is parsed back to validate it) |
| Auth | bcrypt password hashes, signed JWT |
| MCP | `@modelcontextprotocol/sdk` (stdio), `zod` |
| Testing | Vitest, Supertest, React Testing Library |
| Hosting | Render (one service serves the API and the built frontend) |

## Layout

```text
cicd-pipeline-generator/
├── frontend/      React app (pages, components, lib, locales)
├── backend/       Express API and shared core engine
│   └── src/       core/, routes/, lib/, middleware/, app.js
├── mcp-server/    MCP server, one tool per file in src/tools/
├── .env.example
└── README.md
```

The MCP server imports the core engine directly from `backend/src/core`, so the backend dependencies must be installed as well.

## Configuration

Create `backend/.env` (it is loaded from the backend working directory):

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` | Supabase project URL and service key |
| `JWT_SECRET` | Secret used to sign login and password-reset tokens |
| `GITHUB_TOKEN` | Optional but recommended: raises the GitHub API limit from 60 to 5,000 requests per hour |
| `PORT` | Server port, default `8000` |
| `NODE_ENV` | Set to `production` to serve the built frontend from the backend |

`.env.example` also lists `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`; these are not used (private repositories use per-repository tokens, not OAuth).

The database has four tables: `users`, `repos`, `pipelines` and `history`, with cascading deletes. Create them in your Supabase project before starting the backend.

## Run locally

Install dependencies inside each package directory:

```bash
cd frontend && npm install
cd ../backend && npm install
cd ../mcp-server && npm install
```

Start the backend and frontend (the frontend calls `http://localhost:8000/api` in development):

```bash
cd backend && npm run dev     # or: npm start
cd frontend && npm run dev
```

Production build, as used on Render:

```bash
cd frontend && npm install && npm run build
cd ../backend && npm install && NODE_ENV=production npm start
```

## MCP server

The server (name `cicd-generator`) runs locally over stdio and exposes five tools:

| Tool | Purpose |
|---|---|
| `analyze_repo` | Detect stack, framework, test and lint tools and deployment style |
| `generate_pipeline` | Generate the GitHub Actions YAML for a repository |
| `explain_decision` | Return the full reasoning trail for the generated pipeline |
| `suggest_optimizations` | Return categorised recommendations |
| `customize_pipeline` | Add, edit or delete a step in a given workflow YAML |

The repository tools take `repoUrl`, an optional `branch` and an optional `githubToken`. If no token is passed, the server uses the `GITHUB_TOKEN` environment variable.

Example Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cicd-generator": {
      "command": "node",
      "args": ["/absolute/path/to/cicd-pipeline-generator/mcp-server/src/index.js"],
      "env": { "GITHUB_TOKEN": "<your token>" }
    }
  }
}
```

## REST API

All routes are JWT-protected except signup, login, forgot and reset password, and the public snapshot.

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password`, `POST /api/auth/forgot-password` (and reset) |
| Repos | `GET /api/repos`, `GET /api/repos/:id`, `POST /api/repos`, `DELETE /api/repos/:id`, `POST /api/repos/verify-token` |
| Pipeline | `POST /api/pipeline/generate`, `GET /api/pipeline/:repoId`, `PUT /api/pipeline/:repoId`, `GET /api/pipeline/:repoId/recommendations`, `POST /api/pipeline/:repoId/apply-recommendation` |
| History | `GET` and `POST /api/history/:repoId`, `POST /api/history/:historyId/share`, `POST /api/history/:historyId/revert` |
| Public | `GET /api/public/pipeline/:shareId` (no login) |

## Known limitations

- Only GitHub Actions is generated, and only Node.js, Python and Java are recognised; Java coverage is shallower (no framework or test-framework detection).
- Framework detection is first-match, so some projects are misread (for example FastAPI as Flask, Next.js as React). A root `package.json` takes precedence over Python manifests.
- Generated workflows always trigger on `main`, whatever the repository's default branch.
- The deployment step is a labelled placeholder; real commands and credentials must be supplied by the user.
- Private-repository tokens are stored in plain text, not encrypted at rest.
- `GET` and `POST /api/history/:repoId` do not check that the repository belongs to the caller.
- Password reset returns the token in the API response instead of e-mailing it (prototype only).
- The generated pipeline has been validated for syntax but not executed on GitHub Actions.

## Testing

The automated suite has 176 tests (132 backend, 44 frontend):

```bash
cd backend && npm test
cd frontend && npm test
```

Route tests use a mocked Supabase, so no network access is needed.

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
-lc "cd /absolute/path/to/cicd-pipeline-generator/mcp-server && node src/index.js"
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