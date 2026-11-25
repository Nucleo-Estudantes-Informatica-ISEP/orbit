import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { createOpenApiDocument } from './openapi';
import { createValidationPipe } from './validation';
import { browserOrigins, passwordRecoveryOrigin } from './config/auth.config';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') passwordRecoveryOrigin();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const trustedProxyHops = Number(process.env.AUTH_TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
    throw new Error('AUTH_TRUST_PROXY_HOPS must be a nonnegative integer.');
  }
  if (trustedProxyHops > 0) app.set('trust proxy', trustedProxyHops);
  app.enableShutdownHooks();
  app.useGlobalPipes(createValidationPipe());

  if (process.env.NODE_ENV !== 'production') {
    const openApiDocument = createOpenApiDocument(app);
    SwaggerModule.setup('docs', app, openApiDocument, {
      jsonDocumentUrl: 'openapi.json',
    });
  }

  app.enableCors({
    origin: browserOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  if (process.env.NODE_ENV === 'production') {
    const [runtimeRole] = await app.get(PrismaService).$queryRaw<
      { elevated: boolean }[]
    >`
      SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls
              OR has_schema_privilege(current_user, current_schema(), 'CREATE')
              OR coalesce(has_table_privilege(current_user, to_regclass('_prisma_migrations'), 'INSERT,UPDATE,DELETE'), false)) AS elevated
      FROM pg_roles WHERE rolname = current_user
    `;
    if (runtimeRole?.elevated !== false) {
      await app.close();
      throw new Error('Production requires a restricted PostgreSQL runtime role.');
    }
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
