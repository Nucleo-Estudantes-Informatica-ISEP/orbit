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
