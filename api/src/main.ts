import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule, ObserveInstrument } from './app.module.js';
import { validateEnvironment } from './config.js';
import { randomUUID } from 'node:crypto';

async function bootstrap() {
  const config = validateEnvironment();
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.enableCors();
  app.use((request: any, response: any, next: () => void) => { const correlationId = request.header('x-request-id') || randomUUID(); request.correlationId = correlationId; response.setHeader('x-request-id', correlationId); next(); });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(config.port);
}
await bootstrap();
