# Orbit security audit baseline

This is the route and guard inventory for [the in-house authentication audit](security-audit.md) commissioned by [issue #123](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/issues/123). The primary revision is `dev` at `5cc9adc951e1bbf63126aff2cc33bdd7911879da`. The two audited revisions have the same explicit controller operations and different access-lifecycle implementations and dependency versions. The comparison revision is `main` at `f98ddc9a5aeabecddd4c5f5967590e4abea1b484`.

## API route matrix

The 130 explicit controller operations below cover 80 OpenAPI paths. Combine each prefix with its listed suffix. `/` denotes the prefix itself. Permission rows also require an access JWT. A permission name records the check implemented at the baseline revision. Confirm the intended resource boundary against the corresponding feature during the audit.

| API prefix | Method and suffix | Implemented access | Web callers |
| --- | --- | --- | --- |
| `/health` | `GET /` | Public health response | Deployment health check |
| `/auth` | `POST /login`, `POST /forgot-password` | Public entry points. Login checks credentials and active status. Recovery looks up an active account by email. | Login page and auth context |
| `/auth` | `POST /reset-password` | Reset token | Reset page |
| `/auth` | `POST /refresh`, `POST /logout` | Refresh cookie. Refresh requires an eligible token. Logout clears the cookie and revokes a matching token family. | Shared API client and auth context |
| `/auth` | `GET /me`, `PUT /me`, `PUT /change-password` | Access JWT, caller's own account. Password change also checks the current password. | Auth context and settings |
| `/user-settings` | `POST /` | Access JWT, settings created for the caller | Settings and locale context use the resource |
| `/user-settings` | `GET /:userId`, `PUT /:userId`, `DELETE /:userId` | Access JWT, owner or `USERS_UPDATE` | Settings and locale context |
| `/announcements` | `GET /`, `GET /me`, `PUT /me/read-all` | `ANNOUNCEMENTS_READ`. List is visibility-scoped. The two `me` routes use the caller as recipient. | Dashboard, announcements and notification bell |
| `/announcements` | `GET /:id`, `PUT /:id/read` | `ANNOUNCEMENTS_READ` | Announcements and notification bell |
| `/announcements` | `POST /` | `ANNOUNCEMENTS_CREATE` | Announcements |
| `/announcements` | `PUT /:id`, `PUT /:id/pin` | `ANNOUNCEMENTS_UPDATE` | Announcements |
| `/announcements` | `DELETE /:id` | `ANNOUNCEMENTS_DELETE` | Announcements |
| `/audit-logs` | `GET /` | `AUDITS_READ` | Audit logs and recruitment |
| `/audit-logs` | `POST /` | `USERS_CREATE`, actor from the JWT | No direct caller identified |
| `/boards` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `BOARDS_CREATE`, `BOARDS_READ` for both GETs, `BOARDS_UPDATE`, `BOARDS_DELETE` | Tasks |
| `/candidates` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /`, `DELETE /:id` | `RECRUITMENT_CREATE`, `RECRUITMENT_READ` for both GETs, `RECRUITMENT_UPDATE`, `RECRUITMENT_DELETE` for both DELETEs | Recruitment |
| `/candidates` | `GET /export/all`, `GET /export/:id` | `RECRUITMENT_READ` | Recruitment PDF downloads |
| `/recruitment/comments` | `POST /`, `GET /candidate/:candidateId`, `GET /:id`, `DELETE /:id` | `RECRUITMENT_CREATE`, `RECRUITMENT_READ` for both GETs, `RECRUITMENT_DELETE` | Recruitment |
| `/debts` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `DEBTS_CREATE`, `DEBTS_READ` for both GETs, `DEBTS_UPDATE`, `DEBTS_DELETE` | Debts |
| `/debts` | `POST /:id/complete`, `POST /:id/revert` | `DEBTS_UPDATE` | Debts |
| `/departments` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `DEPARTMENTS_CREATE`, `DEPARTMENTS_READ` for both GETs, `DEPARTMENTS_UPDATE`, `DEPARTMENTS_DELETE` | People and dashboard department selectors |
| `/departments` | `GET /:id/users/count`, `POST /:id/transfer-and-delete` | `DEPARTMENTS_READ`, `DEPARTMENTS_DELETE` | People |
| `/events` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `EVENTS_CREATE`, `EVENTS_READ` for both GETs, `EVENTS_UPDATE`, `EVENTS_DELETE` | Dashboard and events |
| `/files` | `GET /`, `POST /upload`, `DELETE /:key` | `FILES_VIEW`, `FILES_UPLOAD`, `FILES_DELETE` | Files and attachment upload forms |
| `/files` | `GET /*key` | Access JWT | File preview and authenticated attachment component |
| `/incidents` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `INCIDENTS_CREATE`, `INCIDENTS_READ` for both GETs, `INCIDENTS_UPDATE`, `INCIDENTS_DELETE` | Incidents |
| `/incidents` | `POST /:id/comments`, `DELETE /comments/:commentId` | `INCIDENTS_UPDATE`, `INCIDENTS_DELETE` | Incidents |
| `/inventory` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `INVENTORY_CREATE`, `INVENTORY_READ` for both GETs, `INVENTORY_UPDATE`, `INVENTORY_DELETE` | Inventory |
| `/plans` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `PLANS_CREATE`, `PLANS_READ` for both GETs, `PLANS_UPDATE`, `PLANS_DELETE` | Plans |
| `/plans` | `PUT /:id/approve`, `PUT /:id/reject` | `PLANS_APPROVE` | Plans |
| `/projects` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `PROJECTS_CREATE`, `PROJECTS_READ` for both GETs, `PROJECTS_UPDATE`, `PROJECTS_DELETE` | Projects and tasks |
| `/projects` | `POST /:id/members`, `DELETE /:id/members/:userId` | `PROJECTS_UPDATE` | No direct caller identified |
| `/resources` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `RESOURCES_CREATE`, `RESOURCES_READ` for both GETs, `RESOURCES_UPDATE`, `RESOURCES_DELETE` | Documents |
| `/roles` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `ROLES_CREATE`, `ROLES_READ` for both GETs, `ROLES_UPDATE`, `ROLES_DELETE` | People |
| `/roles` | `GET /:id/users/count`, `POST /:id/transfer-and-delete` | `ROLES_READ`, `ROLES_DELETE` | People |
| `/tasks` | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` | `TASKS_CREATE`, `TASKS_READ` for both GETs, `TASKS_UPDATE`, `TASKS_DELETE` | Tasks |
| `/users` | `POST /`, `GET /`, `GET /:id`, `GET /stats/overview`, `PUT /:id`, `DELETE /:id` | `USERS_CREATE`, `USERS_READ` for all GETs, `USERS_UPDATE`, `USERS_DELETE` | People and dashboard member selectors |
| `/access-lifecycle` | `GET /configuration` | `ACCESS_READ`. The resource catalog is shared on `dev`. Policies and departments are scoped, and administrative links require `ACCESS_MANAGE`. The checkout at `f98ddc9` also scopes the catalog. | Access dashboard |
| `/access-lifecycle` | `GET /processes`, `GET /processes/:id`, `GET /processes/:id/inventory` | `ACCESS_READ`, department scope or `ACCESS_ALL_DEPARTMENTS`. Inventory queries providers in read-only mode. | Access dashboard |
| `/access-lifecycle` | `GET /intake`, `POST /preview`, `POST /processes` | `ACCESS_CREATE` and department scope | Access request form and dashboard |
| `/access-lifecycle` | `POST /resources`, `PUT /resources/:id`, `POST /policies`, `PUT /policies/:id` | `ACCESS_MANAGE` and `ACCESS_ALL_DEPARTMENTS` | Access administration |
| `/access-lifecycle` | `POST /processes/:id/submit`, `POST /processes/:id/cancel` | `ACCESS_CREATE`, department scope and original requester. Submit requires a draft. Cancel is available before approval. | Access dashboard |
| `/access-lifecycle` | `POST /processes/:id/decision` | `ACCESS_APPROVE`, department scope, pending approval and a different actor from the requester | Access dashboard |
| `/access-lifecycle` | `POST /processes/:id/operations/:operationId/confirm-manual`, `POST /processes/:id/operations/:operationId/retry`, `POST /processes/:id/operations/:operationId/reconcile` | `ACCESS_EXECUTE`, department scope and an operation belonging to the process. Manual confirmation and retry require approval. Reconciliation can observe an approved or completed process. | Access dashboard |

All lifecycle permissions also require `ACCESS_READ` and an active local member, reloaded by [the lifecycle service](../api/src/access-lifecycle/lifecycle.service.ts). The callers column records feature locations. It groups callers for shared resources and includes API-only operations in those groups.

## Guards and server entry points

| Surface | Baseline behavior |
| --- | --- |
| [JWT guard](../api/src/auth/jwt-auth.guard.ts) and [strategy](../api/src/auth/jwt.strategy.ts) | Passport reads the Authorization bearer header, verifies the JWT using Orbit's configured signing secret and checks expiry, access token type and required identity fields. The strategy constructs the request identity, roles and permissions from the signed claims. |
| [Permissions guard](../api/src/auth/permissions.guard.ts) | Reads route or controller metadata. A match to any listed `SystemPermission` allows the operation. With empty metadata, the guard imposes no permission check. |
| [Roles guard](../api/src/auth/roles.guard.ts) | Tests the signed role claims against role metadata. Registered in the auth module. No controller attaches this guard at the baseline revision. |
| [OpenAPI decorator](../api/src/contracts/openapi.decorators.ts) | Adds documentation for authenticated responses. Runtime enforcement comes from the route guards and service checks. |
| [Nest bootstrap](../api/src/main.ts) | Serves Swagger UI under `/docs` and the OpenAPI JSON at `/openapi.json` outside production. Handles CORS preflight outside the controller inventory. |
| [Next rewrite](../frontend/next.config.ts) | Proxies `/api/:path*` to the internal Nest service. No custom App Router API handlers or Server Actions were found. |
| [Dashboard layout](../frontend/app/dashboard/layout.tsx), [auth context](../frontend/lib/auth-context.tsx) and [permission hook](../frontend/lib/use-permission.ts) | Browser-side session and page controls. The API and its services enforce data access. |
| [Next pages](../frontend/app) and [web manifest](../frontend/app/manifest.ts) | The server serves `/`, `/login`, `/reset-password`, `/privacy`, `/terms`, `/file`, `/manifest.webmanifest`, and `/dashboard` with the subpages listed below. The file preview uses the shared authenticated download helper. |
| [Service worker](../frontend/public/sw.js) | Caches the root navigation and public static assets. API requests fall outside its cache handlers. |

Dashboard subpages under `/dashboard` are `/access`, `/announcements`, `/audit-logs`, `/debts`, `/documents`, `/events`, `/files`, `/incidents`, `/inventory`, `/notifications`, `/people`, `/plans`, `/projects`, `/recruitment`, `/settings` and `/tasks`.

## Baseline trust boundaries

- The browser stores the access token and cached user in local storage. The access JWT lifetime is 15 minutes. The opaque refresh token has 384 bits of randomness and is stored as a keyed fingerprint. Its 30-day cookie uses `HttpOnly`, `SameSite=Strict`, `Path=/` and `Secure` in production. Refresh rotates the token and checks reuse. Logout revokes its family. Inspect bearer and cookie behavior together when verifying revocation, CORS and CSRF. [Auth service](../api/src/auth/auth.service.ts) · [Auth controller](../api/src/auth/auth.controller.ts) · [Web API client](../frontend/lib/api.ts)
- Password reset looks up an active account by email and returns a generic response in the normal path. Reset emails contain a 256-bit random token in the query string. The server stores its fingerprint, sets a one-hour lifetime and marks outstanding tokens used after reset. Verify enumeration resistance, replay and token handling in browser history, referrers, proxies, logs and error paths for any retained reset flow. [Auth service](../api/src/auth/auth.service.ts) · [Reset page](../frontend/app/reset-password/page.tsx)
- File uploads create a random UUID object key plus an extension. The application streams MinIO downloads through the bearer-authenticated API. It has no signed-URL issuance route in this revision. Confirm the intended access for file browsing and attachments tied to debts, incidents and documents, then test the corresponding authorization with synthetic objects. [File controller](../api/src/files/files.controller.ts) · [MinIO service](../api/src/files/minio.service.ts)
- The access executor uses an in-process timer and a persisted database lease. No inbound webhook or externally authenticated job endpoint was found in the route inventory. Connector calls for Google Forms, Sheets, Drive, GitHub and Discord on `dev` use server-side credentials. Forms and Sheets intake keys are deterministic hashes used to locate upstream records. Process creation reloads the record and checks its department and submitted identity. Include destination selection, redirect handling, provider identifiers, credential scope and dry-run execution in the review. [Worker](../api/src/access-lifecycle/lifecycle.worker.ts) · [Provider HTTP client](../api/src/access-lifecycle/provider-http.ts) · [Access lifecycle](access-lifecycle.md)
- The deployment templates include separate API and migrator services. Shared deployment config takes separate runtime and migration database connection inputs. Validate effective database grants, MinIO bucket policy, production settings and secret injection in an isolated deployment. [Coolify Compose](../docker-compose.coolify.yml) · [Shared Compose](../docker-compose.shared.yml)

## Verification status

Controller operations were reconciled with the checked-in OpenAPI paths at both revisions. Frontend caller families, guards and selected service checks were traced in source. See the [audit report](security-audit.md) for isolated runtime results, dependency scans and limits of verification.
