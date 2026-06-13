import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.categoria.findMany({
      include: { _count: { select: { itens: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  create(data: { nome: string; descricao?: string }) {
    return this.prisma.categoria.create({ data });
  }

  async update(id: string, data: any) {
    const c = await this.prisma.categoria.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Categoria nao encontrada');
    return this.prisma.categoria.update({ where: { id }, data });
  }

  async excluir(id: string) {
    const c = await this.prisma.categoria.findUnique({
      where: { id },
      include: { _count: { select: { itens: true } } },
    });
    if (!c) throw new NotFoundException('Categoria nao encontrada');
    if (c._count.itens > 0) {
      throw new BadRequestException(
        `Nao e possivel excluir: ${c._count.itens} item(ns) usam esta categoria. Mova-os para outra categoria primeiro.`
      );
    }
    return this.prisma.categoria.delete({ where: { id } });
  }
}
