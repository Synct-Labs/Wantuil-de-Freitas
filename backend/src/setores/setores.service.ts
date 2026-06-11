import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SetoresService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const setores = await this.prisma.setor.findMany({
      where: { ativo: true },
      include: { _count: { select: { itens: true, movimentacoes: true } } },
      orderBy: { nome: 'asc' },
    });
    return setores;
  }

  async detalhe(id: string) {
    return this.prisma.setor.findUnique({
      where: { id },
      include: {
        itens: { where: { ativo: true } },
        movimentacoes: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { itens: { include: { item: true } } },
        },
      },
    });
  }

  create(data: { nome: string; responsavel?: string }) {
    return this.prisma.setor.create({ data });
  }

  update(id: string, data: any) {
    return this.prisma.setor.update({ where: { id }, data });
  }
}
