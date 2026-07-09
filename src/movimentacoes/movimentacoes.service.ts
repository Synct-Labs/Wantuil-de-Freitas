import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseDataLocal } from '../common/data-fuso';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { LotesService } from '../lotes/lotes.service';

// ─── DTOs ─────────────────────────────────────────────────────────
export interface DTOEntrada {
  doadorId?: string | null;
  observacao?: string | null;
  dataMovimentacao?: string | Date;
  /**
   * Cada elemento define UM lote a ser criado.
   * Para 5 pacotes de arroz com mesma validade: 1 elemento com quantidade=5.
   * Para 5 pacotes com validades diferentes: 5 elementos.
   */
  lotes: Array<{
    itemId: string;
    quantidade: number;
    dataValidade?: string | null;
    setorId?: string | null;
    localizacao?: string | null;
    observacao?: string | null;
  }>;
}

export interface DTOSaida {
  destinoSaida: 'BENEFICIARIO' | 'SETOR' | 'EVENTO';
  beneficiarioId?: string | null;
  setorId?: string | null;
  eventoId?: string | null;
  finalidade?: string;
  observacao?: string | null;
  dataMovimentacao?: string | Date;
  confirmadoMinimo?: boolean;
  /**
   * Cada elemento e uma "leitura de etiqueta + qtd" a abater do lote.
   * O usuario le a etiqueta do lote e informa quantas unidades vai retirar.
   */
  lotes: Array<{ loteId: string; quantidade: number }>;
}

@Injectable()
export class MovimentacoesService {
  private logger = new Logger('MovimentacoesService');

  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private lotesService: LotesService,
  ) {}

  // ═══════════════ LEITURA ═══════════════
  findAll(filtros: { tipo?: string; dataInicio?: string; dataFim?: string; setorId?: string }) {
    const where: any = {};
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.setorId) where.setorId = filtros.setorId;
    if (filtros.dataInicio || filtros.dataFim) {
      where.dataMovimentacao = {};
      if (filtros.dataInicio) where.dataMovimentacao.gte = new Date(filtros.dataInicio);
      if (filtros.dataFim) {
        const fim = new Date(filtros.dataFim);
        fim.setHours(23, 59, 59, 999);
        where.dataMovimentacao.lte = fim;
      }
    }
    return this.prisma.movimentacao.findMany({
      where,
      include: {
        itens: { include: { item: true, lote: true } },
        doador: true,
        beneficiario: true,
        setor: true,
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ═══════════════ ENTRADA: cria 1 movimentacao + N lotes ═══════════════
  async registrarEntrada(usuarioId: string, dto: DTOEntrada) {
    if (!dto.lotes?.length) throw new BadRequestException('Adicione ao menos um lote');
    for (const l of dto.lotes) {
      if (!l.itemId) throw new BadRequestException('Item obrigatório em cada lote');
      if (!l.quantidade || Number(l.quantidade) <= 0) {
        throw new BadRequestException('Quantidade deve ser maior que zero em todos os lotes');
      }
    }

    // 1. Cria a movimentacao (header) numa transacao curta
    const mov = await this.prisma.$transaction(async (tx) => {
      const m = await tx.movimentacao.create({
        data: {
          tipo: 'ENTRADA',
          doadorId: dto.doadorId || null,
          observacao: dto.observacao,
          dataMovimentacao: dto.dataMovimentacao ? new Date(dto.dataMovimentacao) : new Date(),
          usuarioId,
        },
      });
      await tx.logAuditoria.create({
        data: { acao: 'ENTRADA', entidade: 'Movimentacao', entidadeId: m.id, usuarioId,
          detalhes: { numLotes: dto.lotes.length } },
      });
      return m;
    });

    // 2. Cria os lotes (cada um recalcula o saldoAtual do item)
    const lotesCriados: any[] = [];
    for (const l of dto.lotes) {
      const lote = await this.lotesService.criar({
        itemId: l.itemId,
        quantidade: l.quantidade,
        dataValidade: l.dataValidade,
        doadorId: dto.doadorId || null,
        setorId: l.setorId,
        localizacao: l.localizacao,
        observacao: l.observacao,
      });
      lotesCriados.push(lote);

      // Registra MovimentacaoItem (rastreabilidade: este lote foi criado nesta movimentacao)
      const itemAtual = await this.prisma.item.findUnique({ where: { id: l.itemId } });
      const saldoAtualItem = Number(itemAtual?.saldoAtual || 0);
      await this.prisma.movimentacaoItem.create({
        data: {
          movimentacaoId: mov.id,
          itemId: l.itemId,
          loteId: lote.id,
          quantidade: Number(l.quantidade),
          dataValidade: l.dataValidade ? parseDataLocal(l.dataValidade) : null,
          saldoAnterior: saldoAtualItem - Number(l.quantidade),
          saldoPosterior: saldoAtualItem,
        },
      });
    }

    return this.prisma.movimentacao.findUnique({
      where: { id: mov.id },
      include: {
        itens: { include: { item: true, lote: true } },
        doador: true,
      },
    });
  }

  // ═══════════════ SAÍDA: abate de lotes especificos ═══════════════
  async registrarSaida(usuarioId: string, dto: DTOSaida) {
    if (!dto.lotes?.length) throw new BadRequestException('Adicione ao menos um lote');
    if (dto.destinoSaida === 'BENEFICIARIO' && !dto.beneficiarioId) {
      throw new BadRequestException('Selecione o beneficiário');
    }
    if (dto.destinoSaida === 'SETOR' && !dto.setorId) {
      throw new BadRequestException('Selecione o setor');
    }
    if (dto.destinoSaida === 'EVENTO' && !dto.eventoId) {
      throw new BadRequestException('Selecione o evento');
    }
    for (const l of dto.lotes) {
      if (!l.loteId) throw new BadRequestException('Lote obrigatório em cada linha');
      if (!l.quantidade || Number(l.quantidade) <= 0) {
        throw new BadRequestException('Quantidade deve ser maior que zero');
      }
    }

    // Se for saida pra evento, valida que o evento existe e nao esta finalizado
    let evento: any = null;
    if (dto.destinoSaida === 'EVENTO' && dto.eventoId) {
      evento = await this.prisma.evento.findUnique({ where: { id: dto.eventoId } });
      if (!evento) throw new BadRequestException('Evento não encontrado');
      if (evento.status === 'FINALIZADO' || evento.status === 'CANCELADO') {
        throw new BadRequestException(`Evento já está ${evento.status.toLowerCase()}`);
      }
    }

    // ── Pre-validacao: verifica saldos disponiveis e violacoes de minimo ──
    const violacoesMinimo: any[] = [];
    const totalPorItem: Record<string, { item: any; subtotal: number }> = {};

    for (const l of dto.lotes) {
      const lote = await this.prisma.lote.findUnique({
        where: { id: l.loteId },
        include: { item: true, reservas: { where: { ativa: true }, include: { evento: true } } },
      });
      if (!lote) throw new BadRequestException(`Lote ${l.loteId} não encontrado`);
      if (!lote.ativo) throw new BadRequestException(`Lote ${lote.codigoLote} já está esgotado`);
      const qtd = Number(l.quantidade);

      // ── Verificacao de reservas ──
      const reservadoTotal = lote.reservas.reduce((s, r) => s + Number(r.quantidadeReservada), 0);

      if (dto.destinoSaida === 'EVENTO') {
        // Saida pra evento: precisa ter reserva ativa neste evento com saldo suficiente
        const reservaDesteEvento = lote.reservas.find((r) => r.eventoId === dto.eventoId);
        if (!reservaDesteEvento) {
          throw new BadRequestException(
            `Lote ${lote.codigoLote} não está reservado para este evento. Adicione a reserva primeiro.`,
          );
        }
        if (qtd > Number(reservaDesteEvento.quantidadeReservada)) {
          throw new BadRequestException(
            `Saldo insuficiente na reserva do lote ${lote.codigoLote}: reservado ${reservaDesteEvento.quantidadeReservada} ${lote.item.unidadeMedida}, solicitado ${qtd}.`,
          );
        }
      } else {
        // Saida comum: respeita reservas (saldo disponivel = atual - reservado)
        const disponivel = Number(lote.quantidadeAtual) - reservadoTotal;
        if (qtd > disponivel) {
          const detalhe = reservadoTotal > 0
            ? ` (${reservadoTotal} ${lote.item.unidadeMedida} estão reservados para eventos)`
            : '';
          throw new BadRequestException(
            `Saldo disponível insuficiente no lote ${lote.codigoLote}: ${disponivel} ${lote.item.unidadeMedida}${detalhe}, solicitado ${qtd}.`,
          );
        }
      }

      const grupo = totalPorItem[lote.itemId] || { item: lote.item, subtotal: 0 };
      grupo.subtotal += qtd;
      totalPorItem[lote.itemId] = grupo;
    }

    // Checa violacao de minimo (saldo final do item < estoqueMinimo)
    for (const grupo of Object.values(totalPorItem)) {
      const saldoFinal = Number(grupo.item.saldoAtual) - grupo.subtotal;
      if (Number(grupo.item.estoqueMinimo) > 0 && saldoFinal < Number(grupo.item.estoqueMinimo)) {
        violacoesMinimo.push({
          item: grupo.item.nome,
          saldoAtual: Number(grupo.item.saldoAtual),
          saldoResultante: saldoFinal,
          estoqueMinimo: Number(grupo.item.estoqueMinimo),
        });
      }
    }

    if (violacoesMinimo.length > 0 && !dto.confirmadoMinimo) {
      return {
        requerConfirmacao: true,
        mensagem: 'Esta saída deixa um ou mais itens abaixo do estoque mínimo.',
        violacoes: violacoesMinimo,
      };
    }

    // ── Persistencia em transacao ──
    const mov = await this.prisma.$transaction(async (tx) => {
      return tx.movimentacao.create({
        data: {
          tipo: 'SAIDA',
          destinoSaida: dto.destinoSaida,
          beneficiarioId: dto.destinoSaida === 'BENEFICIARIO' ? dto.beneficiarioId : null,
          setorId: dto.destinoSaida === 'SETOR' ? dto.setorId : null,
          eventoId: dto.destinoSaida === 'EVENTO' ? dto.eventoId : null,
          finalidade: dto.finalidade,
          observacao: dto.observacao,
          confirmadoMinimo: dto.confirmadoMinimo || false,
          dataMovimentacao: dto.dataMovimentacao ? new Date(dto.dataMovimentacao) : new Date(),
          usuarioId,
        },
      });
    });

    // ── Abate de cada lote (recalcula saldo do item dentro de cada abate) ──
    const itensRecalcular = new Set<string>();
    for (const l of dto.lotes) {
      const r = await this.lotesService.abaterDoLote(l.loteId, Number(l.quantidade));
      await this.prisma.movimentacaoItem.create({
        data: {
          movimentacaoId: mov.id,
          itemId: r.itemId,
          loteId: l.loteId,
          quantidade: Number(l.quantidade),
          saldoAnterior: r.saldoAnterior,
          saldoPosterior: r.saldoPosterior,
        },
      });
      itensRecalcular.add(r.itemId);

      // Se for saida pra evento, ABATE TAMBEM da reserva
      if (dto.destinoSaida === 'EVENTO' && dto.eventoId) {
        const reserva = await this.prisma.reservaEvento.findUnique({
          where: { eventoId_loteId: { eventoId: dto.eventoId, loteId: l.loteId } },
        });
        if (reserva) {
          const novaQtd = Number(reserva.quantidadeReservada) - Number(l.quantidade);
          await this.prisma.reservaEvento.update({
            where: { id: reserva.id },
            data: {
              quantidadeReservada: Math.max(0, novaQtd),
              ativa: novaQtd > 0,
            },
          });
        }
      }
    }

    for (const itemId of itensRecalcular) {
      await this.lotesService.recalcularSaldoItem(itemId);
    }

    await this.prisma.logAuditoria.create({
      data: { acao: 'SAIDA', entidade: 'Movimentacao', entidadeId: mov.id, usuarioId,
        detalhes: { destino: dto.destinoSaida, eventoId: dto.eventoId, numLotes: dto.lotes.length, confirmadoMinimo: dto.confirmadoMinimo || false } },
    });

    // ── Notificacoes pos-saida (silencioso em caso de falha) ──
    try {
      for (const itemId of itensRecalcular) {
        const item = await this.prisma.item.findUnique({ where: { id: itemId } });
        if (!item) continue;
        if (Number(item.saldoAtual) <= Number(item.estoqueMinimo) && Number(item.estoqueMinimo) > 0) {
          await this.notificacoes.criarSeNova(
            'ABAIXO_MINIMO',
            `Estoque abaixo do mínimo: ${item.nome}`,
            `Após a última saída, "${item.nome}" ficou com saldo ${item.saldoAtual} ${item.unidadeMedida} (mínimo: ${item.estoqueMinimo}).`,
            'AVISO',
          );
        }
        if (Number(item.saldoAtual) === 0) {
          await this.notificacoes.criarSeNova(
            'ESGOTADO',
            `Item esgotado: ${item.nome}`,
            `O item "${item.nome}" está com saldo zero. Considere providenciar reposição.`,
            'CRITICO',
          );
        }
      }
    } catch (e: any) {
      this.logger.warn(`Falha ao criar notificacao pos-saida: ${e.message}`);
    }

    // Auto-inicia o evento ao primeiro consumo
    if (evento && evento.status === 'PLANEJADO') {
      await this.prisma.evento.update({ where: { id: evento.id }, data: { status: 'EM_ANDAMENTO' } });
    }

    return this.prisma.movimentacao.findUnique({
      where: { id: mov.id },
      include: {
        itens: { include: { item: true, lote: true } },
        beneficiario: true, setor: true, evento: true,
      },
    });
  }

  // ═══════════════ DESCARTE: abate quantidade de um lote ═══════════════
  async registrarDescarte(usuarioId: string, dto: { loteId: string; quantidade: number; motivo: string }) {
    if (!dto.loteId) throw new BadRequestException('Selecione um lote');
    if (!dto.quantidade || Number(dto.quantidade) <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    const r = await this.lotesService.abaterDoLote(dto.loteId, Number(dto.quantidade));
    await this.lotesService.recalcularSaldoItem(r.itemId);

    const mov = await this.prisma.movimentacao.create({
      data: {
        tipo: 'DESCARTE',
        observacao: dto.motivo,
        usuarioId,
        dataMovimentacao: new Date(),
      },
    });
    await this.prisma.movimentacaoItem.create({
      data: {
        movimentacaoId: mov.id,
        itemId: r.itemId,
        loteId: dto.loteId,
        quantidade: Number(dto.quantidade),
        saldoAnterior: r.saldoAnterior,
        saldoPosterior: r.saldoPosterior,
      },
    });
    await this.prisma.logAuditoria.create({
      data: { acao: 'DESCARTE', entidade: 'Movimentacao', entidadeId: mov.id, usuarioId,
        detalhes: { lote: r.lote.codigoLote, motivo: dto.motivo } },
    });
    return this.prisma.movimentacao.findUnique({
      where: { id: mov.id },
      include: { itens: { include: { item: true, lote: true } } },
    });
  }

  // ═══════════════ ESTORNO ═══════════════
  /**
   * Edita uma movimentacao de ENTRADA existente.
   *
   * Restricoes:
   * - So entradas (saida nao pode ser editada — usa estorno)
   * - Para cada lote, so permite reduzir/aumentar quantidade se ainda nao
   *   houve saida nem reserva do lote. Se ja houve, lanca excecao.
   * - Item do lote nao pode ser trocado (erro de item = estorna e re-cadastra)
   * - Dados editaveis por lote: quantidade, dataValidade, localizacao, observacao
   * - Dados editaveis na movimentacao: doadorId, observacao
   *
   * Sempre gera um log de auditoria descrevendo o que mudou.
   */
  async editarEntrada(usuarioId: string, idMovimentacao: string, dto: {
    doadorId?: string | null;
    observacao?: string;
    lotes?: {
      loteId: string;
      quantidade?: number;
      dataValidade?: string | null;
      localizacao?: string | null;
      observacao?: string | null;
    }[];
  }) {
    const mov = await this.prisma.movimentacao.findUnique({
      where: { id: idMovimentacao },
      include: { itens: { include: { lote: true } } },
    });
    if (!mov) throw new NotFoundException('Movimentação não encontrada');
    if (mov.tipo !== 'ENTRADA') throw new BadRequestException('Apenas entradas podem ser editadas. Para outros tipos use estorno.');

    // Verifica se ja foi estornada
    const estornada = await this.prisma.movimentacao.findFirst({
      where: { estornoDeId: idMovimentacao },
    });
    if (estornada) throw new BadRequestException('Esta entrada ja foi estornada e nao pode mais ser editada');

    const mudancas: string[] = [];

    return await this.prisma.$transaction(async (tx) => {
      // Atualiza cabecalho da movimentacao
      const updCab: any = {};
      if (dto.doadorId !== undefined && dto.doadorId !== mov.doadorId) {
        updCab.doadorId = dto.doadorId || null;
        mudancas.push(`doador alterado`);
      }
      if (dto.observacao !== undefined && dto.observacao !== mov.observacao) {
        updCab.observacao = dto.observacao;
        mudancas.push(`observacao alterada`);
      }
      if (Object.keys(updCab).length > 0) {
        await tx.movimentacao.update({ where: { id: idMovimentacao }, data: updCab });
      }

      // Atualiza cada lote
      for (const lDto of dto.lotes || []) {
        const movItem = mov.itens.find((mi) => mi.loteId === lDto.loteId);
        if (!movItem) throw new BadRequestException(`Lote ${lDto.loteId} nao pertence a esta movimentacao`);
        const lote = movItem.lote;
        if (!lote) continue;

        const updLote: any = {};
        const updItemMov: any = {};

        // Edicao de quantidade: so permite se o saldo atual do lote == quantidade
        // original DA MOVIMENTACAO (ou seja, nao houve saida desse lote).
        if (lDto.quantidade !== undefined && Number(lDto.quantidade) !== Number(movItem.quantidade)) {
          if (Number(lote.quantidadeAtual) !== Number(movItem.quantidade)) {
            throw new BadRequestException(
              `Lote ${lote.codigoLote} ja foi consumido em outra movimentacao. ` +
              `Para corrigir a quantidade, faca um estorno e registre uma nova entrada.`,
            );
          }
          const novaQtd = Number(lDto.quantidade);
          if (novaQtd <= 0) throw new BadRequestException('Quantidade deve ser maior que zero');
          const delta = novaQtd - Number(movItem.quantidade);
          updLote.quantidade = novaQtd;
          updLote.quantidadeAtual = novaQtd;
          updItemMov.quantidade = novaQtd;
          // Atualiza saldo do item
          await tx.item.update({
            where: { id: movItem.itemId },
            data: { saldoAtual: { increment: delta } },
          });
          mudancas.push(`qtd lote ${lote.codigoLote}: ${movItem.quantidade} -> ${novaQtd}`);
        }

        // Edicao de validade
        if (lDto.dataValidade !== undefined) {
          const nova = lDto.dataValidade ? parseDataLocal(lDto.dataValidade) : null;
          const original = lote.dataValidade;
          if (String(nova) !== String(original)) {
            updLote.dataValidade = nova;
            updItemMov.dataValidade = nova;
            mudancas.push(`validade lote ${lote.codigoLote} alterada`);
          }
        }

        // Edicao de localizacao / observacao
        if (lDto.localizacao !== undefined && lDto.localizacao !== lote.localizacao) {
          updLote.localizacao = lDto.localizacao;
          mudancas.push(`localizacao lote ${lote.codigoLote} alterada`);
        }
        if (lDto.observacao !== undefined && lDto.observacao !== lote.observacao) {
          updLote.observacao = lDto.observacao;
        }

        if (Object.keys(updLote).length > 0) {
          await tx.lote.update({ where: { id: lote.id }, data: updLote });
        }
        if (Object.keys(updItemMov).length > 0) {
          await tx.movimentacaoItem.update({ where: { id: movItem.id }, data: updItemMov });
        }
      }

      // Log de auditoria
      if (mudancas.length > 0) {
        await tx.logAuditoria.create({
          data: {
            usuarioId,
            acao: 'EDITAR_ENTRADA',
            entidade: 'Movimentacao',
            entidadeId: idMovimentacao,
            detalhes: mudancas.join(' | '),
          },
        });
      }

      return tx.movimentacao.findUnique({
        where: { id: idMovimentacao },
        include: { itens: { include: { item: true, lote: true } }, doador: true },
      });
    });
  }

  async estornar(usuarioId: string, idMovimentacao: string) {
    const mov = await this.prisma.movimentacao.findUnique({
      where: { id: idMovimentacao },
      include: { itens: true },
    });
    if (!mov) throw new NotFoundException('Movimentação não encontrada');
    if (mov.tipo === 'ESTORNO') throw new BadRequestException('Não é possível estornar um estorno');

    // Verifica se ja foi estornada
    const jaEstornada = await this.prisma.movimentacao.findFirst({
      where: { estornoDeId: idMovimentacao },
    });
    if (jaEstornada) throw new BadRequestException('Esta movimentação já foi estornada');

    return this.prisma.$transaction(async (tx) => {
      // Cria movimentacao de estorno
      const estorno = await tx.movimentacao.create({
        data: {
          tipo: 'ESTORNO',
          usuarioId,
          dataMovimentacao: new Date(),
          observacao: `Estorno de ${mov.tipo}`,
          estornoDeId: mov.id,
        },
      });

      const itensRecalc = new Set<string>();
      for (const mi of mov.itens) {
        if (mov.tipo === 'ENTRADA' && mi.loteId) {
          // Desfaz entrada: desativa o lote criado (nao apaga pra manter rastreio)
          await tx.lote.update({
            where: { id: mi.loteId },
            data: { ativo: false, quantidadeAtual: 0 },
          });
        } else if ((mov.tipo === 'SAIDA' || mov.tipo === 'DESCARTE') && mi.loteId) {
          // Devolve qtd ao lote
          const lote = await tx.lote.findUnique({ where: { id: mi.loteId } });
          if (lote) {
            await tx.lote.update({
              where: { id: mi.loteId },
              data: {
                quantidadeAtual: Number(lote.quantidadeAtual) + Number(mi.quantidade),
                ativo: true,
              },
            });
          }
        }
        itensRecalc.add(mi.itemId);

        await tx.movimentacaoItem.create({
          data: {
            movimentacaoId: estorno.id,
            itemId: mi.itemId,
            loteId: mi.loteId,
            quantidade: mi.quantidade,
            saldoAnterior: mi.saldoPosterior,
            saldoPosterior: mi.saldoAnterior,
          },
        });
      }

      // Recalcula saldo dos itens afetados
      for (const itemId of itensRecalc) {
        const agg = await tx.lote.aggregate({
          where: { itemId, ativo: true },
          _sum: { quantidadeAtual: true },
        });
        await tx.item.update({
          where: { id: itemId },
          data: { saldoAtual: Number(agg._sum.quantidadeAtual || 0) },
        });
      }

      await tx.logAuditoria.create({
        data: { acao: 'ESTORNO', entidade: 'Movimentacao', entidadeId: estorno.id, usuarioId,
          detalhes: { estornoDe: idMovimentacao, tipoOriginal: mov.tipo } },
      });

      return estorno;
    });
  }
}
