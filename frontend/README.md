# Orbit frontend

Next.js 16 frontend for Orbit. It runs on port 3090 and proxies `/api/*` to the internal Orbit API in Docker. Read [`../AGENTS.md`](../AGENTS.md) and [`AGENTS.md`](./AGENTS.md) before changing it.

## Local setup

```bash
npm ci
npm run dev
```

Open `http://localhost:3090`. Configure the API origin through the repository's existing environment/compose model; do not add a parallel hard-coded backend URL.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm audit --omit=dev
```

Prefer TDD for client session handling and behavior regressions. The session tests cover single-flight refresh, persisted rotating tokens, invalid-session clearing, and retry behavior. Add focused behavior tests instead of asserting implementation details.

## Deployment

The production path is the non-root Docker image orchestrated by `../docker-compose.coolify.yml`, not Vercel starter deployment. Coolify exposes the frontend and keeps API/PostgreSQL/MinIO internal. After deployment verify the deployed SHA, the frontend root, API `/health`, and the affected login/refresh/profile/logout flow.
