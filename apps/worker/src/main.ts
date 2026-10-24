import './bootstrap-env.js';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { assertOfflineMode } from '@ai-trading/configuration';
import { AppModule } from './app.module.js';

async function bootstrap() {
  assertOfflineMode();

  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();
  Logger.log('Worker started; offline jobs are registered.', 'Bootstrap');
}

await bootstrap();
