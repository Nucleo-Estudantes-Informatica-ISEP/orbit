import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Operation = {
  operationId?: string;
  parameters?: Array<{ in: string; name: string; schema?: { format?: string } }>;
  requestBody?: unknown;
  responses?: Record<string, unknown>;
  security?: unknown[];
  tags?: string[];
};

describe('checked-in OpenAPI contract', () => {
  const document = JSON.parse(
    readFileSync(resolve(process.cwd(), 'openapi', 'openapi.json'), 'utf8'),
  ) as {
    paths: Record<string, Record<string, Operation>>;
    components: { schemas: Record<string, { additionalProperties?: boolean }> };
  };
  const operations = Object.entries(document.paths).flatMap(([path, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([method, operation]) => ({ path, method, operation })),
  );

  it('documents every controller operation with stable unique IDs and responses', () => {
    expect(operations.length).toBeGreaterThanOrEqual(60);
    const operationIds = operations.map(({ operation }) => operation.operationId);
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
      '/auth/forgot-password',
      '/auth/reset-password',
    ]);
    for (const { path, operation } of operations.filter(({ path }) => !publicPaths.has(path))) {
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
      expect(document.components.schemas[schemaName]?.additionalProperties).toBe(false);
    }
  });
});
