import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

export interface ItemMov { itemId: string; quantidade: number; dataValidade?: string }

@Injectable()
export class MovimentacoesService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {}

  findAll(filtros: { tipo?: string; dataInicio?: string; dataFim?: string; setorId?: string }) {
    const where: any = {};
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.setorId) where.setorId = filtros.setorId;
    if (filtros.dataInicio || filtros.dataFim) {
      where.dataMovimentacao = {};
      if (filtros.dataInicio) where.dataMovimentacao.gte = new Date(filtros.dataInicio);
      if (filtros.dataFim) where.dataMovimentacao.lte = new Date(filtros.dataFim);
    }
    return this.prisma.movimentacao.findMany({
      where,
      include: {
        itens: { include: { item: true } },
        doador: true, beneficiario: true, setor: true,
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ── ENTRADA ──────────────────────────────────────────────
  async registrarEntrada(usuarioId: string, dto: {
    doadorId?: string; observacao?: string; dataMovimentacao?: string; itens: ItemMov[];
  }) {
    if (!dto.itens?.length) throw new BadRequestException('Informe ao menos um item');
    for (const i of dto.itens) {
      if (!i.quantidade || i.quantidade <= 0) throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const mov = await tx.movimentacao.create({
        data: {
          tipo: 'ENTRADA',
          doadorId: dto.doadorId || null,
          observacao: dto.observacao,
          dataMovimentacao: dto.dataMovimentacao ? new Date(dto.dataMovimentacao) : new Date(),
          usuarioId,
        },
      });

      for (const im of dto.itens) {
        const item = await tx.item.findUnique({ where: { id: im.itemId } });
        if (!item) throw new NotFoundException(`Item ${im.itemId} nao encontrado`);

        const saldoAnterior = Number(item.saldoAtual);
        const saldoPosterior = saldoAnterior + Number(im.quantidade);

        await tx.movimentacaoItem.create({
          data: {
            movimentacaoId: mov.id,
            itemId: im.itemId,
            quantidade: im.quantidade,
            dataValidade: im.dataValidade ? new Date(im.dataValidade) : null,
            saldoAnterior, saldoPosterior,
          },
        });

        await tx.item.update({
          where: { id: im.itemId },
          data: {
            saldoAtual: saldoPosterior,
            ...(im.dataValidade ? { dataValidade: new Date(im.dataValidade) } : {}),
          },
        });
      }

      await tx.logAuditoria.create({
        data: { acao: 'ENTRADA', entidade: 'Movimentacao', entidadeId: mov.id, usuarioId,
          detalhes: { itens: dto.itens.length } },
      });

      return tx.movimentacao.findUnique({
        where: { id: mov.id },
        include: { itens: { include: { item: true } }, doador: true },
      });
    });
  }

  // ── SAÍDA (com regra de estoque mínimo) ──────────────────
  async registrarSaida(usuarioId: string, dto: {
    destinoSaida: 'BENEFICIARIO' | 'SETOR';
    beneficiarioId?: string; setorId?: string;
    finalidade?: string; observacao?: string; dataMovimentacao?: string;
    confirmadoMinimo?: boolean;
    itens: ItemMov[];
  }) {
    if (!dto.itens?.length) throw new BadRequestException('Informe ao menos um item');

    if (dto.destinoSaida === 'BENEFICIARIO') {
      if (!dto.beneficiarioId) throw new BadRequestException('Beneficiario obrigatorio');
      const b = await this.prisma.beneficiario.findUnique({ where: { id: dto.beneficiarioId } });
      if (!b) throw new NotFoundException('Beneficiario nao encontrado');
      if (!b.ativo) throw new BadRequestException('Beneficiario inativo nao pode receber itens (RN-11)');
    }
    if (dto.destinoSaida === 'SETOR' && !dto.setorId) {
      throw new BadRequestException('Setor obrigatorio');
    }

    // 1a passada: validar saldos e detectar violacao de minimo
    const violacoesMinimo: any[] = [];
    for (const im of dto.itens) {
      const item = await this.prisma.item.findUnique({ where: { id: im.itemId } });
      if (!item) throw new NotFoundException(`Item nao encontrado`);

      const saldoResultante = Number(item.saldoAtual) - Number(im.quantidade);
      if (saldoResultante < 0) {
        throw new BadRequestException(
          `Saldo insuficiente para "${item.nome}": disponivel ${item.saldoAtual}, solicitado ${im.quantidade} (RN-01)`
        );
      }
      if (saldoResultante <= Number(item.estoqueMinimo)) {
        violacoesMinimo.push({
          item: item.nome,
          saldoAtual: Number(item.saldoAtual),
          saldoResultante,
          estoqueMinimo: Number(item.estoqueMinimo),
        });
      }
    }

    // RN-02: exige confirmacao explicita quando minimo for violado
    if (violacoesMinimo.length > 0 && !dto.confirmadoMinimo) {
      return {
        requerConfirmacao: true,
        mensagem: 'Esta retirada deixara o estoque abaixo do minimo. Confirme para prosseguir.',
        violacoes: violacoesMinimo,
      };
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const mov = await tx.movimentacao.create({
        data: {
          tipo: 'SAIDA',
          destinoSaida: dto.destinoSaida,
          beneficiarioId: dto.beneficiarioId || null,
          setorId: dto.setorId || null,
          finalidade: dto.finalidade,
          observacao: dto.observacao,
          confirmadoMinimo: dto.confirmadoMinimo || false,
          dataMovimentacao: dto.dataMovimentacao ? new Date(dto.dataMovimentacao) : new Date(),
          usuarioId,
        },
      });

      for (const im of dto.itens) {
        const item = await tx.item.findUnique({ where: { id: im.itemId } });
        const saldoAnterior = Number(item.saldoAtual);
        const saldoPosterior = saldoAnterior - Number(im.quantidade);
        if (saldoPosterior < 0) throw new BadRequestException(`Saldo insuficiente: ${item.nome}`);

        await tx.movimentacaoItem.create({
          data: {
            movimentacaoId: mov.id, itemId: im.itemId,
            quantidade: im.quantidade, saldoAnterior, saldoPosterior,
          },
        });
        await tx.item.update({ where: { id: im.itemId }, data: { saldoAtual: saldoPosterior } });
      }

      await tx.logAuditoria.create({
        data: { acao: 'SAIDA', entidade: 'Movimentacao', entidadeId: mov.id, usuarioId,
          detalhes: { destino: dto.destinoSaida, confirmadoMinimo: dto.confirmadoMinimo || false } },
      });

      return tx.movimentacao.findUnique({
        where: { id: mov.id },
        include: { itens: { include: { item: true } }, beneficiario: true, setor: true },
      });
    });

    // Apos commit da transacao: cria notificacoes para itens que ficaram abaixo do minimo.
    // Falha silenciosa: a movimentacao ja foi gravada, notificacao e secundaria.
    try {
      for (const im of dto.itens) {
        const item = await this.prisma.item.findUnique({ where: { id: im.itemId } });
        if (!item) continue;
        if (Number(item.saldoAtual) <= Number(item.estoqueMinimo) && Number(item.estoqueMinimo) > 0) {
          await this.notificacoes.criarSeNova(
            'ABAIXO_MINIMO',
            `Estoque abaixo do mínimo: ${item.nome}`,
            `Após a última saída, o item "${item.nome}" ficou com saldo ${item.saldoAtual} ${item.unidadeMedida} (mínimo: ${item.estoqueMinimo}).`,
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
      // Log silencioso - nao interrompe o fluxo
      console.warn(`[MovimentacoesService] Falha ao criar notificacao pos-saida: ${e.message}`);
    }

    return resultado;
  }

  // ── DESCARTE ─────────────────────────────────────────────
  async registrarDescarte(usuarioId: string, dto: { itemId: string; quantidade: number; motivo: string }) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: dto.itemId } });
      if (!item) throw new NotFoundException('Item nao encontrado');

      const saldoAnterior = Number(item.saldoAtual);
      const saldoPosterior = Math.max(0, saldoAnterior - Number(dto.quantidade));

      const mov = await tx.movimentacao.create({
        data: { tipo: 'DESCARTE', observacao: dto.motivo, usuarioId },
      });
      await tx.movimentacaoItem.create({
        data: { movimentacaoId: mov.id, itemId: dto.itemId, quantidade: dto.quantidade, saldoAnterior, saldoPosterior },
      });
      await tx.item.update({ where: { id: dto.itemId }, data: { saldoAtual: saldoPosterior, dataValidade: null } });
      await tx.logAuditoria.create({
        data: { acao: 'DESCARTE', entidade: 'Item', entidadeId: dto.itemId, usuarioId, detalhes: { motivo: dto.motivo } },
      });
      return mov;
    });
  }

  // ── ESTORNO (RN-03: nada se exclui, tudo se estorna) ─────
  async estornar(usuarioId: string, movimentacaoId: string) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.movimentacao.findUnique({
        where: { id: movimentacaoId },
        include: { itens: true, estornadoPor: true },
      });
      if (!original) throw new NotFoundException('Movimentacao nao encontrada');
      if (original.tipo === 'ESTORNO') throw new BadRequestException('Nao e possivel estornar um estorno');
      if (original.estornadoPor) throw new BadRequestException('Movimentacao ja estornada');

      const estorno = await tx.movimentacao.create({
        data: { tipo: 'ESTORNO', estornoDeId: original.id, usuarioId,
          observacao: `Estorno da movimentacao ${original.id}` },
      });

      for (const mi of original.itens) {
        const item = await tx.item.findUnique({ where: { id: mi.itemId } });
        const fator = original.tipo === 'ENTRADA' ? -1 : 1;
        const saldoAnterior = Number(item.saldoAtual);
        const saldoPosterior = saldoAnterior + fator * Number(mi.quantidade);
        if (saldoPosterior < 0) throw new BadRequestException(`Estorno deixaria saldo negativo em: ${item.nome}`);

        await tx.movimentacaoItem.create({
          data: { movimentacaoId: estorno.id, itemId: mi.itemId, quantidade: mi.quantidade, saldoAnterior, saldoPosterior },
        });
        await tx.item.update({ where: { id: mi.itemId }, data: { saldoAtual: saldoPosterior } });
      }

      await tx.logAuditoria.create({
        data: { acao: 'ESTORNO', entidade: 'Movimentacao', entidadeId: original.id, usuarioId },
      });
      return estorno;
    });
  }
}
