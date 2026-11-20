# Orbit API

NestJS 11 API for Orbit, backed by PostgreSQL/Prisma and private S3-compatible storage. Repository-wide workflow and verification rules live in [`../AGENTS.md`](../AGENTS.md).

External access lifecycle routes live under `/access-lifecycle`. See [configuration and operations](../docs/access-lifecycle.md) for independent Google Forms responses and manual Sheets intake, scoped permissions, immutable approvals, provider credentials, dry-run execution and manual evidence. `ACCESS_FORMS_ID` enables direct read-only Forms API access; `ACCESS_SHEETS_ID`/`ACCESS_SHEETS_RANGE` keep the independent manual registry available. Both origins support onboarding/offboarding and preserve their provenance. Initialize editable resource/policy defaults with `npm run access:seed` after migrations; the production image supports `node dist/prisma/seed.access.js`. Unconfigured destinations retain visible manual instructions. Discord/GitHub usernames and Google emails are resolved and verified by Orbit. The executor is disabled unless `ACCESS_EXECUTOR_ENABLED=true`, and remains read-only until `ACCESS_EXECUTOR_DRY_RUN=false`.

## Local setup

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Provide the variables documented by the root compose/configuration, including `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `CORS_ORIGIN`, MinIO settings, and SMTP settings when mail is exercised. Never use production credentials locally or commit them.

## Authentication contract

- Access JWTs expire after 15 minutes. The API checks the issuer, audience, token type, active session and current local permissions.
- Refresh sessions expire after 30 days. Opaque refresh tokens rotate on every use, live in a strict HTTP-only cookie and are stored server-side as keyed fingerprints. The current browser session keeps its access token in memory.
- Logout, password changes and credential administration revoke affected sessions. Password reset consumes its token atomically. Active new accounts receive a one-time link to choose a password.
- Production requires separate signing and token-fingerprint keys of at least 32 bytes and encrypted, authenticated SMTP. Configure `CORS_ORIGIN` with the browser origins.
- Authentication and recovery routes check browser origin and limit requests per API instance. Leave `AUTH_TRUST_PROXY_HOPS` at zero unless the configured proxy chain is the only way to reach the API. Apply shared throttling at the ingress for replicated deployments.
- Requests to assign roles or change credentials require the respective `ROLES_ASSIGN` or `USERS_MANAGE_CREDENTIALS` permission. An administrator cannot delegate permissions they lack.
- The server records authoritative audit events. The public audit API exposes read access.

## Contract and tests

Swagger UI is served at `/docs`, raw JSON at `/openapi.json`, and the checked-in deterministic contract is `openapi/openapi.json`.

```bash
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npm run openapi:check
npm audit --omit=dev
```

The lockfile resolves `proxy-addr` to 2.0.8 to fix
[GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
After dependency updates, run `npm audit --omit=dev --audit-level=high`
to reproduce the CI security gate.


Prefer TDD for DTO validation, permissions, session behavior, and regressions. Contract changes require a focused test and `npm run openapi:generate`; CI rejects drift.

## Production

Production uses the repository's Dockerfile and `../docker-compose.coolify.yml`. The image runs as `node`. The separate `migrator` service applies `prisma migrate deploy` and must complete before the API starts. The health endpoint is `GET /health`; it is intentionally public but must not expose secrets.

Do not run migrations inside the API start command, use the retired Nest starter/Mau deployment instructions, or claim deployment from a local build alone.
