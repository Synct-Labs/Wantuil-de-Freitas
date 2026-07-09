import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseDataLocal } from '../common/data-fuso';

/**
 * Calcula o status de validade de um lote baseado na data atual.
 * Mesma lógica usada para itens, agora aplicada por lote.
 */
export function calcularStatusLote(dataValidade: Date | null | undefined): string {
  if (!dataValidade) return 'VIGENTE';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const val = parseDataLocal(dataValidade) || new Date(); val.setHours(0, 0, 0, 0);

  const seisMesesDepois = new Date(val);
  seisMesesDepois.setMonth(seisMesesDepois.getMonth() + 6);
  const trintaDiasAntes = new Date(val);
  trintaDiasAntes.setDate(trintaDiasAntes.getDate() - 30);

  if (hoje > seisMesesDepois) return 'DESCARTE';
  if (hoje > val) return 'ADICIONAL';
  if (hoje >= trintaDiasAntes) return 'PROXIMO';
  return 'VIGENTE';
}

/**
 * Gera o proximo codigo de lote no formato L-AAAAMMDD-NNNN.
 * Sequencial por dia: reseta o contador a cada dia.
 */
async function gerarProximoCodigoLote(prisma: PrismaService): Promise<string> {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const prefixo = `L-${ano}${mes}${dia}-`;

  const ultimo = await prisma.lote.findFirst({
    where: { codigoLote: { startsWith: prefixo } },
    orderBy: { codigoLote: 'desc' },
    select: { codigoLote: true },
  });

  let proximo = 1;
  if (ultimo) {
    const match = ultimo.codigoLote.match(/-(\d+)$/);
    if (match) proximo = parseInt(match[1], 10) + 1;
  }
  return `${prefixo}${String(proximo).padStart(4, '0')}`;
}

@Injectable()
export class LotesService {
  private logger = new Logger('LotesService');

  constructor(private prisma: PrismaService) {}

  // ─── Consultas ───────────────────────────────────────────────
  async findAll(filtros: { itemId?: string; ativo?: boolean; busca?: string; incluirItensInativos?: boolean }) {
    const where: any = {};
    if (filtros.ativo !== undefined) where.ativo = filtros.ativo;
    if (filtros.itemId) where.itemId = filtros.itemId;

    // Por padrao, oculta lotes cujo item esteja desativado (item fora de
    // circulacao por decisao do admin). Backoffice pode pedir explicitamente
    // com incluirItensInativos=true.
    if (!filtros.incluirItensInativos) {
      where.item = { ativo: true };
    }

    if (filtros.busca) {
      where.OR = [
        { codigoLote: { contains: filtros.busca, mode: 'insensitive' } },
        { item: { nome: { contains: filtros.busca, mode: 'insensitive' } } },
      ];
    }

    const lotes = await this.prisma.lote.findMany({
      where,
      include: { item: true, doador: true, setor: true },
      orderBy: [{ dataValidade: 'asc' }, { createdAt: 'desc' }],
    });

    return lotes.map(l => ({
      ...l,
      statusValidade: calcularStatusLote(l.dataValidade),
    }));
  }

  async findById(id: string) {
    const lote = await this.prisma.lote.findUnique({
      where: { id },
      include: { item: true, doador: true, setor: true },
    });
    if (!lote) throw new NotFoundException('Lote nao encontrado');
    return { ...lote, statusValidade: calcularStatusLote(lote.dataValidade) };
  }

  /**
   * Busca um lote pelo codigo lido na etiqueta.
   * Usado pelo scanner na tela de Saidas.
   *
   * Retorna tambem quantidadeReservada (em eventos ativos) para que o frontend
   * possa exibir o saldo disponivel real.
   */
  async findByCodigo(codigo: string) {
    const codigoLimpo = (codigo || '').trim().toUpperCase();
    if (!codigoLimpo) return { encontrado: false, codigo };

    const lote = await this.prisma.lote.findUnique({
      where: { codigoLote: codigoLimpo },
      include: {
        item: true, doador: true, setor: true,
        reservas: {
          where: { ativa: true },
          include: { evento: { select: { id: true, nome: true, status: true } } },
        },
      },
    });

    if (!lote) return { encontrado: false, codigo: codigoLimpo };
    const reservadoTotal = lote.reservas.reduce((s, r) => s + Number(r.quantidadeReservada), 0);
    const disponivel = Math.max(0, Number(lote.quantidadeAtual) - reservadoTotal);

    if (!lote.ativo) {
      return {
        encontrado: true, esgotado: true,
        lote: { ...lote, statusValidade: calcularStatusLote(lote.dataValidade), reservadoTotal, disponivel },
      };
    }
    return {
      encontrado: true, esgotado: false,
      lote: { ...lote, statusValidade: calcularStatusLote(lote.dataValidade), reservadoTotal, disponivel },
    };
  }

  /**
   * Lotes proximos ao vencimento, vencidos, em descarte etc.
   * Substitui /itens/alertas (que agora opera por lote).
   */
  async alertas() {
    const lotes = await this.prisma.lote.findMany({
      where: { ativo: true, quantidadeAtual: { gt: 0 } },
      include: { item: true, setor: true },
    });
    const comStatus = lotes.map(l => ({
      ...l, statusValidade: calcularStatusLote(l.dataValidade),
    }));

    // Itens abaixo do minimo: agrega saldo de todos os lotes ativos do item
    const itens = await this.prisma.item.findMany({
      where: { ativo: true, estoqueMinimo: { gt: 0 } },
      include: { setor: true },
    });
    const abaixoMinimo = itens.filter(i => Number(i.saldoAtual) <= Number(i.estoqueMinimo));

    return {
      descarte: comStatus.filter(l => l.statusValidade === 'DESCARTE'),
      adicional: comStatus.filter(l => l.statusValidade === 'ADICIONAL'),
      proximoVencimento: comStatus.filter(l => l.statusValidade === 'PROXIMO'),
      abaixoMinimo,
    };
  }

  // ─── Criacao ─────────────────────────────────────────────────
  /**
   * Cria um novo lote. Usado tanto pelo endpoint direto quanto pelo
   * MovimentacoesService ao registrar entrada.
   *
   * Tambem recalcula o saldoAtual do Item (cache da soma dos lotes ativos).
   */
  async criar(data: {
    itemId: string;
    quantidade: number;
    dataValidade?: string | Date | null;
    doadorId?: string | null;
    setorId?: string | null;
    localizacao?: string | null;
    observacao?: string | null;
  }) {
    if (!data.itemId) throw new BadRequestException('itemId obrigatorio');
    const qtd = Number(data.quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      throw new BadRequestException('Quantidade do lote deve ser maior que zero');
    }

    const item = await this.prisma.item.findUnique({ where: { id: data.itemId } });
    if (!item) throw new NotFoundException('Item nao encontrado');

    const codigoLote = await gerarProximoCodigoLote(this.prisma);

    const lote = await this.prisma.lote.create({
      data: {
        codigoLote,
        itemId: data.itemId,
        quantidadeInicial: qtd,
        quantidadeAtual: qtd,
        dataValidade: data.dataValidade ? parseDataLocal(data.dataValidade) : null,
        doadorId: data.doadorId || null,
        setorId: data.setorId || null,
        localizacao: data.localizacao?.trim() || null,
        observacao: data.observacao?.trim() || null,
      },
      include: { item: true, doador: true, setor: true },
    });

    await this.recalcularSaldoItem(data.itemId);
    return lote;
  }

  // ─── Atualizacao ─────────────────────────────────────────────
  async atualizar(id: string, data: {
    dataValidade?: string | Date | null;
    localizacao?: string | null;
    observacao?: string | null;
    setorId?: string | null;
  }) {
    const lote = await this.prisma.lote.findUnique({ where: { id } });
    if (!lote) throw new NotFoundException('Lote nao encontrado');

    return this.prisma.lote.update({
      where: { id },
      data: {
        ...(data.dataValidade !== undefined && {
          dataValidade: data.dataValidade ? parseDataLocal(data.dataValidade) : null,
        }),
        ...(data.localizacao !== undefined && { localizacao: data.localizacao?.trim() || null }),
        ...(data.observacao !== undefined && { observacao: data.observacao?.trim() || null }),
        ...(data.setorId !== undefined && { setorId: data.setorId || null }),
      },
      include: { item: true, doador: true, setor: true },
    });
  }

  /**
   * Exclui um lote especifico.
   *
   * Regras de seguranca:
   * - So permite excluir se quantidadeAtual === 0 (lote ja esvaziado)
   * - Bloqueia se houver reservas ativas em eventos
   * - Bloqueia se ja teve saidas/descartes (preservar historico — desativa
   *   em vez de excluir)
   * - Se nao puder excluir mas estiver vazio, desativa
   */
  async excluir(id: string, usuarioId: string) {
    const lote = await this.prisma.lote.findUnique({
      where: { id },
      include: {
        _count: { select: { movimentacoesItem: true, reservasEvento: true } },
      },
    });
    if (!lote) throw new NotFoundException('Lote nao encontrado');

    // Bloqueia se ainda tem saldo
    if (Number(lote.quantidadeAtual) > 0) {
      throw new BadRequestException(
        `Lote ${lote.codigoLote} ainda tem saldo (${lote.quantidadeAtual} un). ` +
        `Apenas lotes esvaziados podem ser excluidos.`,
      );
    }

    // Bloqueia se tem reservas ativas em eventos
    const reservasAtivas = await this.prisma.reservaEvento.count({
      where: { loteId: id, evento: { status: { in: ['PLANEJADO', 'EM_ANDAMENTO'] } } },
    });
    if (reservasAtivas > 0) {
      throw new BadRequestException(
        `Lote ${lote.codigoLote} esta reservado em ${reservasAtivas} evento(s) ativo(s).`,
      );
    }

    // Se tem historico de movimentacoes, desativa em vez de excluir
    if (lote._count.movimentacoesItem > 0 || lote._count.reservasEvento > 0) {
      await this.prisma.lote.update({ where: { id }, data: { ativo: false } });
      await this.prisma.logAuditoria.create({
        data: {
          usuarioId, acao: 'DESATIVAR_LOTE', entidade: 'Lote', entidadeId: id,
          detalhes: `Lote ${lote.codigoLote} possui historico; foi desativado em vez de excluido`,
        },
      });
      return { mensagem: `Lote ${lote.codigoLote} desativado (preserva historico)` };
    }

    // Sem historico = pode excluir de verdade
    await this.prisma.lote.delete({ where: { id } });
    await this.prisma.logAuditoria.create({
      data: {
        usuarioId, acao: 'EXCLUIR_LOTE', entidade: 'Lote', entidadeId: id,
        detalhes: `Lote ${lote.codigoLote} excluido (sem historico)`,
      },
    });
    return { mensagem: `Lote ${lote.codigoLote} excluido` };
  }

  // ─── Helper interno: recalcular saldo do item ────────────────
  /**
   * O saldoAtual do Item e cache da soma dos quantidadeAtual dos lotes
   * ativos. Chamado apos qualquer mudanca em lote.
   */
  async recalcularSaldoItem(itemId: string) {
    const agg = await this.prisma.lote.aggregate({
      where: { itemId, ativo: true },
      _sum: { quantidadeAtual: true },
    });
    const total = Number(agg._sum.quantidadeAtual || 0);
    await this.prisma.item.update({
      where: { id: itemId },
      data: { saldoAtual: total },
    });
    return total;
  }

  /**
   * Soma as reservas ATIVAS (em eventos não finalizados) de um lote.
   */
  async somaReservasAtivas(loteId: string): Promise<number> {
    const agg = await this.prisma.reservaEvento.aggregate({
      where: { loteId, ativa: true },
      _sum: { quantidadeReservada: true },
    });
    return Number(agg._sum.quantidadeReservada || 0);
  }

  /**
   * Saldo disponivel = quantidadeAtual − soma das reservas ativas.
   * O que pode ser usado em saidas comuns (nao vinculadas a evento).
   */
  async calcularDisponivel(loteId: string): Promise<{ atual: number; reservado: number; disponivel: number }> {
    const lote = await this.prisma.lote.findUnique({ where: { id: loteId } });
    if (!lote) return { atual: 0, reservado: 0, disponivel: 0 };
    const reservado = await this.somaReservasAtivas(loteId);
    const atual = Number(lote.quantidadeAtual);
    return { atual, reservado, disponivel: Math.max(0, atual - reservado) };
  }

  /**
   * Abate quantidade de um lote especifico (chamado pelo MovimentacoesService).
   * Se zerar, marca lote como inativo (ativo=false).
   * Retorna { saldoAnterior, saldoPosterior, item } pra registrar no MovimentacaoItem.
   */
  async abaterDoLote(loteId: string, quantidade: number) {
    const lote = await this.prisma.lote.findUnique({
      where: { id: loteId },
      include: { item: true },
    });
    if (!lote) throw new NotFoundException('Lote nao encontrado');
    if (!lote.ativo) throw new BadRequestException(`Lote ${lote.codigoLote} ja esta esgotado/inativo`);

    const qtd = Number(quantidade);
    const saldoAnterior = Number(lote.quantidadeAtual);
    const saldoPosterior = saldoAnterior - qtd;
    if (saldoPosterior < 0) {
      throw new BadRequestException(
        `Saldo insuficiente no lote ${lote.codigoLote}: disponivel ${saldoAnterior}, solicitado ${qtd}`,
      );
    }

    await this.prisma.lote.update({
      where: { id: loteId },
      data: {
        quantidadeAtual: saldoPosterior,
        ativo: saldoPosterior > 0,
      },
    });

    return {
      lote,
      itemId: lote.itemId,
      item: lote.item,
      saldoAnterior,
      saldoPosterior,
    };
  }

  /**
   * Devolve quantidade a um lote (usado em estorno de saida).
   */
  async devolverAoLote(loteId: string, quantidade: number) {
    const lote = await this.prisma.lote.findUnique({ where: { id: loteId } });
    if (!lote) throw new NotFoundException('Lote nao encontrado');

    const qtd = Number(quantidade);
    const novoSaldo = Number(lote.quantidadeAtual) + qtd;

    await this.prisma.lote.update({
      where: { id: loteId },
      data: { quantidadeAtual: novoSaldo, ativo: true },
    });

    await this.recalcularSaldoItem(lote.itemId);
  }
}
