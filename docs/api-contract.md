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
