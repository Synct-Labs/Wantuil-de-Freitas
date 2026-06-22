import {
  BadRequestException, ConflictException, Injectable,
  Logger, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LotesService } from '../lotes/lotes.service';
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
import { fmtData, fmtDataHora } from '../common/data-fuso';

@Injectable()
export class EventosService {
  private logger = new Logger('EventosService');

  constructor(
    private prisma: PrismaService,
    private lotesService: LotesService,
  ) {}

  // ─── Listagem e detalhe ───────────────────────────────────────
  async findAll(filtros: { status?: string; ativo?: boolean }) {
    const where: any = { ativo: filtros.ativo ?? true };
    if (filtros.status) where.status = filtros.status;

    const eventos = await this.prisma.evento.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dataInicio: 'desc' }],
    });

    // Adiciona contagem de reservas e total de itens em cada evento
    const out: any[] = [];
    for (const ev of eventos) {
      const reservasCount = await this.prisma.reservaEvento.count({
        where: { eventoId: ev.id, ativa: true },
      });
      const saidasCount = await this.prisma.movimentacao.count({
        where: { eventoId: ev.id, tipo: 'SAIDA' },
      });
      out.push({ ...ev, reservasAtivas: reservasCount, saidasRealizadas: saidasCount });
    }
    return out;
  }

  async findById(id: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id },
      include: {
        reservas: {
          include: { lote: { include: { item: true } } },
          orderBy: { createdAt: 'asc' },
        },
        movimentacoes: {
          where: { tipo: 'SAIDA' },
          include: {
            itens: { include: { item: true, lote: true } },
            beneficiario: true, setor: true,
            usuario: { select: { id: true, nome: true } },
          },
          orderBy: { dataMovimentacao: 'desc' },
        },
      },
    });
    if (!evento) throw new NotFoundException('Evento nao encontrado');

    // Calcula quanto foi consumido de cada reserva (saidas vinculadas a este lote+evento)
    const reservasComConsumo = await Promise.all(evento.reservas.map(async (r) => {
      const consumido = await this.prisma.movimentacaoItem.aggregate({
        where: {
          loteId: r.loteId,
          movimentacao: { eventoId: id, tipo: 'SAIDA' },
        },
        _sum: { quantidade: true },
      });
      return {
        ...r,
        quantidadeConsumida: Number(consumido._sum.quantidade || 0),
        quantidadeRestante: Math.max(0, Number(r.quantidadeReservada) - Number(consumido._sum.quantidade || 0)),
      };
    }));

    return { ...evento, reservas: reservasComConsumo };
  }

  // ─── Criacao e edicao ─────────────────────────────────────────
  async criar(data: any) {
    if (!data.nome?.trim()) throw new BadRequestException('Nome do evento e obrigatorio');
    if (!data.dataInicio) throw new BadRequestException('Data de inicio e obrigatoria');

    return this.prisma.evento.create({
      data: {
        nome: data.nome.trim(),
        descricao: data.descricao?.trim() || null,
        dataInicio: new Date(data.dataInicio),
        dataFim: data.dataFim ? new Date(data.dataFim) : null,
        responsavel: data.responsavel?.trim() || null,
        observacao: data.observacao?.trim() || null,
        status: 'PLANEJADO',
      },
    });
  }

  async atualizar(id: string, data: any) {
    const ev = await this.prisma.evento.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Evento nao encontrado');
    if (ev.status === 'FINALIZADO' || ev.status === 'CANCELADO') {
      throw new BadRequestException(`Evento ${ev.status.toLowerCase()} nao pode ser editado`);
    }

    return this.prisma.evento.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome.trim() }),
        ...(data.descricao !== undefined && { descricao: data.descricao?.trim() || null }),
        ...(data.dataInicio !== undefined && { dataInicio: new Date(data.dataInicio) }),
        ...(data.dataFim !== undefined && { dataFim: data.dataFim ? new Date(data.dataFim) : null }),
        ...(data.responsavel !== undefined && { responsavel: data.responsavel?.trim() || null }),
        ...(data.observacao !== undefined && { observacao: data.observacao?.trim() || null }),
      },
    });
  }

  async excluir(id: string) {
    const ev = await this.prisma.evento.findUnique({
      where: { id },
      include: { _count: { select: { reservas: true, movimentacoes: true } } },
    });
    if (!ev) throw new NotFoundException('Evento nao encontrado');

    // Se ja tem reservas ou movimentacoes, soft delete
    if (ev._count.reservas > 0 || ev._count.movimentacoes > 0) {
      // Libera reservas ativas
      await this.prisma.reservaEvento.updateMany({
        where: { eventoId: id, ativa: true }, data: { ativa: false },
      });
      await this.prisma.evento.update({ where: { id }, data: { ativo: false } });
      return { mensagem: 'Evento desativado (possui histórico). Reservas liberadas.', desativado: true };
    }
    await this.prisma.evento.delete({ where: { id } });
    return { mensagem: 'Evento excluído permanentemente', excluido: true };
  }

  // ─── Mudanca de status ─────────────────────────────────────────
  async iniciar(id: string) {
    const ev = await this.prisma.evento.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Evento nao encontrado');
    if (ev.status !== 'PLANEJADO') {
      throw new BadRequestException(`Apenas eventos PLANEJADO podem ser iniciados (atual: ${ev.status})`);
    }
    return this.prisma.evento.update({ where: { id }, data: { status: 'EM_ANDAMENTO' } });
  }

  /**
   * Finaliza o evento e LIBERA as reservas que ainda nao foram consumidas
   * (o saldo volta a ser disponivel automaticamente).
   */
  async finalizar(id: string) {
    const ev = await this.prisma.evento.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Evento nao encontrado');
    if (ev.status === 'FINALIZADO' || ev.status === 'CANCELADO') {
      throw new BadRequestException(`Evento ja esta ${ev.status.toLowerCase()}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Libera todas as reservas ativas
      const liberadas = await tx.reservaEvento.updateMany({
        where: { eventoId: id, ativa: true }, data: { ativa: false },
      });
      const evAtualizado = await tx.evento.update({
        where: { id },
        data: { status: 'FINALIZADO', finalizadoEm: new Date() },
      });
      this.logger.log(`Evento ${id} finalizado: ${liberadas.count} reservas liberadas`);
      return { ...evAtualizado, reservasLiberadas: liberadas.count };
    });
  }

  async cancelar(id: string) {
    const ev = await this.prisma.evento.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Evento nao encontrado');
    if (ev.status === 'FINALIZADO' || ev.status === 'CANCELADO') {
      throw new BadRequestException(`Evento ja esta ${ev.status.toLowerCase()}`);
    }
    return this.prisma.$transaction(async (tx) => {
      const liberadas = await tx.reservaEvento.updateMany({
        where: { eventoId: id, ativa: true }, data: { ativa: false },
      });
      const evAtualizado = await tx.evento.update({
        where: { id }, data: { status: 'CANCELADO' },
      });
      return { ...evAtualizado, reservasLiberadas: liberadas.count };
    });
  }

  // ─── Reservas ─────────────────────────────────────────────────
  /**
   * Adiciona uma reserva: valida que ha saldo disponivel
   * (quantidadeAtual − outras reservas ativas) e cria/incrementa.
   */
  async adicionarReserva(eventoId: string, data: { loteId: string; quantidade: number; observacao?: string }) {
    const ev = await this.prisma.evento.findUnique({ where: { id: eventoId } });
    if (!ev) throw new NotFoundException('Evento nao encontrado');
    if (ev.status === 'FINALIZADO' || ev.status === 'CANCELADO') {
      throw new BadRequestException('Evento finalizado/cancelado nao aceita novas reservas');
    }
    if (!data.loteId) throw new BadRequestException('Lote obrigatorio');
    const qtd = Number(data.quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) throw new BadRequestException('Quantidade deve ser maior que zero');

    const lote = await this.prisma.lote.findUnique({
      where: { id: data.loteId }, include: { item: true },
    });
    if (!lote) throw new NotFoundException('Lote nao encontrado');
    if (!lote.ativo) throw new BadRequestException(`Lote ${lote.codigoLote} ja esgotado`);

    // Disponivel considerando reservas atuais (de OUTROS eventos)
    const reservaExistente = await this.prisma.reservaEvento.findUnique({
      where: { eventoId_loteId: { eventoId, loteId: data.loteId } },
    });
    const reservadoOutros = await this.prisma.reservaEvento.aggregate({
      where: { loteId: data.loteId, ativa: true, eventoId: { not: eventoId } },
      _sum: { quantidadeReservada: true },
    });
    const jaReservadoNesteEvento = reservaExistente?.ativa ? Number(reservaExistente.quantidadeReservada) : 0;
    const disponivelParaEsteEvento = Number(lote.quantidadeAtual) - Number(reservadoOutros._sum.quantidadeReservada || 0) - jaReservadoNesteEvento;

    if (qtd > disponivelParaEsteEvento) {
      throw new BadRequestException(
        `Saldo insuficiente no lote ${lote.codigoLote}: disponível ${disponivelParaEsteEvento} ${lote.item.unidadeMedida} (reservado em outros eventos: ${reservadoOutros._sum.quantidadeReservada || 0}).`,
      );
    }

    // Cria ou incrementa
    if (reservaExistente) {
      return this.prisma.reservaEvento.update({
        where: { id: reservaExistente.id },
        data: {
          quantidadeReservada: jaReservadoNesteEvento + qtd,
          ativa: true,
          ...(data.observacao !== undefined && { observacao: data.observacao?.trim() || null }),
        },
        include: { lote: { include: { item: true } } },
      });
    }
    return this.prisma.reservaEvento.create({
      data: {
        eventoId, loteId: data.loteId,
        quantidadeReservada: qtd,
        observacao: data.observacao?.trim() || null,
      },
      include: { lote: { include: { item: true } } },
    });
  }

  /**
   * Remove uma reserva (libera o saldo). Se ja teve consumo, ajusta.
   */
  async removerReserva(eventoId: string, reservaId: string) {
    const r = await this.prisma.reservaEvento.findUnique({ where: { id: reservaId } });
    if (!r || r.eventoId !== eventoId) throw new NotFoundException('Reserva nao encontrada');

    // Verifica se ja teve consumo (movimentacao saida vinculada ao evento+lote)
    const consumido = await this.prisma.movimentacaoItem.aggregate({
      where: { loteId: r.loteId, movimentacao: { eventoId, tipo: 'SAIDA' } },
      _sum: { quantidade: true },
    });
    const qtdConsumida = Number(consumido._sum.quantidade || 0);

    if (qtdConsumida > 0) {
      // Ajusta para refletir apenas o ja consumido
      return this.prisma.reservaEvento.update({
        where: { id: reservaId },
        data: { quantidadeReservada: qtdConsumida, ativa: false },
      });
    }

    // Sem consumo: pode remover
    await this.prisma.reservaEvento.delete({ where: { id: reservaId } });
    return { ok: true };
  }

  // ─── Relatorio PDF ─────────────────────────────────────────────
  async gerarRelatorioPdf(id: string): Promise<Buffer> {
    const ev = await this.findById(id);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));

    const COR_PRIMARIA = '#4A9BA4';
    const COR_AMARELO = '#F5C842';
    const COR_TEXTO_SUAVE = '#5A6B6E';

    const yInicial = doc.y;

    // Logo
    let xTexto = doc.page.margins.left + 12;
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
    doc.fontSize(16).font('Helvetica-Bold')
      .text('Wantuil de Freitas', xTexto, yInicial + 14);
    doc.fillColor(COR_TEXTO_SUAVE).fontSize(8).font('Helvetica')
      .text('Relatório de Evento · Cuiabá/MT', xTexto, yInicial + 36);

    doc.moveTo(doc.page.margins.left, yInicial + 70)
      .lineTo(doc.page.width - doc.page.margins.right, yInicial + 70)
      .strokeColor(COR_PRIMARIA).lineWidth(1.5).stroke();

    doc.y = yInicial + 84;

    // Titulo
    doc.fillColor('#1A2A2C').fontSize(18).font('Helvetica-Bold')
      .text(ev.nome.toUpperCase());
    doc.moveDown(0.2);

    const statusLabel: Record<string, string> = {
      PLANEJADO: 'Planejado', EM_ANDAMENTO: 'Em andamento',
      FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
    };
    const dataIni = fmtData(ev.dataInicio);
    const dataFim = ev.dataFim ? fmtData(ev.dataFim) : null;
    const info = [
      `Status: ${statusLabel[ev.status]}`,
      dataFim ? `Período: ${dataIni} a ${dataFim}` : `Data: ${dataIni}`,
      ev.responsavel ? `Responsável: ${ev.responsavel}` : null,
    ].filter(Boolean).join(' • ');

    doc.fillColor(COR_TEXTO_SUAVE).fontSize(10).font('Helvetica').text(info);
    if (ev.descricao) {
      doc.moveDown(0.6).fillColor('#1A2A2C').fontSize(10).font('Helvetica').text(ev.descricao);
    }

    doc.moveDown(1);

    // ─── KPIs ────────────────────────────────────────────────────
    const totalReservado = ev.reservas.reduce((s: number, r: any) => s + Number(r.quantidadeReservada), 0);
    const totalConsumido = ev.reservas.reduce((s: number, r: any) => s + Number(r.quantidadeConsumida), 0);
    const totalRestante = totalReservado - totalConsumido;

    const excedente = totalRestante < 0;
    const kpis = [
      { label: 'Itens reservados', val: ev.reservas.length, cor: '#1E3668' },
      { label: 'Total reservado', val: totalReservado.toFixed(0), cor: '#1E3668' },
      { label: 'Total consumido', val: totalConsumido.toFixed(0), cor: '#1E3668' },
      excedente
        ? { label: 'Excedente consumido', val: Math.abs(totalRestante).toFixed(0), cor: '#C03A2B' }
        : { label: 'Restante / liberado', val: totalRestante.toFixed(0), cor: '#1E3668' },
    ];

    const yKpi = doc.y;
    const wKpi = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 18) / 4;
    kpis.forEach((k, i) => {
      const x = doc.page.margins.left + i * (wKpi + 6);
      doc.roundedRect(x, yKpi, wKpi, 50, 5).fillAndStroke('#E8F3F4', '#D9E3E5');
      doc.fillColor(COR_TEXTO_SUAVE).fontSize(8).font('Helvetica')
        .text(k.label.toUpperCase(), x + 8, yKpi + 8, { width: wKpi - 16 });
      doc.fillColor(k.cor).fontSize(20).font('Helvetica-Bold')
        .text(String(k.val), x + 8, yKpi + 22, { width: wKpi - 16 });
    });
    doc.y = yKpi + 62;
    // Reseta cursor X para a margem esquerda (KPIs deixam o cursor a direita
    // com largura limitada, e isso quebra titulos de secao subsequentes).
    doc.x = doc.page.margins.left;

    // ─── Tabela: Reservas ────────────────────────────────────────
    if (ev.reservas.length > 0) {
      doc.x = doc.page.margins.left;
      const larguraTotal = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.fillColor(COR_PRIMARIA).fontSize(11).font('Helvetica-Bold')
        .text('RESERVAS', { width: larguraTotal, align: 'left', lineBreak: false });
      doc.moveDown(0.3);

      const cols = [
        { label: 'Lote', w: 90 }, { label: 'Item', w: 180 },
        { label: 'Reservado', w: 70 }, { label: 'Consumido', w: 70 }, { label: 'Restante', w: 70 },
      ];
      const totalW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const fator = totalW / cols.reduce((s, c) => s + c.w, 0);

      let yH = doc.y;
      doc.rect(doc.page.margins.left, yH, totalW, 18).fill('#1E3668');
      let xH = doc.page.margins.left;
      doc.fillColor('#FFF').font('Helvetica-Bold').fontSize(8);
      cols.forEach((c) => {
        doc.text(c.label.toUpperCase(), xH + 6, yH + 5, { width: c.w * fator - 12, lineBreak: false });
        xH += c.w * fator;
      });
      doc.y = yH + 18;

      doc.font('Helvetica').fontSize(8.5);
      ev.reservas.forEach((r: any, idx: number) => {
        const valores = [
          r.lote.codigoLote, r.lote.item.nome,
          `${r.quantidadeReservada} ${r.lote.item.unidadeMedida}`,
          `${r.quantidadeConsumida} ${r.lote.item.unidadeMedida}`,
          `${r.quantidadeRestante} ${r.lote.item.unidadeMedida}`,
        ];
        // Altura dinamica: mede o nome do item (que pode quebrar em 2 linhas)
        const hNome = doc.heightOfString(r.lote.item.nome, { width: cols[1].w * fator - 12 });
        const alturaL = Math.min(32, Math.max(16, Math.ceil(hNome) + 6));

        if (doc.y + alturaL > doc.page.height - 60) doc.addPage();
        const yL = doc.y;
        if (idx % 2 === 0) doc.rect(doc.page.margins.left, yL, totalW, alturaL).fill('#F4F7F8');
        let xC = doc.page.margins.left;
        doc.fillColor('#1A2A2C');
        valores.forEach((v, i) => {
          doc.text(v, xC + 6, yL + 4, {
            width: cols[i].w * fator - 12,
            height: alturaL - 4,
            ellipsis: true,
          });
          xC += cols[i].w * fator;
        });
        doc.y = yL + alturaL;
      });
      doc.moveDown(0.6);
    }

    // ─── Tabela: Saidas vinculadas ────────────────────────────────
    if (ev.movimentacoes.length > 0) {
      if (doc.y > doc.page.height - 180) doc.addPage();
      doc.x = doc.page.margins.left;
      const larguraTotal = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.fillColor(COR_PRIMARIA).fontSize(11).font('Helvetica-Bold')
        .text('SAÍDAS REALIZADAS', { width: larguraTotal, align: 'left', lineBreak: false });
      doc.moveDown(0.3);

      const cols = [
        { label: 'Data', w: 60 }, { label: 'Lote', w: 90 }, { label: 'Item', w: 160 },
        { label: 'Qtd.', w: 50 }, { label: 'Responsável', w: 120 },
      ];
      const totalW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const fator = totalW / cols.reduce((s, c) => s + c.w, 0);

      let yH = doc.y;
      doc.rect(doc.page.margins.left, yH, totalW, 18).fill('#1E3668');
      let xH = doc.page.margins.left;
      doc.fillColor('#FFF').font('Helvetica-Bold').fontSize(8);
      cols.forEach((c) => {
        doc.text(c.label.toUpperCase(), xH + 6, yH + 5, { width: c.w * fator - 12, lineBreak: false });
        xH += c.w * fator;
      });
      doc.y = yH + 18;

      doc.font('Helvetica').fontSize(8.5);
      let zebra = 0;
      ev.movimentacoes.forEach((mov: any) => {
        const data = fmtData(mov.dataMovimentacao);
        const resp = mov.usuario?.nome || '—';
        mov.itens.forEach((mi: any) => {
          const valores = [
            data, mi.lote?.codigoLote || '—', mi.item.nome,
            `${mi.quantidade} ${mi.item.unidadeMedida}`, resp,
          ];
          // Altura dinamica: pelo nome do item (col 2)
          const hNome = doc.heightOfString(mi.item.nome, { width: cols[2].w * fator - 12 });
          const alturaL = Math.min(32, Math.max(16, Math.ceil(hNome) + 6));

          if (doc.y + alturaL > doc.page.height - 60) doc.addPage();
          const yL = doc.y;
          if (zebra++ % 2 === 0) doc.rect(doc.page.margins.left, yL, totalW, alturaL).fill('#F4F7F8');
          let xC = doc.page.margins.left;
          doc.fillColor('#1A2A2C');
          valores.forEach((v, i) => {
            doc.text(String(v), xC + 6, yL + 4, {
              width: cols[i].w * fator - 12,
              height: alturaL - 4,
              ellipsis: true,
            });
            xC += cols[i].w * fator;
          });
          doc.y = yL + alturaL;
        });
      });
    }

    // Rodape
    const yR = doc.page.height - doc.page.margins.bottom + 20;
    doc.fontSize(7.5).fillColor('#8A9598').font('Helvetica')
      .text(`Emitido em ${fmtDataHora(new Date())} · Associação Espírita Wantuil de Freitas`,
        doc.page.margins.left, yR, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center',
        });

    doc.end();
    return done;
  }
}
