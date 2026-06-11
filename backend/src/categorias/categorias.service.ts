import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.categoria.findMany({ orderBy: { nome: 'asc' } }); }
  create(data: { nome: string; descricao?: string }) { return this.prisma.categoria.create({ data }); }
}
