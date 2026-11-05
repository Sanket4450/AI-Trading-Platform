import './bootstrap-env.js';
import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { assertResearchMode } from '@ai-trading/configuration';
import { SESSION_COOKIE } from './common/auth/auth.constants.js';
import { AppModule } from './app.module.js';

async function bootstrap() {
  assertResearchMode();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('WEB_URL', 'http://localhost:3000'),
    credentials: true,
  });
  app.setGlobalPrefix(config.get<string>('API_PREFIX', 'api'));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('AI Trading API')
    .setDescription(
      'R2 research cockpit: reference data, historical ingestion, coverage, data quality and audit.\n\n' +
        'Authentication uses an opaque session token. Call `POST /api/v1/auth/login`, then either ' +
        'paste the returned `token` into Authorize as a bearer token or reuse the httpOnly session ' +
        'cookie set by the login response. Mutating reference-data operations require the `admin` role.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Session token',
        description:
          'Opaque token returned by POST /api/v1/auth/login (also accepted as the session cookie).',
      },
      'bearer',
    )
    .addCookieAuth(
      SESSION_COOKIE,
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'httpOnly session cookie set by POST /api/v1/auth/login. Swagger UI sends it automatically on same-origin requests.',
      },
      'cookie',
    )
    .addTag('health', 'Liveness/readiness probes; no authentication required.')
    .addTag('auth', 'Session login, logout and current-user lookup.')
    .addTag('accounts', 'Broker accounts, permissions, credentials and equity.')
    .addTag('instruments', 'Instrument master, provider mappings and minute candles.')
    .addTag('universes', 'Instrument universes and their versions.')
    .addTag('strategies', 'Strategies, versions and effective configuration lookup.')
    .addTag('configuration', 'Versioned strategy, risk and system configuration.')
    .addTag('data', 'Reference ingestion, backfills, coverage, validation and catalog.')
    .addTag('processes', 'Background job runs, stages, metrics and events.')
    .addTag('audit', 'Immutable operator audit trail.')
    .addTag('settings', 'Runtime system settings.')
    .addTag('system', 'System status, dashboard overview and operational feeds.')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swagger),
  );

  app.enableShutdownHooks();
  await app.listen(Number(config.get('API_PORT', 8000)));
}

await bootstrap();
