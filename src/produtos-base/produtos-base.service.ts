import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProdutosBaseService {
  constructor(private prisma: PrismaService) {}

  async findAll(busca?: string) {
    const where: any = {};
    if (busca) where.nome = { contains: busca, mode: 'insensitive' };
    const pbs = await this.prisma.produtoBase.findMany({
      where,
      include: { itens: { where: { ativo: true }, select: { id: true, nome: true, saldoAtual: true } } },
      orderBy: { nome: 'asc' },
    });
    return pbs.map((pb) => ({
      ...pb,
      saldoTotal: pb.itens.reduce((s, i) => s + Number(i.saldoAtual), 0),
      qtdMarcas: pb.itens.length,
    }));
  }

  async findOne(id: string) {
    const pb = await this.prisma.produtoBase.findUnique({
      where: { id },
      include: { itens: { include: { categoria: true } } },
    });
    if (!pb) throw new NotFoundException('Produto base nao encontrado');
    return pb;
  }

  async create(data: { nome: string; unidadeMedida?: string; estoqueMinimo?: number }) {
    if (!data.nome?.trim()) throw new BadRequestException('Nome e obrigatorio');
    const nome = data.nome.trim();
    const existe = await this.prisma.produtoBase.findUnique({ where: { nome } });
    if (existe) throw new ConflictException('Ja existe um produto base com esse nome');
    return this.prisma.produtoBase.create({
      data: {
        nome,
        unidadeMedida: data.unidadeMedida || 'un',
        estoqueMinimo: data.estoqueMinimo ?? 0,
      },
    });
  }

  async update(id: string, data: any) {
    const updateData: any = {};
    if (data.nome !== undefined) updateData.nome = data.nome.trim();
    if (data.unidadeMedida !== undefined) updateData.unidadeMedida = data.unidadeMedida;
    if (data.estoqueMinimo !== undefined) updateData.estoqueMinimo = data.estoqueMinimo;
    if (data.ativo !== undefined) updateData.ativo = data.ativo;
    return this.prisma.produtoBase.update({ where: { id }, data: updateData });
  }

  async excluir(id: string) {
    const pb = await this.prisma.produtoBase.findUnique({
      where: { id },
      include: { _count: { select: { itens: true } } },
    });
    if (!pb) throw new NotFoundException('Produto base nao encontrado');
    if (pb._count.itens > 0) {
      // Desativa em vez de excluir se ja tem itens vinculados
      await this.prisma.produtoBase.update({ where: { id }, data: { ativo: false } });
      return { mensagem: 'Produto base tem itens vinculados e foi desativado em vez de excluido' };
    }
    await this.prisma.produtoBase.delete({ where: { id } });
    return { mensagem: 'Produto base excluido' };
  }
}
