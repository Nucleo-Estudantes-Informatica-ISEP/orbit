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

The authenticated `/access-lifecycle/configuration` response includes `executorEnabled` and `dryRun`, reporting the effective execution mode without exposing deployment variables or provider credentials.

External access management uses `/access-lifecycle` for configuration, scoped Forms/Sheets intake, policy previews, resource/policy version updates and immutable lifecycle processes. Process subroutes handle submission, independent decisions, cancellation, manual evidence, retries and read-only observations. Account hints from intake are not verified identities, and target data is a process snapshot rather than an Orbit user. See [access lifecycle](access-lifecycle.md) for payload semantics, permissions and deployment variables.

New clients send Discord/GitHub `accountUsername` so even numeric usernames are resolved as usernames. Legacy `providerUserId` accepts a Discord/GitHub username, a Google email or a legacy numeric ID. Orbit resolves usernames before freezing a draft when available and verifies remote state during execution. `verificationNote` is optional context; it does not attest automatic identity. Google permission IDs stay internal. Coordinator scope limits target people; all service resources remain visible, with out-of-policy selections requiring justification and independent approval. The legacy `providerUserId` history query also searches declared account labels and account emails.

Process creation compares Discord/GitHub accounts and Google emails with the selected Forms response or manual Sheets record when declared; mismatches return 400. Operation results record `identitySource` (`FORMS`, `SHEETS` or `OPERATOR`) and retain the declared `accountName` alongside the stable resolved `providerUserId` for approval and execution history. Manual-source accounts still require an independent review of their association with the person. Invalid or ambiguous account lookups return 400; missing provider configuration, throttling and provider failures return 503 with a sanitized code and create no partial draft. Resource writes also return these controlled errors when validating actual Discord role permissions. The `providerUserId` history filter requires at least three characters, including after trimming surrounding whitespace on the server.

Configuration advertises available `intakeSources` (`FORMS`, `SHEETS`), ordered with Forms first. `GET /intake` accepts optional `intakeSource` and returns only that origin, with `source` on every result and optional `submittedAt` for Forms. Forms responses are read directly from Google, independently of any spreadsheet. Clients submit the selected `intakeSource` with its opaque `intakeKey`; supplying a source without a key is invalid. Snapshots distinguish `GOOGLE_FORMS` from `GOOGLE_SHEETS`. Existing `GOOGLE_FORMS_SHEETS` history is preserved, existing Sheets keys remain valid, and old clients without a selector remain supported. There is no cross-origin data merge or silent failover on a selected source failure.

Intake preserves the distinction between `accounts.discordUsername` and `accounts.discordId`: an explicit username column/mapping never reads a legacy-ID column, even when the username is blank. Configured mappings take priority independently of column order; a column explicitly mapped as a username is excluded from legacy IDs. Clients can therefore reuse a remaining legacy ID as `providerUserId` without silently converting it to `accountUsername`.

Unresolved Discord/GitHub username revocations return `AWAITING_MANUAL`, allowing attributed evidence for the approved action without claiming that a missing search result proves absence. New administrative Discord grants require the separate API deployment opt-in `ACCESS_DISCORD_PRIVILEGED_GRANTS_ENABLED=true`; without it, they remain manual. This does not replace independent process approval, sensitivity checks or role hierarchy enforcement, and does not block approved revocations.

Execution and retry never resolve an approved Discord/GitHub username again: automatic provider writes use the stable ID frozen during creation. Unresolved names await manual evidence or a new request after account/server entry; sensitive automatic operations with unresolved identities cannot be submitted or approved (400). Read-only inventory may resolve a name for observation without rebinding the request. Drive `REVOKE`/`VERIFY` rejects principals that are neither valid emails nor numeric legacy permission IDs. Forms searches use a 30-second in-memory cache with concurrent fetch sharing; creation bypasses it to revalidate response keys. Forms `positions` is always empty; respondent-declared Cargo cannot drive elevated defaults, while the manual Sheets registry retains its recorded positions. Descriptive resource edits skip Discord validation when the provider/type, destination, sensitivity and automation/activation fields are unchanged.
