# Orbit frontend

Next.js 16 frontend for Orbit. It runs on port 3090 and proxies `/api/*` to the internal Orbit API in Docker. Read [`../AGENTS.md`](../AGENTS.md) and [`AGENTS.md`](./AGENTS.md) before changing it.

`/dashboard/access` provides external access requests, resource selection, Presidency approval, execution evidence and versioned resource/policy administration. Operators explicitly choose real Forms responses, the independent manual Sheets registry, or manual entry for onboarding/offboarding. Forms is preferred when available; switching origins clears the selected record and operations. For onboarding only, a Forms response without a declared position defaults to Member. Switching to offboarding, an access change or an Alumni transition clears that inferred position; declared positions and the independent Sheets registry retain their existing behavior. Visibility requires `ACCESS_READ`; the API enforces current permissions and department scope independently. Operators enter Discord/GitHub usernames and Google emails; Orbit resolves technical IDs. Department scope limits the people managed, while the full service catalogue supports justified cross-department defaults. Provider credentials stay on the API server. See the [access lifecycle guide](../docs/access-lifecycle.md).

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

The lockfile resolves `proxy-addr` to 2.0.8 to fix
[GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
After dependency updates, run `npm audit --omit=dev --audit-level=critical`
to reproduce the CI security gate.


Prefer TDD for client session handling and behavior regressions. The session tests cover single-flight refresh, persisted rotating tokens, invalid-session clearing, and retry behavior. Add focused behavior tests instead of asserting implementation details.

## Deployment

The production path is the non-root Docker image orchestrated by `../docker-compose.coolify.yml`, not Vercel starter deployment. Coolify exposes the frontend and keeps API/PostgreSQL/MinIO internal. After deployment verify the deployed SHA, the frontend root, API `/health`, and the affected login/refresh/profile/logout flow.
