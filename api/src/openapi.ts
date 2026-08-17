import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('ORBIT API')
    .setDescription('Shared ORBIT web and mobile API contract')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  const requestSchemaNames = new Set<string>();
  const collectSchemaReferences = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(collectSchemaReferences);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (
        key === '$ref' &&
        typeof child === 'string' &&
        child.startsWith('#/components/schemas/')
      ) {
        requestSchemaNames.add(child.slice('#/components/schemas/'.length));
      } else {
        collectSchemaReferences(child);
      }
    }
  };

  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (
        operation &&
        typeof operation === 'object' &&
        'requestBody' in operation
      ) {
        collectSchemaReferences(operation.requestBody);
      }
    }
  }

  let previousSize = -1;
  while (previousSize !== requestSchemaNames.size) {
    previousSize = requestSchemaNames.size;
    for (const schemaName of requestSchemaNames) {
      collectSchemaReferences(document.components?.schemas?.[schemaName]);
    }
  }
  for (const schemaName of requestSchemaNames) {
    const schema = document.components?.schemas?.[schemaName];
    if (schema && !('$ref' in schema)) {
      schema.additionalProperties = false;
    }
  }

  document.servers = [];
  return document;
}
