# ORBIT API and Web Mobile-Enablement PR Roadmap

ORBIT Mobile reuses the existing ORBIT API. The following changes belong to this repository because they alter the shared backend contract, database model, security boundaries, or web client.

Every change uses a dedicated branch and pull request. Never commit directly to `main`.

## 1. Complete API contract

Issue: [#2](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/issues/2)

Suggested branch: `api/openapi-contract`

Deliver one comprehensive contract PR:

- Add validated DTOs for all request bodies currently using `any`.
- Validate query and path parameters.
- Define response and error schemas for every endpoint.
- Configure `@nestjs/swagger` and deterministic OpenAPI generation.
- Reject unknown fields where compatibility permits.
- Cover every API module, not only mobile-used endpoints.
- Update web callers for corrected contracts.
- Add contract/spec drift checks to CI.

Done when every public controller endpoint has request/response/auth/error documentation, invalid inputs return consistent `400` responses, arbitrary fields cannot reach Prisma, web behavior remains compatible, and API tests pass.

## 2. Session and member self-service

Issue: [#3](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/issues/3)

Suggested branch: `auth/session-and-self-service`

- Standardize 15-minute access tokens and 7-day refresh tokens.
- Make login/refresh responses consistent.
- Add safe authenticated endpoints for changing the current Member's name.
- Require current-password verification before password change.
- Keep email, roles, status, and department in administrator-only flows.
- Update web session refresh and Profile callers.
- Add auth/self-service e2e coverage.

## 3. Server-owned actor identity

Issue: [#4](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/issues/4)

Suggested branch: `security/server-owned-actors`

- Derive `createdById` and `performedById` from the authenticated JWT.
- Remove authoritative actor IDs from client DTOs.
- Cover Tasks, Projects, Events, Incidents/comments, Announcements, and any other affected mutations found during audit.
- Preserve target/assignee/member IDs that describe the mutation target.
- Update web callers and add forged-ID security tests.

## 4. Unified Announcement feed

Issue: [#5](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/issues/5)

Suggested branch: `announcements/member-feed`

- Add per-member read receipts.
- Unify public, department, private, and system-generated Announcements in one chronological feed.
- Add safe authenticated mark-one and mark-all operations.
- Add `relatedEntityType` (`TASK`, `EVENT`, `PROJECT`) and `relatedEntityId`.
- Populate references for task assignment, event creation, and project creation.
- Migrate web notification bell and Announcement views.
- Define migration/backfill, pagination, authorization, and deleted-target behavior.

## 5. Expo push delivery

Issue: [#6](https://github.com/Nucleo-Estudantes-Informatica-ISEP/orbit/issues/6)

Suggested branch: `notifications/expo-push`

Depends on the unified Announcement feed.

- Add Device Installation storage for Member, Expo token, platform, installation ID, and last seen.
- Add authenticated register/update/unregister-current-installation endpoints.
- Support multiple devices and token reassignment.
- Use the default-on, user-disableable notification preference to gate delivery.
- Send pushes from existing Announcement creation.
- Include Announcement and related entity references in payloads.
- Process Expo receipts and remove invalid tokens.
- Ensure logout affects only the current installation.

## Ordering

1. API contract
2. Session/self-service
3. Server-owned actors
4. Unified Announcement feed
5. Expo push delivery

Mobile foundation may proceed independently, but feature integration should wait for the corresponding merged shared contract.
