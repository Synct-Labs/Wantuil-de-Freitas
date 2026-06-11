import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function calcularStatusValidade(dataValidade: Date | null): string {
  if (!dataValidade) return 'VIGENTE';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const val = new Date(dataValidade);
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
      abaixoMinimo: Number(i.saldoAtual) <= Number(i.estoqueMinimo),
    }));
  }

  async findByEan(ean: string) {
    const item = await this.prisma.item.findFirst({
      where: { codigoEan: ean, ativo: true },
      include: { categoria: true, setor: true },
    });
    if (!item) return { encontrado: false, ean };
    return { encontrado: true, item: { ...item, statusValidade: calcularStatusValidade(item.dataValidade) } };
  }

  async create(data: any) {
    if (data.codigoEan) {
      const existe = await this.prisma.item.findFirst({ where: { codigoEan: data.codigoEan, ativo: true } });
      if (existe) throw new ConflictException(`EAN ja cadastrado no item: ${existe.nome}`);
    }
    const count = await this.prisma.item.count();
    const codigoInterno = data.codigoInterno || `WF-${String(count + 1).padStart(5, '0')}`;
    return this.prisma.item.create({
      data: {
        codigoInterno,
        codigoEan: data.codigoEan || null,
        nome: data.nome,
        descricao: data.descricao,
        unidadeMedida: data.unidadeMedida || 'un',
        estoqueMinimo: data.estoqueMinimo || 0,
        dataValidade: data.dataValidade ? new Date(data.dataValidade) : null,
        localizacao: data.localizacao,
        categoriaId: data.categoriaId,
        setorId: data.setorId || null,
      },
      include: { categoria: true, setor: true },
    });
  }

  async update(id: string, data: any) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item nao encontrado');
    if (data.dataValidade) data.dataValidade = new Date(data.dataValidade);
    return this.prisma.item.update({ where: { id }, data, include: { categoria: true, setor: true } });
  }

  async desativar(id: string) {
    return this.prisma.item.update({ where: { id }, data: { ativo: false } });
  }

  async alertas() {
    const itens = await this.prisma.item.findMany({ where: { ativo: true }, include: { setor: true } });
    const comStatus = itens.map((i) => ({
      ...i,
      statusValidade: calcularStatusValidade(i.dataValidade),
      abaixoMinimo: Number(i.saldoAtual) <= Number(i.estoqueMinimo),
    }));
    return {
      descarte: comStatus.filter((i) => i.statusValidade === 'DESCARTE'),
      adicional: comStatus.filter((i) => i.statusValidade === 'ADICIONAL'),
      proximoVencimento: comStatus.filter((i) => i.statusValidade === 'PROXIMO'),
      abaixoMinimo: comStatus.filter((i) => i.abaixoMinimo),
    };
  }
}
