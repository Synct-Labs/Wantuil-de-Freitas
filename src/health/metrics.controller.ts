import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Metricas internas do sistema. Restrito a MASTER pois expoe
 * contagem total de registros e estado da operacao.
 */
@Controller('metrics')
@UseGuards(JwtGuard, PerfilGuard)
@Perfis('MASTER')
export class MetricsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async metricas() {
    const [
      usuariosAtivos,
      itensAtivos,
      lotesAtivos,
      movimentacoesTotal,
      movimentacoesHoje,
      eventosAtivos,
    ] = await Promise.all([
      this.prisma.usuario.count({ where: { ativo: true } }),
      this.prisma.item.count({ where: { ativo: true } }),
      this.prisma.lote.count({ where: { ativo: true } }),
      this.prisma.movimentacao.count(),
      this.prisma.movimentacao.count({
        where: { dataMovimentacao: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      this.prisma.evento.count({
        where: { status: { in: ['PLANEJADO', 'EM_ANDAMENTO'] } },
      }),
    ]);

    const memUsage = process.memoryUsage();

    return {
      timestamp: new Date().toISOString(),
      sistema: {
        uptime_segundos: Math.floor(process.uptime()),
        node_version: process.version,
        memoria_mb: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heap_usado: Math.round(memUsage.heapUsed / 1024 / 1024),
          heap_total: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
      },
      banco: {
        usuarios_ativos: usuariosAtivos,
        itens_ativos: itensAtivos,
        lotes_ativos: lotesAtivos,
        movimentacoes_total: movimentacoesTotal,
        movimentacoes_hoje: movimentacoesHoje,
        eventos_ativos: eventosAtivos,
      },
    };
  }
}
