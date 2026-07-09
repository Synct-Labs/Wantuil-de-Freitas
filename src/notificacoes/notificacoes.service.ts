import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { calcularStatusValidade } from '../itens/itens.service';
import { calcularStatusLote } from '../lotes/lotes.service';
import { Resend } from 'resend';
import { fmtData, fmtDataHora } from '../common/data-fuso';
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';

type Severidade = 'INFO' | 'AVISO' | 'CRITICO';

interface Anexo {
  filename: string;
  content: Buffer;
}

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
      const resultado = await this.enviarEmail(
        'Teste de notificação - Wantuil',
        `Olá!\n\nEste é um e-mail de teste do Sistema de Almoxarifado da Wantuil de Freitas.\n\nSe você está lendo esta mensagem, o envio de e-mails está funcionando corretamente.\n\nDestinatários cadastrados (${dest.emails.length}): ${dest.nomes.join(', ')}\n\nEnviado em: ${fmtDataHora(new Date())}`,
      );

      // Sucesso total
      if (resultado.falhas.length === 0) {
        return {
          sucesso: true,
          mensagem: `E-mail enviado com sucesso para ${resultado.enviados}/${resultado.total} destinatário(s): ${resultado.sucessos.join(', ')}`,
          detalhes: resultado,
        };
      }

      // Sucesso parcial
      const falhasDetalhe = resultado.falhas.map(f => `${f.email}: ${f.motivo}`).join(' | ');
      return {
        sucesso: false, // marca como falha para chamar atencao do admin
        parcial: true,
        mensagem: `Entrega parcial: ${resultado.enviados}/${resultado.total} enviados. Sucesso: ${resultado.sucessos.join(', ')}. Falhas: ${falhasDetalhe}`,
        motivo: falhasDetalhe,
        detalhes: resultado,
        diagnostico: diag,
      };
    } catch (e: any) {
      const motivo = e?.message || 'Erro desconhecido';
      this.logger.error(`Falha no testarEmail: ${motivo}`);
      return { sucesso: false, motivo, diagnostico: diag };
    }
  }

  /**
   * Envia o email para todos os destinatarios ativos.
   * Retorna detalhes de cada envio (sucesso/falha) em vez de jogar excecao em
   * sucesso parcial. Lanca excecao apenas se *nenhum* email foi entregue.
   */
  private async enviarEmail(assunto: string, corpo: string, anexos?: Anexo[]): Promise<{
    enviados: number;
    total: number;
    sucessos: string[];
    falhas: { email: string; motivo: string }[];
  }> {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY nao configurada - email nao enviado');
      throw new Error('RESEND_API_KEY não configurada no servidor');
    }
    const dest = await this.destinatarios();
    if (dest.emails.length === 0) {
      throw new Error('Nenhum usuário ativo com "Receber notificações" marcado');
    }
    const from = process.env.EMAIL_FROM || 'Almoxarifado <onboarding@resend.dev>';

    const attachmentsResend = anexos?.map((a) => ({
      filename: a.filename,
      content: a.content.toString('base64'),
    }));

    const sucessos: string[] = [];
    const falhas: { email: string; motivo: string }[] = [];

    for (const email of dest.emails) {
      try {
        await this.resend.emails.send({
          from,
          to: [email],
          subject: assunto,
          text: corpo,
          ...(attachmentsResend && attachmentsResend.length > 0 && { attachments: attachmentsResend }),
        });
        sucessos.push(email);
      } catch (e: any) {
        const det = e?.response?.body?.message
          || e?.response?.body?.error
          || (typeof e?.response?.body === 'string' ? e.response.body : null)
          || e?.message
          || 'erro desconhecido';
        const status = e?.response?.statusCode || e?.statusCode;
        const motivo = status ? `${det} (HTTP ${status})` : det;
        falhas.push({ email, motivo });
        this.logger.error(`Falha ao enviar para ${email}: ${motivo}`);
      }
    }

    this.logger.log(`Email: ${sucessos.length}/${dest.emails.length} enviados`);

    if (sucessos.length === 0) {
      const detalhes = falhas.map(f => `${f.email}: ${f.motivo}`).join(' | ');
      throw new Error(`Nenhum e-mail foi entregue. Detalhes: ${detalhes}`);
    }

    return { enviados: sucessos.length, total: dest.emails.length, sucessos, falhas };
  }

  // ═══════════ CRON: Resumo semanal (sábado 07h Cuiabá = 11h UTC) ═══════════
  @Cron('0 11 * * 6', { name: 'resumo-semanal' })
  async resumoSemanal() {
    this.logger.log('Cron: gerando resumo semanal...');

    // Levantamento: usa lotes para validade e itens para abaixo do minimo.
    // Itens desativados sao excluidos do resumo (estao fora de circulacao).
    const lotes = await this.prisma.lote.findMany({
      where: { ativo: true, item: { ativo: true } },
      include: { item: { include: { setor: true, categoria: true } } },
    });
    const lotesProximos = lotes.filter((l) => calcularStatusLote(l.dataValidade) === 'PROXIMO');
    const lotesAdicional = lotes.filter((l) => calcularStatusLote(l.dataValidade) === 'ADICIONAL');
    const lotesDescarte = lotes.filter((l) => calcularStatusLote(l.dataValidade) === 'DESCARTE');

    const itensAbaixoMinimo = await this.prisma.item.findMany({
      where: { ativo: true, estoqueMinimo: { gt: 0 } },
      include: { setor: true, categoria: true },
    });
    const abaixoMinimo = itensAbaixoMinimo.filter(
      (i) => Number(i.saldoAtual) <= Number(i.estoqueMinimo),
    );

    const totalAlertas = lotesProximos.length + lotesAdicional.length + lotesDescarte.length + abaixoMinimo.length;

    // Corpo de texto (resumo curto, mensagem do email)
    const corpoEmail = [
      `Olá!`,
      ``,
      `Segue o resumo semanal do almoxarifado da Wantuil de Freitas.`,
      ``,
      `Total de alertas: ${totalAlertas}`,
      `• Próximos ao vencimento (até 30 dias): ${lotesProximos.length} lote(s)`,
      `• Em período adicional (vencidos há até 6 meses): ${lotesAdicional.length} lote(s)`,
      `• Para descarte (vencidos há mais de 6 meses): ${lotesDescarte.length} lote(s)`,
      `• Itens abaixo do estoque mínimo: ${abaixoMinimo.length}`,
      ``,
      `O detalhamento completo está no PDF anexo.`,
      ``,
      `--`,
      `Sistema de Almoxarifado · Associação Espírita Wantuil de Freitas`,
      `Cuiabá/MT · ${fmtDataHora(new Date())}`,
    ].join('\n');

    // Notificacao in-app (mensagem curta)
    await this.prisma.notificacao.create({
      data: {
        tipo: 'RESUMO_SEMANAL',
        titulo: `Resumo semanal — ${totalAlertas} ${totalAlertas === 1 ? 'item precisa' : 'itens precisam'} de atenção`,
        mensagem: corpoEmail,
      },
    });

    try {
      // Gera o PDF anexo e envia
      const pdfBuffer = await this.gerarResumoSemanalPdf({
        totalAlertas, lotesProximos, lotesAdicional, lotesDescarte, abaixoMinimo,
      });
      const dataArquivo = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await this.enviarEmail(
        `Resumo Semanal do Almoxarifado — ${fmtData(new Date())}`,
        corpoEmail,
        [{ filename: `resumo-semanal-${dataArquivo}.pdf`, content: pdfBuffer }],
      );
      this.logger.log(`Resumo semanal enviado por email (${totalAlertas} alertas)`);
    } catch (e: any) {
      this.logger.warn(`Resumo semanal: falha no email (${e.message}). Notificacao in-app criada normalmente.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PDF do resumo semanal — formato similar aos relatorios oficiais
  // ─────────────────────────────────────────────────────────────────
  private async gerarResumoSemanalPdf(dados: {
    totalAlertas: number;
    lotesProximos: any[];
    lotesAdicional: any[];
    lotesDescarte: any[];
    abaixoMinimo: any[];
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));

    const COR_PRIMARIA = '#4A9BA4';
    const COR_AMARELO = '#F5C842';
    const COR_AZUL = '#1E3668';
    const COR_TEXTO_SUAVE = '#5A6B6E';
    const COR_VERMELHO = '#C03A2B';
    const COR_LARANJA = '#E0833A';

    const yInicial = doc.y;
    let xTexto = doc.page.margins.left + 12;

    // Logo
    try {
      const candidatos = [
        path.join(__dirname, '..', '..', 'assets', 'logo-wantuil.jpg'),
        path.join(__dirname, '..', '..', '..', 'assets', 'logo-wantuil.jpg'),
        path.join(process.cwd(), 'assets', 'logo-wantuil.jpg'),
        path.join(process.cwd(), 'dist', 'assets', 'logo-wantuil.jpg'),
      ];
      const logoPath = candidatos.find((p) => fs.existsSync(p));
      if (logoPath) {
        doc.image(logoPath, doc.page.margins.left, yInicial, { width: 56, height: 56 });
        xTexto = doc.page.margins.left + 68;
      }
    } catch {}

    doc.rect(xTexto - 8, yInicial, 4, 60).fill(COR_AMARELO);
    doc.fillColor(COR_PRIMARIA).fontSize(9).font('Helvetica-Bold')
      .text('ASSOCIAÇÃO ESPÍRITA', xTexto, yInicial + 2);
    doc.fontSize(16).font('Helvetica-Bold').text('Wantuil de Freitas', xTexto, yInicial + 14);
    doc.fillColor(COR_TEXTO_SUAVE).fontSize(8).font('Helvetica')
      .text('Resumo Semanal · Cuiabá/MT', xTexto, yInicial + 36);

    doc.moveTo(doc.page.margins.left, yInicial + 70)
      .lineTo(doc.page.width - doc.page.margins.right, yInicial + 70)
      .strokeColor(COR_PRIMARIA).lineWidth(1.5).stroke();
    doc.y = yInicial + 84;

    // Titulo
    doc.fillColor('#1A2A2C').fontSize(18).font('Helvetica-Bold').text('RESUMO SEMANAL');
    doc.fillColor(COR_TEXTO_SUAVE).fontSize(10).font('Helvetica')
      .text(`Gerado em ${fmtDataHora(new Date())}`);
    doc.moveDown(0.8);

    // KPIs
    const kpis = [
      { label: 'Total de alertas', val: dados.totalAlertas, cor: dados.totalAlertas === 0 ? '#3F9D5A' : COR_AZUL },
      { label: 'Próx. vencimento', val: dados.lotesProximos.length, cor: COR_LARANJA },
      { label: 'Período adicional', val: dados.lotesAdicional.length, cor: COR_LARANJA },
      { label: 'Para descarte', val: dados.lotesDescarte.length, cor: COR_VERMELHO },
      { label: 'Abaixo do mínimo', val: dados.abaixoMinimo.length, cor: COR_VERMELHO },
    ];

    const yKpi = doc.y;
    const totalW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const wKpi = (totalW - 4 * 6) / 5;
    kpis.forEach((k, i) => {
      const x = doc.page.margins.left + i * (wKpi + 6);
      doc.roundedRect(x, yKpi, wKpi, 56, 5).fillAndStroke('#F4F7F8', '#D9E3E5');
      doc.fillColor(COR_TEXTO_SUAVE).fontSize(7).font('Helvetica')
        .text(k.label.toUpperCase(), x + 8, yKpi + 10, { width: wKpi - 16 });
      doc.fillColor(k.cor).fontSize(22).font('Helvetica-Bold')
        .text(String(k.val), x + 8, yKpi + 24, { width: wKpi - 16 });
    });
    doc.y = yKpi + 70;
    // Reseta cursor X para a margem esquerda. Apos desenhar os KPIs (que usam
    // width limitado de cada card), o PDFKit mantem doc.x e a largura "presa"
    // no ultimo KPI a direita, fazendo titulos de secao subsequentes
    // quebrarem em uma coluna estreita no canto direito.
    doc.x = doc.page.margins.left;

    // ─── Caso sem alertas ─────────────────────────────────────────
    if (dados.totalAlertas === 0) {
      doc.fillColor('#3F9D5A').fontSize(13).font('Helvetica-Bold')
        .text('✓ Nenhum item precisa de atenção esta semana.', { align: 'center' });
      doc.moveDown(0.4);
      doc.fillColor(COR_TEXTO_SUAVE).fontSize(10).font('Helvetica')
        .text('O estoque está em conformidade — sem produtos próximos ao vencimento, em período adicional, para descarte ou abaixo do mínimo.',
          { align: 'center', width: totalW });
    } else {
      // Tabelas de detalhe
      const desenharTabela = (titulo: string, items: any[], cor: string, montaLinha: (i: any) => string[]) => {
        if (items.length === 0) return;
        if (doc.y > doc.page.height - 120) doc.addPage();
        doc.x = doc.page.margins.left;
        doc.fillColor(cor).fontSize(11).font('Helvetica-Bold')
          .text(titulo.toUpperCase(), { width: totalW, align: 'left', lineBreak: false });
        doc.moveDown(0.3);

        // Header
        const cols = [
          { label: 'Lote/Item', w: 0.30 },
          { label: 'Produto', w: 0.32 },
          { label: 'Setor', w: 0.18 },
          { label: 'Detalhe', w: 0.20 },
        ];
        let yH = doc.y;
        doc.rect(doc.page.margins.left, yH, totalW, 18).fill(COR_AZUL);
        let xH = doc.page.margins.left;
        doc.fillColor('#FFF').font('Helvetica-Bold').fontSize(8);
        cols.forEach((c) => {
          doc.text(c.label.toUpperCase(), xH + 6, yH + 5, { width: totalW * c.w - 12, lineBreak: false });
          xH += totalW * c.w;
        });
        doc.y = yH + 18;

        doc.font('Helvetica').fontSize(8.5);
        items.forEach((it, idx) => {
          const valores = montaLinha(it);
          const hMax = Math.max(...valores.map((v, i) =>
            doc.heightOfString(v, { width: totalW * cols[i].w - 12 }),
          ));
          const alturaL = Math.min(32, Math.max(16, Math.ceil(hMax) + 6));
          if (doc.y + alturaL > doc.page.height - 60) doc.addPage();
          const yL = doc.y;
          if (idx % 2 === 0) doc.rect(doc.page.margins.left, yL, totalW, alturaL).fill('#F4F7F8');
          let xC = doc.page.margins.left;
          doc.fillColor('#1A2A2C');
          valores.forEach((v, i) => {
            doc.text(v, xC + 6, yL + 4, {
              width: totalW * cols[i].w - 12,
              height: alturaL - 4,
              ellipsis: true,
            });
            xC += totalW * cols[i].w;
          });
          doc.y = yL + alturaL;
        });
        doc.moveDown(0.6);
      };

      desenharTabela('Para descarte (vencidos há mais de 6 meses)', dados.lotesDescarte, COR_VERMELHO, (l) => [
        l.codigoLote,
        l.item.nome,
        l.item.setor?.nome || '—',
        `Saldo: ${l.quantidadeAtual} ${l.item.unidadeMedida} · Val: ${fmtData(l.dataValidade)}`,
      ]);

      desenharTabela('Em período adicional (vencidos há até 6 meses)', dados.lotesAdicional, COR_LARANJA, (l) => [
        l.codigoLote,
        l.item.nome,
        l.item.setor?.nome || '—',
        `Saldo: ${l.quantidadeAtual} ${l.item.unidadeMedida} · Val: ${fmtData(l.dataValidade)}`,
      ]);

      desenharTabela('Próximos ao vencimento (até 30 dias)', dados.lotesProximos, COR_LARANJA, (l) => [
        l.codigoLote,
        l.item.nome,
        l.item.setor?.nome || '—',
        `Saldo: ${l.quantidadeAtual} ${l.item.unidadeMedida} · Val: ${fmtData(l.dataValidade)}`,
      ]);

      desenharTabela('Itens abaixo do estoque mínimo', dados.abaixoMinimo, COR_VERMELHO, (i) => [
        i.codigoInterno || '—',
        i.nome,
        i.setor?.nome || '—',
        `Saldo: ${i.saldoAtual} ${i.unidadeMedida} · Mín: ${i.estoqueMinimo}`,
      ]);
    }

    // Rodape
    const yR = doc.page.height - doc.page.margins.bottom + 20;
    doc.fontSize(7.5).fillColor('#8A9598').font('Helvetica')
      .text(`Sistema de Almoxarifado · Associação Espírita Wantuil de Freitas · Emitido em ${fmtDataHora(new Date())}`,
        doc.page.margins.left, yR, { width: totalW, align: 'center' });

    doc.end();
    return done;
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
