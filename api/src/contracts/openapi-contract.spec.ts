import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Operation = {
  operationId?: string;
  parameters?: Array<{
    in: string;
    name: string;
    schema?: { format?: string };
  }>;
  requestBody?: unknown;
  responses?: Record<
    string,
    {
      content?: Record<string, { schema?: unknown }>;
      headers?: Record<string, unknown>;
    }
  >;
  security?: Array<Record<string, unknown>>;
  tags?: string[];
};

describe('checked-in OpenAPI contract', () => {
  const document = JSON.parse(
    readFileSync(resolve(process.cwd(), 'openapi', 'openapi.json'), 'utf8'),
  ) as {
    paths: Record<string, Record<string, Operation>>;
    components: {
      schemas: Record<
        string,
        {
          additionalProperties?: boolean;
          properties?: Record<string, unknown>;
        }
      >;
      securitySchemes: Record<string, unknown>;
    };
  };
  const operations = Object.entries(document.paths).flatMap(
    ([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) =>
          ['get', 'post', 'put', 'patch', 'delete'].includes(method),
        )
        .map(([method, operation]) => ({ path, method, operation })),
  );

  it('documents every controller operation with stable unique IDs and responses', () => {
    expect(operations.length).toBeGreaterThanOrEqual(60);
    const operationIds = operations.map(
      ({ operation }) => operation.operationId,
    );
    expect(new Set(operationIds).size).toBe(operationIds.length);
    for (const { operation } of operations) {
      expect(operation.operationId).toBeTruthy();
      expect(operation.tags?.length).toBeGreaterThan(0);
      const responses = Object.keys(operation.responses ?? {});
      expect(responses.some((status) => /^2\d\d$/.test(status))).toBe(true);
      if (operation.requestBody || operation.parameters?.length) {
        expect(responses).toContain('400');
      }
    }
  });

  it('documents UUID validation for UUID path parameters', () => {
    const idParameters = operations.flatMap(({ operation }) =>
      (operation.parameters ?? []).filter(
        (parameter) =>
          parameter.in === 'path' &&
          ['id', 'userId', 'candidateId', 'commentId'].includes(parameter.name),
      ),
    );
    expect(idParameters.length).toBeGreaterThan(0);
    for (const parameter of idParameters) {
      expect(parameter.schema?.format).toBe('uuid');
    }
  });

  it('documents bearer auth for every non-auth operation', () => {
    const publicPaths = new Set([
      '/auth/login',
      '/auth/refresh',
      '/auth/logout',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/health',
    ]);
    for (const { operation } of operations.filter(
      ({ path }) => !publicPaths.has(path),
    )) {
      expect(operation.security).toEqual([{ bearer: [] }]);
    }
  });

  it('marks request schemas as closed to unknown fields', () => {
    const requestSchemaNames = operations.flatMap(({ operation }) => {
      const serialized = JSON.stringify(operation.requestBody ?? {});
      return [...serialized.matchAll(/#\/components\/schemas\/([^"]+)/g)].map(
        (match) => match[1],
      );
    });
    expect(requestSchemaNames.length).toBeGreaterThan(0);
    for (const schemaName of requestSchemaNames) {
      expect(
        document.components.schemas[schemaName]?.additionalProperties,
      ).toBe(false);
    }
  });

  it('excludes server-owned actor IDs from request schemas', () => {
    const actorFields = [
      'createdById',
      'performedById',
      'reportedById',
      'purchasedById',
    ];
    const requestSchemaNames = operations.flatMap(({ operation }) => {
      const serialized = JSON.stringify(operation.requestBody ?? {});
      return [...serialized.matchAll(/#\/components\/schemas\/([^"/]+)/g)].map(
        (match) => match[1],
      );
    });

    for (const schemaName of requestSchemaNames) {
      const properties = document.components.schemas[schemaName]?.properties;
      for (const actorField of actorFields) {
        expect(properties).not.toHaveProperty(actorField);
      }
    }
  });

  it('documents refresh-cookie transport and rotation', () => {
    expect(document.components.securitySchemes.orbit_refresh).toEqual({
      in: 'cookie',
      name: 'orbit_refresh',
      type: 'apiKey',
    });
    for (const path of ['/auth/refresh', '/auth/logout']) {
      expect(document.paths[path].post.security).toEqual([
        { orbit_refresh: [] },
      ]);
    }
    for (const path of ['/auth/login', '/auth/refresh', '/auth/logout']) {
      const success =
        document.paths[path].post.responses?.[
          path === '/auth/logout' ? '200' : '201'
        ];
      expect(success?.headers).toHaveProperty('Set-Cookie');
    }
  });

  it('documents the health response body', () => {
    expect(
      document.paths['/health'].get.responses?.['200']?.content?.[
        'application/json'
      ]?.schema,
    ).toEqual({ $ref: '#/components/schemas/HealthResponseDto' });
  });

  it('resolves every internal schema reference', () => {
    const serialized = JSON.stringify(document);
    const schemaReferences = [
      ...serialized.matchAll(/#\/components\/schemas\/([^"/]+)/g),
    ].map((match) => match[1]);

    expect(schemaReferences.length).toBeGreaterThan(0);
    for (const schemaName of schemaReferences) {
      expect(document.components.schemas[schemaName]).toBeDefined();
    }
  });
});
