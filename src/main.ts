import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Buffera logs ate o LoggerModule estar pronto
    bufferLogs: true,
  });

  // Aplica Pino como logger global
  app.useLogger(app.get(PinoLogger));

  app.enableCors({ origin: process.env.FRONTEND_URL || '*', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api', { exclude: ['health', 'health/ping'] });

  // ─── Swagger / OpenAPI ───────────────────────────────────────
  // Acessivel em /api/docs. Em producao, expor publicamente requer cautela
  // pois revela a estrutura completa da API. Pode ser protegido via Nginx
  // basic-auth ou whitelist de IP no servidor.
  const config = new DocumentBuilder()
    .setTitle('Sistema de Almoxarifado — Wantuil de Freitas')
    .setDescription(
      'API REST desenvolvida pela SYNCT Labs para a Associacao Espirita Wantuil de Freitas. ' +
      'Autenticacao via JWT (Bearer). Para obter token, use POST /api/auth/login.',
    )
    .setVersion('2.11.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('auth', 'Autenticacao e tokens de senha')
    .addTag('itens', 'CRUD de itens')
    .addTag('lotes', 'Lotes com validade')
    .addTag('movimentacoes', 'Entradas, saidas e descartes')
    .addTag('eventos', 'Eventos com reservas')
    .addTag('relatorios', 'Relatorios e exportacoes')
    .addTag('notificacoes', 'Notificacoes in-app e e-mail')
    .build();

  const documento = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documento, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'API Wantuil — SYNCT Labs',
  });

  const porta = process.env.PORT || 3000;
  await app.listen(porta);

  const logger = new Logger('Bootstrap');
  logger.log(`API rodando na porta ${porta}`);
  logger.log(`Documentacao: http://localhost:${porta}/api/docs`);
  logger.log(`Health check:  http://localhost:${porta}/health`);
}
bootstrap();
