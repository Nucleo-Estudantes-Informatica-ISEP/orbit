# Orbit security audit

Audit scope for [#123](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/issues/123) treats in-house authentication as Orbit's ongoing design. AuthNEI, OIDC admission and external account linking are outside this scope. The primary revision is [`dev` at `5cc9adc`](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/tree/5cc9adc951e1bbf63126aff2cc33bdd7911879da). The release comparison is [`main` at `f98ddc9`](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/tree/f98ddc9a5aeabecddd4c5f5967590e4abea1b484).

The review recorded **18 private draft advisories**, nine high and nine medium. The high-severity work covers browser content handling, privilege delegation, attachment access and deletion, credential handling, and vulnerable API and storage dependencies. The historical credential candidate was later matched to the public NestJS starter placeholder and closed as a false positive. [Upstream example](https://github.com/nestjs/nest/blob/master/Readme.md?plain=1)

## Authorization and data review

The [route and guard matrix](security-audit-baseline.md) covers 130 controller operations across 80 OpenAPI paths and 21 controllers at both revisions. It also records frontend pages and caller families, the API rewrite, development documentation endpoints and the service worker. The source review distinguished public health and credential entry points, authenticated self-service, organization-wide permission gates and service-level resource restrictions.

| Surface | Boundary reviewed |
| --- | --- |
| Login and member admission | Local member provisioning, active account checks, password verification, JWT issuance and protected account routes. No public registration controller was found. |
| Local RBAC and member records | User, role and department administration, actor attribution, permission grants and transfer, current role versus token claims, and safe field selection on member responses. |
| HR and recruitment | Candidate lists, details, comments, PDF exports and bulk deletion. Access is permission-based. The feature's department preferences describe candidates and do not implement an audience rule. |
| Debts, incidents and inventory | Collection and item access, permitted transitions, comments, actor fields and attachment references. The implemented permissions are generally organization-wide. Department IDs attached to records describe data or filter queries. |
| Projects, boards, tasks, plans, events and documents | Feature permissions, list/detail access, relationships, plan decisions, filters and document links. The product should explicitly confirm which permissions are intended to grant access across departments before tightening resource-level scope. |
| Announcements and user settings | Audience and recipient checks, list/detail/action consistency, organization-wide edit permissions, and settings ownership with the administrative override. |
| Access lifecycle | Active operator and permission reload, department scope, original requester checks, separate approval, process/operation binding, configuration management, provider identity checks, immutable snapshots and worker lease claims. |
| Audit trail | JWT attribution, automatic versus client-reported events, event coverage, resource identifiers and persistence behavior. |

Operational scope matters for cross-department decisions. The matrix records the checks present in source and identifies explicit owner, audience or department boundaries. The audit treats broader department labels and filters as product-policy questions where the repository does not define a security boundary.

## Credentials, identifiers and trust boundaries

- **Session lifecycle.** Reviewed password login, access versus refresh credentials, the 15-minute access lifetime, rotation/reuse and concurrent renewal, logout, recovery and password changes. Traced cookie flags, browser storage, CORS, same-origin proxying, server errors, revocation, and the distinction between validating current membership and reusing signed role claims. Cookie flags were checked in synthetic HTTP responses. Browser-enforced CSRF behavior and production ingress policies were outside the test environment.
- **Capabilities.** Traced refresh and reset token generation, fingerprint storage, 30-day rolling refresh expiry and one-hour reset expiry, and eligibility and replay checks. Reviewed public account lookup and reset-link handling through mail, URL, browser and logs. File object UUIDs, resource IDs, and deterministic Forms/Sheets intake keys are identifiers that still require server-side access checks.
- **Storage and injection.** Reviewed multipart buffering, object key normalization, shared bucket access, origin and content-disposition handling, MinIO read/delete paths, rich-text rendering, email templates, resource URLs, PDF links and XLSX export. Reviewed Prisma filters and the parameterized raw lifecycle query for SQL input. No caller-controlled server fetch of document or CV URLs was found. The API does not issue presigned storage URLs in the audited revisions.
- **Provider requests.** Traced Google Forms, Sheets and Drive, GitHub and Discord request construction. The server uses provider origins and validates or encodes identifiers. The shared provider HTTP path rejects redirects. Reviewed server-side service account, installation and bot credentials, Google token scopes, request timeouts, provider error handling and worker dry-run behavior. No inbound webhook or externally authenticated job endpoint was present. The local worker claims operations in the database.
- **Deployment.** Reviewed embedded and shared Coolify models, service identity, secret injection, network boundaries, migration ordering and image users. The shared model separates database connection inputs for the migrator and API. Effective grants and storage policy depend on the deployment. The embedded MinIO server pin is affected by published upstream advisories independently of npm findings. [MinIO object-write advisory](https://github.com/minio/minio/security/advisories/GHSA-hv4r-mvr4-25vw), [MinIO archive-upload advisory](https://github.com/minio/minio/security/advisories/GHSA-9c4q-hq6p-c237)

## Verification

Dynamic checks used a clean archive of `dev` on macOS with Node 26.13.1, npm 11.20.0, and an isolated PostgreSQL 16 instance. The database and login used synthetic fixtures. Storage and provider dependencies in HTTP and integration tests were mocked where applicable.

| Check | Result |
| --- | --- |
| Controllers, OpenAPI paths and dashboard pages | Compared 130 operations and 16 dashboard subpages at both revisions. Controller guard and permission declarations agreed. |
| API migrations, unit and E2E | Prisma client generated, migrations deployed, 201 unit tests and 23 E2E tests passed. Tests included rotation concurrency, actor attribution, DTO constraints, access-lifecycle cross-department denial and independent approval. |
| Isolated authorization smoke | Started the compiled Nest application with a PostgreSQL fixture and mocked MinIO. All 124 bearer-protected operations returned 401 without a bearer. All 116 permission-gated operations returned 403 for a real local login with no role, and three settings operations denied a different member ID. Public health, login, malformed bearer rejection, production cookie flags, logout, and rejection of the revoked refresh cookie passed. |
| API build and OpenAPI drift | `npm run openapi:check` passed, including the API build. |
| Frontend tests and production build | 49 tests passed. Production Next build passed. No selected server credential variable name appeared in the emitted browser JavaScript. The four reviewed frontend tooling packages were absent from the standalone `dev` output. |
| Coolify models | Embedded and shared Compose validated with synthetic settings after removing the Coolify-specific extension for the local Compose parser. |
| Git history secret scan | Redacted Gitleaks scan of history reachable from both revisions identified one historical token-like value. The draft contains its source reference and asks the owner to determine its disposition. The value was omitted from outputs and was never tested against a service. |

Production npm dependency scans used the checked-in lockfiles on both revisions. Counts are registry package entries, which can include multiple packages for one advisory. The dependency drafts distinguish registry severity, runtime reachability and build-only tooling. [npm audit documentation](https://docs.npmjs.com/cli/audit/)

| Revision and package | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| `dev` API | 0 | 5 | 1 | 1 |
| `dev` frontend | 0 | 0 | 4 | 0 |
| `main` API | 0 | 4 | 2 | 0 |
| `main` frontend | 0 | 0 | 5 | 0 |

## Remaining verification

The audit establishes repository and isolated test results. A deployment owner still needs to verify the running revision, ingress rules and browser headers, SMTP and log redaction, effective PostgreSQL grants, MinIO server version and bucket policy, and provider credential scopes in an authorized staging environment. The release comparison covered source, route inventory and dependency evidence. Dynamic results apply to the pinned `dev` revision.

## Remediation and rollout

The security follow-up branch validates active session families and current local permissions on bearer requests. Account and role changes enforce a delegation ceiling and record authoritative events. Users select passwords through one-time activation or recovery links. Recovery links keep their credentials in the URL fragment, and the frontend keeps access tokens in memory. Announcements use a shared HTML allowlist and consistent recipient checks. Attachments follow their parent permissions, and deletion preserves objects that still have references.

The production dependency lockfiles were re-audited after updating the HTTP and upload parsers, switching to the AWS S3 client, and moving the frontend generator into the development dependency set. Both scans reported zero advisories. PostgreSQL 16 rehearsal applied the upgrade to synthetic pre-upgrade data and verified the new role grants and attachment metadata. The restricted API role could run application tests and was denied schema creation.

Local remediation verification passed 205 API unit tests, 31 API integration tests and 50 frontend tests. API and frontend lint, type checks, builds, OpenAPI drift, Compose validation, and the staged secret scan passed. Both images were configured to run as `node`. A locally compiled API started with production settings against isolated PostgreSQL and a disposable S3 fixture. The smoke verified login, secure cookie attributes, attachment access and deletion, and immediate logout revocation. The bucket-scoped credential could perform the required operations and was denied bucket creation and listing of a second bucket. The S3 fixture also preserved objects across restart.

The storage cutover requires a maintained S3 endpoint and a private bucket seeded with a verified copy of the existing objects. Production also requires separate PostgreSQL identities and independent signing and token-fingerprint keys. Existing sessions and recovery links must be reissued when the upgraded API goes live. Follow the [deployment and rollback procedure](shared-data.md) before promoting the remediation.
