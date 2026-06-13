import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SetoresService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.setor.findMany({
      where: { ativo: true },
      include: { _count: { select: { itens: true, movimentacoes: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  detalhe(id: string) {
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

  async update(id: string, data: any) {
    const s = await this.prisma.setor.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Setor nao encontrado');
    return this.prisma.setor.update({ where: { id }, data });
  }

  async excluir(id: string) {
    const s = await this.prisma.setor.findUnique({
      where: { id },
      include: { _count: { select: { itens: true, movimentacoes: true } } },
    });
    if (!s) throw new NotFoundException('Setor nao encontrado');

    if (s._count.movimentacoes > 0) {
      // Tem historico: apenas desativa para preservar referencias
      await this.prisma.setor.update({ where: { id }, data: { ativo: false } });
      return { mensagem: 'Setor possui historico de movimentacoes e foi desativado em vez de excluido' };
    }

    if (s._count.itens > 0) {
      throw new BadRequestException(
        `Nao e possivel excluir: ${s._count.itens} item(ns) vinculados a este setor. Mova-os para outro setor primeiro.`
      );
    }

    await this.prisma.setor.delete({ where: { id } });
    return { mensagem: 'Setor excluido com sucesso' };
  }
}
