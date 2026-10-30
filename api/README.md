# Orbit API

NestJS 11 API for Orbit, backed by PostgreSQL/Prisma and MinIO. Repository-wide workflow and verification rules live in [`../AGENTS.md`](../AGENTS.md).

External access lifecycle routes live under `/access-lifecycle`. See [configuration and operations](../docs/access-lifecycle.md) for independent Google Forms responses and manual Sheets intake, scoped permissions, immutable approvals, provider credentials, dry-run execution and manual evidence. `ACCESS_FORMS_ID` enables direct read-only Forms API access; `ACCESS_SHEETS_ID`/`ACCESS_SHEETS_RANGE` keep the independent manual registry available. Both origins support onboarding/offboarding and preserve their provenance. Initialize editable resource/policy defaults with `npm run access:seed` after migrations; the production image supports `node dist/prisma/seed.access.js`. Unconfigured destinations retain visible manual instructions. Discord/GitHub usernames and Google emails are resolved and verified by Orbit. The executor is disabled unless `ACCESS_EXECUTOR_ENABLED=true`, and remains read-only until `ACCESS_EXECUTOR_DRY_RUN=false`. New administrative Discord grants additionally require `ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED=true`; without it, approved grants await manual evidence. This deployment option does not replace independent process approval or bot hierarchy checks. Unresolved username revocations also await manual evidence instead of waiting indefinitely for an account.

Forms searches share a 30-second in-memory cache; request creation revalidates the response directly with Google. Forms Cargo answers are ignored, while the independent manual registry preserves positions. Execution/retry uses the stable Discord/GitHub ID frozen at creation and never resolves an approved username to a different account. Unresolved usernames require manual evidence or a new request; sensitive automatic requests require a stable ID before submission and approval. Descriptive resource edits can proceed during a Discord outage when the destination, provider/type and security flags are unchanged.

Access initialization is atomic: catalogue, ADMIN/bootstrap permissions and its explicit AuditLog completion marker commit together, so a failed run can be retried. Older catalogues without a marker are adopted conservatively; existing UI configuration/permissions are preserved. Bootstrap env is initialization-only, with explicit counts for skipped entries and no secret values in logs. See the [release checklist](../docs/access-lifecycle.md#preparação-da-release) before promoting: confirm executor disabled, dry-run enabled and privileged grants explicitly disabled. A follow-up migration records system reconciliation events for eligible automatic stock resources without rewriting the applied migration or attributing changes to an administrator.

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

The lockfile resolves `proxy-addr` to 2.0.8 to fix
[GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
After dependency updates, run `npm audit --omit=dev --audit-level=critical`
to reproduce the CI security gate.


Prefer TDD for DTO validation, permissions, session behavior, and regressions. Contract changes require a focused test and `npm run openapi:generate`; CI rejects drift.

## Production

Production uses the repository's Dockerfile and `../docker-compose.coolify.yml`. The image runs as `node`. The separate `migrator` service applies `prisma migrate deploy` and must complete before the API starts. The health endpoint is `GET /health`; it is intentionally public but must not expose secrets.

Do not run migrations inside the API start command, use the retired Nest starter/Mau deployment instructions, or claim deployment from a local build alone.
