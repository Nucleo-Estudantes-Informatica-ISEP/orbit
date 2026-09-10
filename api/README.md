# Orbit API

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master
[circleci-url]: https://circleci.com/gh/nestjs/nest

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
- Refresh sessions expire after 30 days. Their opaque tokens rotate on every use, live only in an `HttpOnly`, `SameSite=Strict` cookie, and are stored server-side only as keyed fingerprints.
- Refresh reloads the member's current profile and permissions from the database.
- Guards accept only access JWTs as bearer credentials; refresh values are not JWTs.
- Mutation/audit actor identity is always derived from the authenticated JWT; request DTOs must not accept actor IDs.
- `/auth/me` permits only the documented self-service profile fields. Password changes verify the current password and revoke every refresh session for that member.

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
