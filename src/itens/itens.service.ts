import {
  BadRequestException, ConflictException, HttpException,
  Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseDataLocal } from '../common/data-fuso';

export function calcularStatusValidade(dataValidade: Date | null): string {
  if (!dataValidade) return 'VIGENTE';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const val = parseDataLocal(dataValidade) || new Date();
  val.setHours(0, 0, 0, 0);

  const seisMesesDepois = new Date(val);
  seisMesesDepois.setMonth(seisMesesDepois.getMonth() + 6);

  const trintaDiasAntes = new Date(val);
  trintaDiasAntes.setDate(trintaDiasAntes.getDate() - 30);

  if (hoje > seisMesesDepois) return 'DESCARTE';
  if (hoje > val) return 'ADICIONAL';
  if (hoje >= trintaDiasAntes) return 'PROXIMO';
  return 'VIGENTE';
}

@Injectable()
export class ItensService {
  private logger = new Logger('ItensService');

  constructor(private prisma: PrismaService) {}

  async findAll(filtros: { busca?: string; categoriaId?: string; setorId?: string }) {
    const where: any = { ativo: true };
    if (filtros.busca) {
      where.OR = [
        { nome: { contains: filtros.busca, mode: 'insensitive' } },
        { codigoInterno: { contains: filtros.busca, mode: 'insensitive' } },
        { codigoEan: { contains: filtros.busca } },
      ];
    }
    if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
    if (filtros.setorId) where.setorId = filtros.setorId;

    const itens = await this.prisma.item.findMany({
      where,
      include: { categoria: true, setor: true },
      orderBy: { nome: 'asc' },
    });

    return itens.map((i) => ({
      ...i,
      statusValidade: calcularStatusValidade(i.dataValidade),
      abaixoMinimo: Number(i.estoqueMinimo) > 0 && Number(i.saldoAtual) <= Number(i.estoqueMinimo),
    }));
  }

  async findByEan(ean: string) {
    const eanLimpo = (ean || '').replace(/\D/g, '');
    const item = await this.prisma.item.findFirst({
      where: { codigoEan: eanLimpo, ativo: true },
      include: { categoria: true, setor: true },
    });
    if (!item) return { encontrado: false, ean: eanLimpo };
    return { encontrado: true, item: { ...item, statusValidade: calcularStatusValidade(item.dataValidade) } };
  }

  /**
   * Gera o proximo codigo interno disponivel no formato WF-NNNNN.
   * Busca o maior numero ja usado (em vez de count) para evitar colisao
   * quando itens sao excluidos permanentemente.
   */
  private async gerarProximoCodigoInterno(): Promise<string> {
    const ultimo = await this.prisma.item.findFirst({
      where: { codigoInterno: { startsWith: 'WF-' } },
      orderBy: { codigoInterno: 'desc' },
      select: { codigoInterno: true },
    });
    let proximo = 1;
    if (ultimo) {
      const match = ultimo.codigoInterno.match(/WF-(\d+)/);
      if (match) proximo = parseInt(match[1], 10) + 1;
    }
    return `WF-${String(proximo).padStart(5, '0')}`;
  }

  async create(data: any) {
    try {
      // ─── Validacoes ────────────────────────────────────────────
      const nome = (data.nome || '').trim();
      if (!nome) throw new BadRequestException('Nome do item e obrigatorio');
      if (!data.categoriaId) throw new BadRequestException('Categoria e obrigatoria');

      // Confere se categoria existe
      const cat = await this.prisma.categoria.findUnique({ where: { id: data.categoriaId } });
      if (!cat) throw new BadRequestException('Categoria selecionada nao existe mais. Atualize a pagina.');

      // Confere se setor existe (se enviado)
      let setorIdValido: string | null = null;
      if (data.setorId && typeof data.setorId === 'string' && data.setorId.trim()) {
        const setor = await this.prisma.setor.findUnique({ where: { id: data.setorId.trim() } });
        if (!setor) {
          this.logger.warn(`Setor ${data.setorId} nao encontrado, salvando sem setor`);
        } else {
          setorIdValido = setor.id;
        }
      }

      // Limpa e valida EAN
      const eanLimpo = (data.codigoEan || '').replace(/\D/g, '');
      if (eanLimpo) {
        const existe = await this.prisma.item.findFirst({ where: { codigoEan: eanLimpo, ativo: true } });
        if (existe) throw new ConflictException(`Codigo de barras ja cadastrado para: ${existe.nome}`);
      }

      // Normalizacao de tipos
      const estoqueMinimo = Number(data.estoqueMinimo);
      const estoqueValido = Number.isFinite(estoqueMinimo) && estoqueMinimo >= 0 ? estoqueMinimo : 0;

      // ─── Persistencia com retry em caso de colisao de codigo interno ───
      // Se houver corrida (criacao simultanea) ou estado bugado, tenta novamente.
      let tentativas = 0;
      const codigoExplicito = (data.codigoInterno || '').trim();
      while (true) {
        const codigoInterno = codigoExplicito || await this.gerarProximoCodigoInterno();
        try {
          const criado = await this.prisma.item.create({
            data: {
              codigoInterno,
              codigoEan: eanLimpo || null,
              nome,
              descricao: data.descricao?.trim() || null,
              unidadeMedida: (data.unidadeMedida || '').trim() || 'un',
              estoqueMinimo: estoqueValido,
              dataValidade: data.dataValidade ? parseDataLocal(data.dataValidade) : null,
              localizacao: data.localizacao?.trim() || null,
              categoriaId: data.categoriaId,
              setorId: setorIdValido,
              produtoBaseId: data.produtoBaseId || null,
            },
            include: { categoria: true, setor: true },
          });
          this.logger.log(`Item criado: ${criado.codigoInterno} - ${criado.nome}`);
          return criado;
        } catch (e: any) {
          // P2002 = unique constraint violation. Se foi no codigo_interno, recalcula e tenta de novo.
          const colisaoCodigoInterno = e?.code === 'P2002'
            && Array.isArray(e?.meta?.target)
            && e.meta.target.includes('codigo_interno');
          if (colisaoCodigoInterno && !codigoExplicito && tentativas < 5) {
            tentativas++;
            this.logger.warn(`Colisao em codigo_interno, tentativa ${tentativas}/5`);
            continue;
          }
          throw e;
        }
      }
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Falha ao criar item: ${err.message}`, err.stack);
      if (err.code === 'P2002') {
        const campo = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'campo';
        throw new ConflictException(`Ja existe um item com este ${campo}`);
      }
      if (err.code === 'P2003') {
        throw new BadRequestException('Categoria ou setor invalido. Atualize a pagina e tente novamente.');
      }
      if (err.code === 'P2025') {
        throw new BadRequestException('Registro relacionado nao encontrado');
      }
      throw new BadRequestException(`Nao foi possivel cadastrar: ${err.message || 'erro desconhecido'}`);
    }
  }

  async update(id: string, data: any) {
    try {
      const item = await this.prisma.item.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Item nao encontrado');

      const updateData: any = {};
      if (data.nome !== undefined) updateData.nome = data.nome.trim();
      if (data.descricao !== undefined) updateData.descricao = data.descricao?.trim() || null;
      if (data.unidadeMedida !== undefined) updateData.unidadeMedida = data.unidadeMedida.trim() || 'un';
      if (data.estoqueMinimo !== undefined) updateData.estoqueMinimo = Number(data.estoqueMinimo) || 0;
      if (data.localizacao !== undefined) updateData.localizacao = data.localizacao?.trim() || null;
      if (data.categoriaId !== undefined) updateData.categoriaId = data.categoriaId;
      if (data.setorId !== undefined) updateData.setorId = data.setorId || null;
      if (data.dataValidade !== undefined) {
        updateData.dataValidade = data.dataValidade ? parseDataLocal(data.dataValidade) : null;
      }
      if (data.codigoEan !== undefined) {
        updateData.codigoEan = (data.codigoEan || '').replace(/\D/g, '') || null;
      }
      if (data.produtoBaseId !== undefined) updateData.produtoBaseId = data.produtoBaseId || null;

      return await this.prisma.item.update({
        where: { id }, data: updateData,
        include: { categoria: true, setor: true },
      });
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Falha ao atualizar item ${id}: ${err.message}`);
      throw new BadRequestException(`Nao foi possivel atualizar: ${err.message}`);
    }
  }

  async desativar(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item nao encontrado');
    return this.prisma.item.update({ where: { id }, data: { ativo: false } });
  }

  async excluir(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { _count: { select: { movimentacaoItens: true } } },
    });
    if (!item) throw new NotFoundException('Item nao encontrado');

    if (item._count.movimentacaoItens > 0) {
      await this.prisma.item.update({ where: { id }, data: { ativo: false } });
      return {
        mensagem: 'Item possui historico de movimentacoes e foi desativado. Ele nao aparecera mais nas listagens, mas o historico fica preservado.',
        desativado: true,
      };
    }

    await this.prisma.item.delete({ where: { id } });
    return { mensagem: 'Item excluido permanentemente', excluido: true };
  }

  /**
   * Retorna alertas atuais. Validade agora vem dos LOTES (cada lote tem
   * sua propria validade); estoque minimo continua sendo por ITEM (agregado).
   */
  async alertas() {
    // 1. Validade: lotes ativos cujo item esteja ativo
    const lotes = await this.prisma.lote.findMany({
      where: {
        ativo: true,
        quantidadeAtual: { gt: 0 },
        item: { ativo: true },
      },
      include: { item: { include: { setor: true } } },
    });
    const lotesComStatus = lotes.map((l) => ({
      ...l,
      statusValidade: calcularStatusValidade(l.dataValidade),
    }));

    // 2. Estoque minimo - duas regras:
    //    a) Itens SEM produto base: comparam estoqueMinimo do proprio item
    //    b) Itens COM produto base: agregam saldos de todas as marcas e
    //       comparam com o estoqueMinimo do produto base. So gera 1 alerta
    //       por produto base (nao por marca).
    const itens = await this.prisma.item.findMany({
      where: { ativo: true },
      include: { setor: true, produtoBase: true },
    });

    // Soma saldos agrupados por produtoBaseId (so contabiliza marcas ativas)
    const saldoPorProdutoBase = new Map<string, number>();
    for (const i of itens) {
      if (i.produtoBaseId) {
        const acc = saldoPorProdutoBase.get(i.produtoBaseId) || 0;
        saldoPorProdutoBase.set(i.produtoBaseId, acc + Number(i.saldoAtual));
      }
    }

    const abaixoMinimo: any[] = [];

    // a) Items sem produto base
    for (const i of itens.filter((x) => !x.produtoBaseId && Number(x.estoqueMinimo) > 0)) {
      if (Number(i.saldoAtual) <= Number(i.estoqueMinimo)) {
        abaixoMinimo.push({ ...i, abaixoMinimo: true, agrupado: false });
      }
    }

    // b) Produtos base (1 alerta por produto base, nao por marca)
    const produtosBaseVistos = new Set<string>();
    for (const i of itens.filter((x) => x.produtoBaseId)) {
      const pb = i.produtoBase;
      if (!pb || produtosBaseVistos.has(pb.id)) continue;
      produtosBaseVistos.add(pb.id);
      if (Number(pb.estoqueMinimo) <= 0) continue;
      const saldoTotal = saldoPorProdutoBase.get(pb.id) || 0;
      if (saldoTotal <= Number(pb.estoqueMinimo)) {
        // Estrutura compativel com Item para o frontend
        abaixoMinimo.push({
          id: pb.id,
          nome: pb.nome,
          codigoInterno: '—',
          unidadeMedida: pb.unidadeMedida,
          saldoAtual: saldoTotal,
          estoqueMinimo: pb.estoqueMinimo,
          setor: null,
          abaixoMinimo: true,
          agrupado: true,
          marcas: itens.filter((x) => x.produtoBaseId === pb.id).map((x) => ({ nome: x.nome, saldo: x.saldoAtual })),
        });
      }
    }

    return {
      descarte: lotesComStatus.filter((l) => l.statusValidade === 'DESCARTE'),
      adicional: lotesComStatus.filter((l) => l.statusValidade === 'ADICIONAL'),
      proximoVencimento: lotesComStatus.filter((l) => l.statusValidade === 'PROXIMO'),
      abaixoMinimo,
    };
  }
}
