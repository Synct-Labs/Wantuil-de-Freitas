import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { calcularStatusValidade } from '../itens/itens.service';
import { Resend } from 'resend';

type Severidade = 'INFO' | 'AVISO' | 'CRITICO';

@Injectable()
export class NotificacoesService {
  private logger = new Logger('Notificacoes');
  private resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  constructor(private prisma: PrismaService) {}

  // ═══════════ LEITURA ═══════════
  findAll(opcoes?: { apenasNaoLidas?: boolean; limite?: number }) {
    return this.prisma.notificacao.findMany({
      where: opcoes?.apenasNaoLidas ? { lida: false } : {},
      orderBy: { createdAt: 'desc' },
      take: opcoes?.limite ?? 50,
    });
  }

  async contarNaoLidas() {
    return { total: await this.prisma.notificacao.count({ where: { lida: false } }) };
  }

  marcarLida(id: string) {
    return this.prisma.notificacao.update({ where: { id }, data: { lida: true } });
  }

  async marcarTodasLidas() {
    const r = await this.prisma.notificacao.updateMany({ where: { lida: false }, data: { lida: true } });
    return { atualizadas: r.count };
  }

  async excluir(id: string) {
    await this.prisma.notificacao.delete({ where: { id } });
    return { ok: true };
  }

  // ═══════════ CRIACAO ═══════════
  /**
   * Cria notificacao se nao houver uma identica criada nas ultimas 24h.
   * Evita "spam" da mesma notificacao se o estado nao mudou.
   */
  async criarSeNova(tipo: string, titulo: string, mensagem: string, severidade: Severidade = 'INFO') {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicada = await this.prisma.notificacao.findFirst({
      where: { tipo, titulo, createdAt: { gte: ontem } },
    });
    if (duplicada) return null;

    const n = await this.prisma.notificacao.create({
      data: { tipo, titulo, mensagem: this.adicionarPrefixo(severidade, mensagem) },
    });
    this.logger.log(`[${severidade}] Notificacao criada: ${titulo}`);
    return n;
  }

  private adicionarPrefixo(severidade: Severidade, msg: string): string {
    const prefixos: Record<Severidade, string> = {
      INFO: 'ℹ ', AVISO: '⚠ ', CRITICO: '🔴 ',
    };
    return prefixos[severidade] + msg;
  }

  // ═══════════ VERIFICACAO COMPLETA (gera notificacoes pendentes do estado atual) ═══════════
  /**
   * Escaneia todos os itens e cria notificacoes pendentes para:
   * - Itens proximos do vencimento (≤30 dias)
   * - Itens no periodo adicional (vencidos ate 6 meses)
   * - Itens para descarte (>6 meses pos-vencimento)
   * - Itens abaixo do estoque minimo
   *
   * Idempotente: nao duplica notificacoes ja criadas nas ultimas 24h.
   */
  async verificarItens() {
    const itens = await this.prisma.item.findMany({
      where: { ativo: true },
      include: { setor: true },
    });

    let criadas = 0;
    for (const i of itens) {
      const status = calcularStatusValidade(i.dataValidade);
      const valFmt = i.dataValidade ? new Date(i.dataValidade).toLocaleDateString('pt-BR') : '';

      if (status === 'DESCARTE') {
        const n = await this.criarSeNova(
          'DESCARTE',
          `Descarte obrigatório: ${i.nome}`,
          `O item "${i.nome}" venceu há mais de 6 meses (${valFmt}) e deve ser descartado. Saldo atual: ${i.saldoAtual} ${i.unidadeMedida}.`,
          'CRITICO',
        );
        if (n) criadas++;
      } else if (status === 'ADICIONAL') {
        const n = await this.criarSeNova(
          'ADICIONAL',
          `Vencido (período adicional): ${i.nome}`,
          `O item "${i.nome}" venceu em ${valFmt} e está no período adicional de 6 meses. Saldo: ${i.saldoAtual} ${i.unidadeMedida}.`,
          'AVISO',
        );
        if (n) criadas++;
      } else if (status === 'PROXIMO') {
        const n = await this.criarSeNova(
          'PROXIMO_VENCIMENTO',
          `Próximo do vencimento: ${i.nome}`,
          `O item "${i.nome}" vence em ${valFmt}. Saldo: ${i.saldoAtual} ${i.unidadeMedida}.`,
          'AVISO',
        );
        if (n) criadas++;
      }

      if (Number(i.saldoAtual) <= Number(i.estoqueMinimo) && Number(i.estoqueMinimo) > 0) {
        const n = await this.criarSeNova(
          'ABAIXO_MINIMO',
          `Estoque abaixo do mínimo: ${i.nome}`,
          `O item "${i.nome}" está com saldo ${i.saldoAtual} ${i.unidadeMedida} (mínimo: ${i.estoqueMinimo}).`,
          'AVISO',
        );
        if (n) criadas++;
      }
    }

    this.logger.log(`Verificacao concluida: ${criadas} notificacoes criadas`);
    return { itensVerificados: itens.length, notificacoesCriadas: criadas };
  }

  // ═══════════ EMAIL ═══════════
  async diagnosticoEmail() {
    const tem_api_key = !!process.env.RESEND_API_KEY;
    const tem_from = !!process.env.EMAIL_FROM;
    const tem_destino = !!process.env.EMAIL_NOTIFICACOES;
    return {
      configurado: tem_api_key && tem_destino,
      detalhes: {
        RESEND_API_KEY: tem_api_key ? 'OK (configurada)' : 'FALTANDO — configure no Render',
        EMAIL_FROM: process.env.EMAIL_FROM || '(usando padrão Almoxarifado <onboarding@resend.dev>)',
        EMAIL_NOTIFICACOES: tem_destino ? process.env.EMAIL_NOTIFICACOES : 'FALTANDO — defina o e-mail destino',
      },
      observacao: !process.env.EMAIL_FROM
        ? 'Atenção: usando domínio padrão do Resend (onboarding@resend.dev). Esse domínio só envia para o e-mail da conta que criou no resend.com. Para enviar para outros destinatários, valide um domínio próprio em resend.com → Domains.'
        : null,
    };
  }

  async testarEmail() {
    const diag = await this.diagnosticoEmail();
    if (!diag.configurado) {
      return { sucesso: false, motivo: 'Configuracao incompleta', diagnostico: diag };
    }
    try {
      await this.enviarEmail(
        'Teste de notificação - Wantuil',
        `Olá!\n\nEste é um e-mail de teste do Sistema de Almoxarifado da Wantuil de Freitas.\n\nSe você está lendo esta mensagem, o envio de e-mails está funcionando corretamente.\n\nEnviado em: ${new Date().toLocaleString('pt-BR')}`,
      );
      return { sucesso: true, mensagem: `E-mail enviado para ${process.env.EMAIL_NOTIFICACOES}` };
    } catch (e: any) {
      return { sucesso: false, motivo: e.message, diagnostico: diag };
    }
  }

  private async enviarEmail(assunto: string, corpo: string) {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY nao configurada - email nao enviado');
      throw new Error('RESEND_API_KEY não configurada no servidor');
    }
    if (!process.env.EMAIL_NOTIFICACOES) {
      throw new Error('EMAIL_NOTIFICACOES não configurada no servidor');
    }
    await this.resend.emails.send({
      from: process.env.EMAIL_FROM || 'Almoxarifado <onboarding@resend.dev>',
      to: [process.env.EMAIL_NOTIFICACOES],
      subject: assunto,
      text: corpo,
    });
  }

  // ═══════════ CRON: Resumo semanal (sábado 08h Brasília = 11h UTC) ═══════════
  @Cron('0 11 * * 6', { name: 'resumo-semanal' })
  async resumoSemanal() {
    this.logger.log('Cron: gerando resumo semanal...');
    const itens = await this.prisma.item.findMany({ where: { ativo: true }, include: { setor: true } });
    const comStatus = itens.map((i) => ({ ...i, status: calcularStatusValidade(i.dataValidade) }));
    const proximos = comStatus.filter((i) => i.status === 'PROXIMO');
    const adicionais = comStatus.filter((i) => i.status === 'ADICIONAL');
    const descartes = comStatus.filter((i) => i.status === 'DESCARTE');
    const abaixoMinimo = comStatus.filter((i) => Number(i.saldoAtual) <= Number(i.estoqueMinimo) && Number(i.estoqueMinimo) > 0);

    const totalAlertas = proximos.length + adicionais.length + descartes.length + abaixoMinimo.length;
    const fmt = (i: any) =>
      `- ${i.nome} (saldo: ${i.saldoAtual} ${i.unidadeMedida}${i.dataValidade ? `, val: ${new Date(i.dataValidade).toLocaleDateString('pt-BR')}` : ''})`;

    const corpo = [
      `RESUMO SEMANAL DO ALMOXARIFADO`,
      `Data: ${new Date().toLocaleDateString('pt-BR')}`,
      ``,
      `Total de alertas: ${totalAlertas}`,
      ``,
      `>> Próximos ao vencimento (30 dias): ${proximos.length}`,
      ...proximos.map(fmt),
      ``,
      `>> Em período adicional (vencidos há até 6 meses): ${adicionais.length}`,
      ...adicionais.map(fmt),
      ``,
      `>> Para descarte (vencidos há mais de 6 meses): ${descartes.length}`,
      ...descartes.map(fmt),
      ``,
      `>> Abaixo do estoque mínimo: ${abaixoMinimo.length}`,
      ...abaixoMinimo.map(fmt),
    ].join('\n');

    await this.prisma.notificacao.create({
      data: {
        tipo: 'RESUMO_SEMANAL',
        titulo: `Resumo semanal — ${totalAlertas} ${totalAlertas === 1 ? 'item precisa' : 'itens precisam'} de atenção`,
        mensagem: corpo,
      },
    });

    try {
      await this.enviarEmail('Resumo Semanal do Almoxarifado', corpo);
      this.logger.log('Resumo semanal enviado por email');
    } catch (e: any) {
      this.logger.warn(`Resumo semanal: falha no email (${e.message}). Notificacao in-app criada normalmente.`);
    }
  }

  // ═══════════ CRON: Verificação diária (08h Brasília) ═══════════
  @Cron('0 11 * * *', { name: 'verificacao-diaria' })
  async verificacaoDiariaCron() {
    this.logger.log('Cron: verificacao diaria de itens...');
    await this.verificarItens();
    // Limpa notificacoes lidas com mais de 90 dias
    const noventa = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const removidas = await this.prisma.notificacao.deleteMany({
      where: { lida: true, createdAt: { lt: noventa } },
    });
    this.logger.log(`Limpeza: ${removidas.count} notificacoes antigas removidas`);
  }
}
