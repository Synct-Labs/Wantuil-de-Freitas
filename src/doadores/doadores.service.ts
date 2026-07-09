import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function limparDoc(doc: string) { return (doc || '').replace(/\D/g, ''); }

export function validarCpf(cpf: string): boolean {
  cpf = limparDoc(cpf);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf[10]);
}

export function validarCnpj(cnpj: string): boolean {
  cnpj = limparDoc(cnpj);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: number[]) => {
    const pesos = base.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const soma = base.reduce((acc, d, i) => acc + d * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const nums = cnpj.split('').map(Number);
  const d1 = calc(nums.slice(0, 12));
  const d2 = calc(nums.slice(0, 13));
  return d1 === nums[12] && d2 === nums[13];
}

@Injectable()
export class DoadoresService {
  constructor(private prisma: PrismaService) {}

  findAll(busca?: string) {
    const where: any = { ativo: true };
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { cpfCnpj: { contains: limparDoc(busca) } },
      ];
    }
    return this.prisma.doador.findMany({
      where,
      include: { _count: { select: { movimentacoes: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  historico(id: string) {
    return this.prisma.movimentacao.findMany({
      where: { doadorId: id },
      include: { itens: { include: { item: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: any) {
    const doc = limparDoc(data.cpfCnpj);
    const valido = data.tipo === 'PJ' ? validarCnpj(doc) : validarCpf(doc);
    if (!valido) throw new ConflictException(`${data.tipo === 'PJ' ? 'CNPJ' : 'CPF'} invalido`);

    const existe = await this.prisma.doador.findUnique({ where: { cpfCnpj: doc } });
    if (existe) throw new ConflictException(`Documento ja cadastrado para: ${existe.nome}`);

    return this.prisma.doador.create({ data: { ...data, cpfCnpj: doc } });
  }

  update(id: string, data: any) {
    delete data.cpfCnpj;
    return this.prisma.doador.update({ where: { id }, data });
  }

  async excluir(id: string) {
    const d = await this.prisma.doador.findUnique({
      where: { id },
      include: { _count: { select: { movimentacoes: true } } },
    });
    if (!d) throw new NotFoundException('Doador nao encontrado');

    if (d._count.movimentacoes > 0) {
      await this.prisma.doador.update({ where: { id }, data: { ativo: false } });
      return { mensagem: 'Doador possui historico e foi desativado em vez de excluido', desativado: true };
    }

    await this.prisma.doador.delete({ where: { id } });
    return { mensagem: 'Doador excluido permanentemente', excluido: true };
  }
}
