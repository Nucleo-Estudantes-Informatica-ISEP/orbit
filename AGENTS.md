# AGENTS.md

Contributor and automation instructions for the Orbit monorepo. Read this file before changing either `api/` or `frontend/`; frontend work must also follow `frontend/AGENTS.md` and the versioned Next.js documentation shipped in `node_modules`.

## Workflow

- Branch from `main` using `fix/`, `feat/`, `docs/`, `test/`, `build/`, or `chore/` plus a short kebab-case description.
- Use Conventional Commits, keep commits logically scoped, and include `Closes #N` in the PR body only when the change fully resolves that issue.
- Open PRs into `main`. Preserve authorship when superseding another PR, link the replacement, and close the duplicate review path once all useful commits are present.
- Prefer TDD for regressions, DTO rules, authorization, session behavior, and business logic: write a focused failing test, implement the smallest fix, then refactor with the suite green. If a hosted dependency prevents a deterministic pre-fix test, document that and provide a staging smoke procedure.
- Never trust actor/member IDs supplied by a client. Mutation attribution comes from the authenticated JWT. Access and refresh tokens are distinct types; access tokens are short-lived and refresh tokens rotate.

## Commands

Run API commands from `api/`:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx prisma generate
npx prisma migrate deploy
npm run build
npm run openapi:check
npm audit --omit=dev
```

Run frontend commands from `frontend/`:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
npm audit --omit=dev
```

Every behavior change needs regression coverage at the lowest useful level. API contract changes must regenerate `api/openapi/openapi.json` and pass `openapi:check`.

## CI/CD

`.github/workflows/ci.yml` is the required PR gate. It uses frozen `npm ci` installs and runs API lint/typecheck/unit/E2E/migrations/build/audit, frontend lint/typecheck/tests/build/audit, both production Docker builds with non-root assertions, Coolify compose validation, and Gitleaks.

Production is Docker Compose on Coolify. The `migrator` service must finish successfully before the API starts; the API health route is `/health`, and the frontend waits for API health. Do not put migrations back into the API startup command and do not add a competing deployment workflow. A green image build is not proof of a deployed release: verify the deployed SHA, migration status, `/health`, the frontend root, and the affected authenticated flow.

Dependabot routine groups are patch/minor only. Major framework, runtime, or toolchain upgrades require their own issue, migration notes, and full validation.

## Documentation

Keep `README.md`, `api/README.md`, `frontend/README.md`, `.env` examples, `docs/api-contract.md`, and this file synchronized with scripts, token behavior, deployment, routes, and environment names. Remove starter-template or retired-host instructions instead of preserving them as alternatives.

Never commit or print secrets. Production seeds must fail closed when required administrator credentials are missing and must never log passwords.
