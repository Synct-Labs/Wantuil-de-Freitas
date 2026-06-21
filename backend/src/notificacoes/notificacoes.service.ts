import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { calcularStatusValidade } from '../itens/itens.service';
import { Resend } from 'resend';
import { fmtData, fmtDataHora } from '../common/data-fuso';

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
   * Escaneia LOTES ativos + ITENS abaixo do mínimo e cria notificações.
   * Validade é por lote; estoque mínimo é por item (agregado).
   * Idempotente: nao duplica notificacoes ja criadas nas ultimas 24h.
   */
  async verificarItens() {
    // 1. LOTES com problema de validade
    const lotes = await this.prisma.lote.findMany({
      where: { ativo: true, quantidadeAtual: { gt: 0 } },
      include: { item: true },
    });

    let criadas = 0;
    for (const l of lotes) {
      const status = calcularStatusValidade(l.dataValidade);
      const valFmt = l.dataValidade ? fmtData(l.dataValidade) : '';
      const nomeProduto = l.item.nome;

      if (status === 'DESCARTE') {
        const n = await this.criarSeNova(
          'DESCARTE',
          `Descarte obrigatório: ${nomeProduto} (lote ${l.codigoLote})`,
          `O lote ${l.codigoLote} de "${nomeProduto}" venceu há mais de 6 meses (${valFmt}). Saldo: ${l.quantidadeAtual} ${l.item.unidadeMedida}.`,
          'CRITICO',
        );
        if (n) criadas++;
      } else if (status === 'ADICIONAL') {
        const n = await this.criarSeNova(
          'ADICIONAL',
          `Vencido (período adicional): ${nomeProduto} (${l.codigoLote})`,
          `O lote ${l.codigoLote} de "${nomeProduto}" venceu em ${valFmt}. Saldo: ${l.quantidadeAtual} ${l.item.unidadeMedida}.`,
          'AVISO',
        );
        if (n) criadas++;
      } else if (status === 'PROXIMO') {
        const n = await this.criarSeNova(
          'PROXIMO_VENCIMENTO',
          `Próximo do vencimento: ${nomeProduto} (${l.codigoLote})`,
          `O lote ${l.codigoLote} de "${nomeProduto}" vence em ${valFmt}. Saldo: ${l.quantidadeAtual} ${l.item.unidadeMedida}.`,
          'AVISO',
        );
        if (n) criadas++;
      }
    }

    // 2. ITENS abaixo do estoque mínimo
    const itens = await this.prisma.item.findMany({
      where: { ativo: true, estoqueMinimo: { gt: 0 } },
    });
    for (const i of itens) {
      if (Number(i.saldoAtual) <= Number(i.estoqueMinimo)) {
        const n = await this.criarSeNova(
          'ABAIXO_MINIMO',
          `Estoque abaixo do mínimo: ${i.nome}`,
          `O item "${i.nome}" está com saldo ${i.saldoAtual} ${i.unidadeMedida} (mínimo: ${i.estoqueMinimo}).`,
          'AVISO',
        );
        if (n) criadas++;
      }
    }

    this.logger.log(`Verificacao concluida: ${criadas} notificacoes criadas (${lotes.length} lotes, ${itens.length} itens analisados)`);
    return { lotesVerificados: lotes.length, itensVerificados: itens.length, notificacoesCriadas: criadas };
  }

  // ═══════════ EMAIL ═══════════

  /**
   * Busca os destinatarios reais (usuarios ativos com receberEmail=true).
   * Substitui o EMAIL_NOTIFICACOES fixo (antigo).
   */
  private async destinatarios(): Promise<{ emails: string[]; nomes: string[] }> {
    const usuarios = await this.prisma.usuario.findMany({
      where: { ativo: true, receberEmail: true, email: { not: '' } },
      select: { nome: true, email: true },
    });
    return {
      emails: usuarios.map((u) => u.email),
      nomes: usuarios.map((u) => u.nome),
    };
  }

  async diagnosticoEmail() {
    const tem_api_key = !!process.env.RESEND_API_KEY;
    const dest = await this.destinatarios();
    const emailFrom = process.env.EMAIL_FROM || 'Almoxarifado <onboarding@resend.dev>';
    const usandoDominioPadrao = emailFrom.includes('onboarding@resend.dev');

    return {
      configurado: tem_api_key && dest.emails.length > 0,
      detalhes: {
        RESEND_API_KEY: tem_api_key ? 'OK (configurada)' : 'FALTANDO — configure no .env',
        EMAIL_FROM: emailFrom + (usandoDominioPadrao ? ' ⚠ domínio padrão (limitado)' : ' ✓'),
        DESTINATARIOS: dest.emails.length === 0
          ? 'FALTANDO — nenhum usuário ativo com "Receber e-mail" marcado'
          : `${dest.emails.length} usuário(s): ${dest.nomes.join(', ')}`,
      },
      observacao: usandoDominioPadrao
        ? 'ATENÇÃO: o domínio padrão "onboarding@resend.dev" só entrega para o e-mail da conta criada em resend.com. Outros destinatários são aceitos mas DESCARTADOS silenciosamente pelo Resend. Para enviar a todos, valide um domínio próprio (syncontrol.cloud) em resend.com → Domains e mude o EMAIL_FROM no .env.'
        : null,
    };
  }

  async testarEmail() {
    const diag = await this.diagnosticoEmail();
    if (!diag.configurado) {
      return { sucesso: false, motivo: 'Configuracao incompleta', diagnostico: diag };
    }
    try {
      const dest = await this.destinatarios();
      await this.enviarEmail(
        'Teste de notificação - Wantuil',
        `Olá!\n\nEste é um e-mail de teste do Sistema de Almoxarifado da Wantuil de Freitas.\n\nSe você está lendo esta mensagem, o envio de e-mails está funcionando corretamente.\n\nDestinatários cadastrados (${dest.emails.length}): ${dest.nomes.join(', ')}\n\nEnviado em: ${fmtDataHora(new Date())}`,
      );
      return {
        sucesso: true,
        mensagem: `E-mail enviado para ${dest.emails.length} usuário(s): ${dest.nomes.join(', ')}`,
      };
    } catch (e: any) {
      // O Resend devolve detalhes em e.response.body / e.response.statusCode.
      // Tenta extrair a mensagem mais util para diagnosticar.
      const detalhe = e?.response?.body?.message
        || e?.response?.body?.error
        || (typeof e?.response?.body === 'string' ? e.response.body : null)
        || e?.message
        || 'Erro desconhecido';
      const status = e?.response?.statusCode || e?.statusCode;
      const motivo = status ? `${detalhe} (HTTP ${status})` : detalhe;
      this.logger.error(`Falha no testarEmail: ${motivo}`);
      return { sucesso: false, motivo, diagnostico: diag };
    }
  }

  private async enviarEmail(assunto: string, corpo: string) {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY nao configurada - email nao enviado');
      throw new Error('RESEND_API_KEY não configurada no servidor');
    }
    const dest = await this.destinatarios();
    if (dest.emails.length === 0) {
      throw new Error('Nenhum usuário ativo com "Receber notificações" marcado');
    }
    const from = process.env.EMAIL_FROM || 'Almoxarifado <onboarding@resend.dev>';

    // Envia 1 email por destinatario.
    // Motivo: o Resend com dominio padrao (onboarding@resend.dev) so entrega
    // para o e-mail da conta. Usando BCC, ele aceita o envio (retorna 200)
    // mas descarta silenciosamente os destinatarios. Enviar 1 por 1 deixa
    // claro qual destinatario falhou, e funciona melhor com dominio proprio.
    const erros: string[] = [];
    let enviados = 0;
    for (const email of dest.emails) {
      try {
        await this.resend.emails.send({
          from,
          to: [email],
          subject: assunto,
          text: corpo,
        });
        enviados++;
      } catch (e: any) {
        const det = e?.response?.body?.message || e?.message || 'erro desconhecido';
        erros.push(`${email}: ${det}`);
        this.logger.error(`Falha ao enviar para ${email}: ${det}`);
      }
    }
    this.logger.log(`Email: ${enviados}/${dest.emails.length} enviados`);
    if (enviados === 0) {
      throw new Error(`Nenhum e-mail foi entregue. Detalhes: ${erros.join(' | ')}`);
    }
    if (erros.length > 0) {
      // Sucesso parcial. Loga mas nao falha.
      this.logger.warn(`Sucesso parcial: ${erros.length} falhas. ${erros.join(' | ')}`);
    }
  }

  // ═══════════ CRON: Resumo semanal (sábado 07h Cuiabá = 11h UTC) ═══════════
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
      `- ${i.nome} (saldo: ${i.saldoAtual} ${i.unidadeMedida}${i.dataValidade ? `, val: ${fmtData(i.dataValidade)}` : ''})`;

    const corpo = [
      `RESUMO SEMANAL DO ALMOXARIFADO`,
      `Data: ${fmtData(new Date())}`,
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

  // ═══════════ CRON: Verificação diária in-app (07h Cuiabá = 11h UTC) ═══════════
  // Apenas cria/atualiza notificacoes no sino (NAO envia email). Email so no sabado.
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
