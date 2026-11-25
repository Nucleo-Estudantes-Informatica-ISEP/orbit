# ORBIT API contract

The checked-in OpenAPI contract is `api/openapi/openapi.json`. It covers every public controller and is the source for generated clients.

## Local workflow

From `api/`:

```sh
npm run openapi:generate
npm run openapi:check
```

`openapi:generate` builds the Nest application with the Swagger compiler plugin, sorts the document recursively, and writes deterministic JSON. `openapi:check` fails when controller, DTO, or response changes are not reflected in the checked-in contract.

Request DTOs validate bodies, query strings, and path parameters. Global validation transforms declared primitive query values, rejects malformed values, and rejects unknown fields. Authoritative actor ID fields are absent from public request contracts; controllers derive audit and ownership identity from the authenticated JWT. Explicit target, assignee, and member IDs remain accepted where they identify the mutation target rather than its actor.

Swagger UI is served at `/docs`; raw JSON is served at `/openapi.json`.

Auth requests use the in-house issuer. Access tokens are bound to a live session and current local permissions. Browser authentication writes require a trusted Origin when the browser supplies one and can return 429 when limited. Credential updates and role assignments require explicit local permissions.

The file API records the authenticated uploader. New references can adopt an upload owned by the caller. An existing attachment requires the parent feature's read permission. After the last reference is removed, an owned upload is private to its uploader and can be attached again. Detached ownerless legacy files can be read with `FILES_VIEW`. Only the file API can delete an unreferenced object. A file still linked to a record returns 409 on deletion.

## Breaking changes from the security audit

- `POST /users` returns 400 if the payload includes `password`. Omit the field and use the activation link emailed to active accounts.
- `POST /audit-logs` was removed. Orbit writes audit records from authenticated actions. Clients with audit access can read them through `GET /audit-logs`.

The authenticated `/access-lifecycle/configuration` response includes `executorEnabled` and `dryRun`, reporting the effective execution mode without exposing deployment variables or provider credentials.

External access management uses `/access-lifecycle` for configuration, scoped Forms/Sheets intake, policy previews, resource/policy version updates and immutable lifecycle processes. Process subroutes handle submission, independent decisions, cancellation, manual evidence, retries and read-only observations. Account hints from intake are not verified identities, and target data is a process snapshot rather than an Orbit user. See [access lifecycle](access-lifecycle.md) for payload semantics, permissions and deployment variables.

New clients send Discord/GitHub `accountUsername` so even numeric usernames are resolved as usernames. Legacy `providerUserId` accepts a Discord/GitHub username, a Google email or a legacy numeric ID. Orbit resolves usernames before freezing a draft when available and verifies remote state during execution. `verificationNote` is optional context; it does not attest automatic identity. Google permission IDs stay internal. Coordinator scope limits target people; all service resources remain visible, with out-of-policy selections requiring justification and independent approval. The legacy `providerUserId` history query also searches declared account labels and account emails.

Process creation compares Discord/GitHub accounts and Google emails with the selected Forms response or manual Sheets record when declared; mismatches return 400. Operation results record `identitySource` (`FORMS`, `SHEETS` or `OPERATOR`) and retain the declared `accountName` alongside the stable resolved `providerUserId` for approval and execution history. Manual-source accounts still require an independent review of their association with the person. Invalid or ambiguous account lookups return 400; missing provider configuration, throttling and provider failures return 503 with a sanitized code and create no partial draft. Resource writes also return these controlled errors when validating actual Discord role permissions. The `providerUserId` history filter requires at least three characters, including after trimming surrounding whitespace on the server.

Configuration advertises available `intakeSources` (`FORMS`, `SHEETS`), ordered with Forms first. `GET /intake` accepts optional `intakeSource` and returns only that origin, with `source` on every result and optional `submittedAt` for Forms. Forms responses are read directly from Google, independently of any spreadsheet. Clients submit the selected `intakeSource` with its opaque `intakeKey`; supplying a source without a key is invalid. Snapshots distinguish `GOOGLE_FORMS` from `GOOGLE_SHEETS`. Existing `GOOGLE_FORMS_SHEETS` history is preserved, existing Sheets keys remain valid, and old clients without a selector remain supported. There is no cross-origin data merge or silent failover on a selected source failure.

Intake preserves the distinction between `accounts.discordUsername` and `accounts.discordId`: an explicit username column/mapping never reads a legacy-ID column, even when the username is blank. Configured mappings take priority independently of column order; a column explicitly mapped as a username is excluded from legacy IDs. Clients can therefore reuse a remaining legacy ID as `providerUserId` without silently converting it to `accountUsername`.
