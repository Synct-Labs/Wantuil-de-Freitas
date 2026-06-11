import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { calcularStatusValidade } from '../itens/itens.service';
import { Resend } from 'resend';

@Injectable()
export class NotificacoesService {
  private logger = new Logger('Notificacoes');
  private resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.notificacao.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  marcarLida(id: string) {
    return this.prisma.notificacao.update({ where: { id }, data: { lida: true } });
  }

  // ── RESUMO SEMANAL: todo sabado as 08h00 (horario de Brasilia / UTC-3 = 11h UTC) ──
  @Cron('0 11 * * 6', { name: 'resumo-semanal' })
  async resumoSemanal() {
    this.logger.log('Gerando resumo semanal...');
    const itens = await this.prisma.item.findMany({ where: { ativo: true }, include: { setor: true } });

    const comStatus = itens.map((i) => ({ ...i, status: calcularStatusValidade(i.dataValidade) }));
    const proximos = comStatus.filter((i) => i.status === 'PROXIMO');
    const adicionais = comStatus.filter((i) => i.status === 'ADICIONAL');
    const descartes = comStatus.filter((i) => i.status === 'DESCARTE');
    const abaixoMinimo = comStatus.filter((i) => Number(i.saldoAtual) <= Number(i.estoqueMinimo));

    const fmt = (i: any) =>
      `- ${i.nome} (saldo: ${i.saldoAtual} ${i.unidadeMedida}${i.dataValidade ? `, val: ${new Date(i.dataValidade).toLocaleDateString('pt-BR')}` : ''})`;

    const corpo = [
      `RESUMO SEMANAL DO ALMOXARIFADO - ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      `ITENS PROXIMOS AO VENCIMENTO (30 dias): ${proximos.length}`,
      ...proximos.map(fmt),
      '',
      `ITENS NO PERIODO ADICIONAL (vencidos ha menos de 6 meses): ${adicionais.length}`,
      ...adicionais.map(fmt),
      '',
      `ITENS PARA DESCARTE (vencidos ha mais de 6 meses): ${descartes.length}`,
      ...descartes.map(fmt),
      '',
      `ITENS ABAIXO DO ESTOQUE MINIMO: ${abaixoMinimo.length}`,
      ...abaixoMinimo.map(fmt),
    ].join('\n');

    await this.prisma.notificacao.create({
      data: {
        tipo: 'RESUMO_SEMANAL',
        titulo: `Resumo semanal — ${proximos.length + adicionais.length + descartes.length + abaixoMinimo.length} itens precisam de atencao`,
        mensagem: corpo,
      },
    });

    await this.enviarEmail('Resumo Semanal do Almoxarifado', corpo);
    this.logger.log('Resumo semanal enviado');
  }

  // ── VERIFICACAO DIARIA: detecta itens que mudaram de estado (vencido/descarte) ──
  @Cron('0 9 * * *', { name: 'verificacao-diaria' })
  async verificacaoDiaria() {
    const itens = await this.prisma.item.findMany({ where: { ativo: true, dataValidade: { not: null } } });
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    for (const item of itens) {
      const val = new Date(item.dataValidade); val.setHours(0, 0, 0, 0);
      const seisMeses = new Date(val); seisMeses.setMonth(seisMeses.getMonth() + 6);

      const venceuHoje = val.getTime() === hoje.getTime() - 86400000 || val.getTime() === hoje.getTime();
      const descarteHoje = seisMeses.getTime() === hoje.getTime() - 86400000 || seisMeses.getTime() === hoje.getTime();

      if (venceuHoje) {
        const msg = `O item "${item.nome}" passou da data de validade (${val.toLocaleDateString('pt-BR')}). Entrou no periodo adicional de 6 meses.`;
        await this.prisma.notificacao.create({
          data: { tipo: 'VENCIDO', titulo: `Item vencido: ${item.nome}`, mensagem: msg },
        });
        await this.enviarEmail(`Item vencido: ${item.nome}`, msg);
      }

      if (descarteHoje) {
        const msg = `O item "${item.nome}" completou 6 meses apos o vencimento e deve ser DESCARTADO.`;
        await this.prisma.notificacao.create({
          data: { tipo: 'DESCARTE', titulo: `Descarte obrigatorio: ${item.nome}`, mensagem: msg },
        });
        await this.enviarEmail(`DESCARTE obrigatorio: ${item.nome}`, msg);
      }
    }
  }

  private async enviarEmail(assunto: string, corpo: string) {
    if (!this.resend) { this.logger.warn('RESEND_API_KEY nao configurada — email nao enviado'); return; }
    try {
      await this.resend.emails.send({
        from: process.env.EMAIL_FROM || 'Almoxarifado <onboarding@resend.dev>',
        to: [process.env.EMAIL_NOTIFICACOES],
        subject: assunto,
        text: corpo,
      });
    } catch (e) {
      this.logger.error(`Falha ao enviar email: ${e.message}`);
    }
  }
}
