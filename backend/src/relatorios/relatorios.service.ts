import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcularStatusValidade } from '../itens/itens.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

  async posicaoEstoque(setorId?: string) {
    const itens = await this.prisma.item.findMany({
      where: { ativo: true, ...(setorId ? { setorId } : {}) },
      include: { categoria: true, setor: true },
      orderBy: [{ setor: { nome: 'asc' } }, { nome: 'asc' }],
    });
    return itens.map((i) => ({
      codigo: i.codigoInterno,
      ean: i.codigoEan,
      nome: i.nome,
      categoria: i.categoria.nome,
      setor: i.setor?.nome || '-',
      saldo: Number(i.saldoAtual),
      unidade: i.unidadeMedida,
      minimo: Number(i.estoqueMinimo),
      abaixoMinimo: Number(i.saldoAtual) <= Number(i.estoqueMinimo),
      validade: i.dataValidade,
      statusValidade: calcularStatusValidade(i.dataValidade),
    }));
  }

  async movimentacoes(dataInicio: string, dataFim: string, setorId?: string, tipo?: string) {
    const where: any = {
      dataMovimentacao: { gte: new Date(dataInicio), lte: new Date(dataFim) },
    };
    if (setorId) where.setorId = setorId;
    if (tipo) where.tipo = tipo;
    return this.prisma.movimentacao.findMany({
      where,
      include: {
        itens: { include: { item: true } },
        doador: true, beneficiario: true, setor: true,
        usuario: { select: { nome: true } },
      },
      orderBy: { dataMovimentacao: 'desc' },
    });
  }

  async doacoesPorDoador(dataInicio: string, dataFim: string) {
    const movs = await this.prisma.movimentacao.findMany({
      where: { tipo: 'ENTRADA', dataMovimentacao: { gte: new Date(dataInicio), lte: new Date(dataFim) } },
      include: { doador: true, itens: { include: { item: true } } },
    });
    const porDoador: Record<string, any> = {};
    for (const m of movs) {
      const key = m.doador?.nome || 'Doacao avulsa';
      if (!porDoador[key]) porDoador[key] = { doador: key, totalDoacoes: 0, itens: [] };
      porDoador[key].totalDoacoes++;
      for (const mi of m.itens) {
        porDoador[key].itens.push({ item: mi.item.nome, quantidade: Number(mi.quantidade), data: m.dataMovimentacao });
      }
    }
    return Object.values(porDoador);
  }

  async distribuicaoPorBeneficiario(dataInicio: string, dataFim: string) {
    const movs = await this.prisma.movimentacao.findMany({
      where: { tipo: 'SAIDA', destinoSaida: 'BENEFICIARIO',
        dataMovimentacao: { gte: new Date(dataInicio), lte: new Date(dataFim) } },
      include: { beneficiario: true, itens: { include: { item: true } } },
    });
    const por: Record<string, any> = {};
    for (const m of movs) {
      const key = m.beneficiario?.nome || '-';
      if (!por[key]) por[key] = { beneficiario: key, cpf: m.beneficiario?.cpf, retiradas: 0, itens: [] };
      por[key].retiradas++;
      for (const mi of m.itens) {
        por[key].itens.push({ item: mi.item.nome, quantidade: Number(mi.quantidade), data: m.dataMovimentacao });
      }
    }
    return Object.values(por);
  }

  async logAuditoria(dataInicio: string, dataFim: string) {
    return this.prisma.logAuditoria.findMany({
      where: { createdAt: { gte: new Date(dataInicio), lte: new Date(dataFim + 'T23:59:59') } },
      include: { usuario: { select: { nome: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  // ── Exportacao Excel ──
  async excelPosicaoEstoque(setorId?: string): Promise<Buffer> {
    const dados = await this.posicaoEstoque(setorId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Posicao de Estoque');

    ws.columns = [
      { header: 'Codigo', key: 'codigo', width: 12 },
      { header: 'EAN', key: 'ean', width: 16 },
      { header: 'Item', key: 'nome', width: 32 },
      { header: 'Categoria', key: 'categoria', width: 14 },
      { header: 'Setor', key: 'setor', width: 16 },
      { header: 'Saldo', key: 'saldo', width: 10 },
      { header: 'Un', key: 'unidade', width: 8 },
      { header: 'Minimo', key: 'minimo', width: 10 },
      { header: 'Status Validade', key: 'statusValidade', width: 16 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6D0F' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const d of dados) {
      const row = ws.addRow(d);
      if (d.abaixoMinimo) row.getCell('saldo').font = { color: { argb: 'FFA32D2D' }, bold: true };
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async excelMovimentacoes(dataInicio: string, dataFim: string, setorId?: string): Promise<Buffer> {
    const movs = await this.movimentacoes(dataInicio, dataFim, setorId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Movimentacoes');
    ws.columns = [
      { header: 'Data', key: 'data', width: 12 },
      { header: 'Tipo', key: 'tipo', width: 10 },
      { header: 'Item', key: 'item', width: 32 },
      { header: 'Qtd', key: 'qtd', width: 8 },
      { header: 'Origem/Destino', key: 'destino', width: 28 },
      { header: 'Usuario', key: 'usuario', width: 18 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6D0F' } };

    for (const m of movs) {
      const destino = m.doador?.nome || m.beneficiario?.nome || m.setor?.nome || '-';
      for (const mi of m.itens) {
        ws.addRow({
          data: new Date(m.dataMovimentacao).toLocaleDateString('pt-BR'),
          tipo: m.tipo,
          item: mi.item.nome,
          qtd: Number(mi.quantidade),
          destino,
          usuario: m.usuario.nome,
        });
      }
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
