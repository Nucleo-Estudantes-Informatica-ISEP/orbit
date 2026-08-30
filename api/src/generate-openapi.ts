import { NestFactory } from '@nestjs/core';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './openapi';

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortDeep(child)]),
    );
  }
  return value;
}

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = sortDeep(createOpenApiDocument(app));
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  const outputPath = resolve(process.cwd(), 'openapi', 'openapi.json');

  if (process.argv.includes('--check')) {
    const existing = await readFile(outputPath, 'utf8').catch(() => '');
    if (existing !== serialized) {
      throw new Error('OpenAPI contract drift detected. Run npm run openapi:generate.');
    }
  } else {
    await mkdir(resolve(process.cwd(), 'openapi'), { recursive: true });
    await writeFile(outputPath, serialized, 'utf8');
  }

  await app.close();
}

void generate();
