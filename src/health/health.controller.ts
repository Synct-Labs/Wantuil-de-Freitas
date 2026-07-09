import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health check publico (sem auth) para uptime monitoring.
 * Retorna 200 se servico operacional, 503 se algo critico falhou.
 *
 * Usado por:
 * - UptimeRobot ou similar (chama a cada 5 min)
 * - Load balancer (se houver)
 * - Pessoa olhando rapido se o sistema esta no ar
 */
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const checks: Record<string, any> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };

    // Testa conexao com banco (essencial pro sistema funcionar)
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch (e: any) {
      checks.database = 'falha';
      checks.status = 'degraded';
      throw new HttpException(
        { ...checks, erro: 'Banco de dados inacessivel' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Versao da aplicacao (lida do package.json em runtime)
    try {
      checks.version = require('../../package.json').version;
    } catch {}

    return checks;
  }

  /**
   * Endpoint minimo so para uptime check (responde sem nenhuma logica).
   * Usado quando o monitor so precisa saber se a app esta de pe.
   */
  @Get('ping')
  ping() {
    return { pong: true, t: Date.now() };
  }
}
