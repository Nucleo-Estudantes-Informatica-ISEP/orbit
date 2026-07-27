# ORBIT API contract

The checked-in OpenAPI contract is `api/openapi/openapi.json`. It covers every public controller and is the source for generated clients.

## Local workflow

From `api/`:

```sh
npm run openapi:generate
npm run openapi:check
```

`openapi:generate` builds the Nest application with the Swagger compiler plugin, sorts the document recursively, and writes deterministic JSON. `openapi:check` fails when controller, DTO, or response changes are not reflected in the checked-in contract.

Request DTOs validate bodies, query strings, and path parameters. Global validation transforms declared primitive query values, rejects malformed values, and rejects unknown fields. Legacy actor ID fields remain accepted only on existing web contracts until the server-owned actor identity roadmap issue replaces them; DTO allowlists prevent other client fields from reaching Prisma.

Swagger UI is served at `/docs`; raw JSON is served at `/openapi.json`.
