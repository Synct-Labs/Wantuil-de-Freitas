import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validarCpf } from '../doadores/doadores.service';

@Injectable()
export class BeneficiariosService {
  constructor(private prisma: PrismaService) {}

  findAll(busca?: string) {
    const where: any = {};
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { cpf: { contains: busca.replace(/\D/g, '') } },
      ];
    }
    return this.prisma.beneficiario.findMany({ where, orderBy: { nome: 'asc' } });
  }

  historico(id: string) {
    return this.prisma.movimentacao.findMany({
      where: { beneficiarioId: id },
      include: { itens: { include: { item: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: any) {
    const cpf = (data.cpf || '').replace(/\D/g, '');
    if (!validarCpf(cpf)) throw new ConflictException('CPF invalido');
    const existe = await this.prisma.beneficiario.findUnique({ where: { cpf } });
    if (existe) throw new ConflictException(`CPF ja cadastrado para: ${existe.nome}`);
    if (data.dataNascimento) data.dataNascimento = new Date(data.dataNascimento);
    return this.prisma.beneficiario.create({ data: { ...data, cpf } });
  }

  update(id: string, data: any) {
    delete data.cpf;
    if (data.dataNascimento) data.dataNascimento = new Date(data.dataNascimento);
    return this.prisma.beneficiario.update({ where: { id }, data });
  }
}
