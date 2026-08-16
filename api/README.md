# Orbit API

NestJS 11 API for Orbit, backed by PostgreSQL/Prisma and MinIO. Repository-wide workflow and verification rules live in [`../AGENTS.md`](../AGENTS.md).

## Local setup

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Provide the variables documented by the root compose/configuration, including `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, MinIO settings, and SMTP settings when mail is exercised. Never use production credentials locally or commit them.

## Authentication contract

- Access tokens expire after 15 minutes and contain an access-token type claim.
- Refresh tokens expire after 7 days, contain a refresh-token type claim, and rotate both tokens.
- Refresh reloads the member's current profile and permissions from the database.
- Guards reject token-type confusion.
- Mutation/audit actor identity is always derived from the authenticated JWT; request DTOs must not accept actor IDs.
- `/auth/me` permits only the documented self-service profile fields. Password changes verify the current password.

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

Prefer TDD for DTO validation, permissions, session behavior, and regressions. Contract changes require a focused test and `npm run openapi:generate`; CI rejects drift.

## Production

Production uses the repository's Dockerfile and `../docker-compose.coolify.yml`. The image runs as `node`. The separate `migrator` service applies `prisma migrate deploy` and must complete before the API starts. The health endpoint is `GET /health`; it is intentionally public but must not expose secrets.

Do not run migrations inside the API start command, use the retired Nest starter/Mau deployment instructions, or claim deployment from a local build alone.
