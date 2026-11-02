import './bootstrap-env.js';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { assertResearchMode } from '@ai-trading/configuration';
import { AppModule } from './app.module.js';

async function bootstrap() {
  assertResearchMode();

  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();
  Logger.log(
    'Worker started; research ingestion and maintenance jobs are registered.',
    'Bootstrap',
  );
}

await bootstrap();
