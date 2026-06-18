import { Injectable } from '@nestjs/common';
import { fmtData } from '../common/data-fuso';
import { PrismaService } from '../prisma/prisma.service';
import { calcularStatusValidade } from '../itens/itens.service';
import * as ExcelJS from 'exceljs';
import { gerarRelatorioPdf, formatadores } from './pdf-relatorio.helper';

const COR_PETROLEO_HEX = 'FF2A4A8A';      // azul Wantuil
const COR_PETROLEO_CLARO_HEX = 'FFE8F3F4'; // fundo petróleo claro

@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

  // ═══════════ CONSULTAS ═══════════

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
      setor: i.setor?.nome || '—',
      saldo: Number(i.saldoAtual),
      unidade: i.unidadeMedida,
      minimo: Number(i.estoqueMinimo),
      abaixoMinimo: Number(i.estoqueMinimo) > 0 && Number(i.saldoAtual) <= Number(i.estoqueMinimo),
      validade: i.dataValidade,
      statusValidade: calcularStatusValidade(i.dataValidade),
    }));
  }

  async movimentacoes(dataInicio: string, dataFim: string, setorId?: string, tipo?: string) {
    const where: any = {
      dataMovimentacao: { gte: new Date(dataInicio), lte: new Date(dataFim + 'T23:59:59') },
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
      where: {
        tipo: 'ENTRADA',
        dataMovimentacao: { gte: new Date(dataInicio), lte: new Date(dataFim + 'T23:59:59') },
      },
      include: { doador: true, itens: { include: { item: true } } },
    });
    const porDoador: Record<string, any> = {};
    for (const m of movs) {
      const key = m.doador?.nome || 'Doação avulsa';
      if (!porDoador[key]) {
        porDoador[key] = {
          doador: key,
          documento: m.doador?.cpfCnpj || '',
          totalDoacoes: 0,
          totalItens: 0,
          totalQuantidade: 0,
          ultimaDoacao: m.dataMovimentacao,
        };
      }
      porDoador[key].totalDoacoes++;
      for (const mi of m.itens) {
        porDoador[key].totalItens++;
        porDoador[key].totalQuantidade += Number(mi.quantidade);
      }
      if (new Date(m.dataMovimentacao) > new Date(porDoador[key].ultimaDoacao)) {
        porDoador[key].ultimaDoacao = m.dataMovimentacao;
      }
    }
    return Object.values(porDoador).sort((a: any, b: any) => b.totalDoacoes - a.totalDoacoes);
  }

  async distribuicaoPorBeneficiario(dataInicio: string, dataFim: string) {
    const movs = await this.prisma.movimentacao.findMany({
      where: {
        tipo: 'SAIDA', destinoSaida: 'BENEFICIARIO',
        dataMovimentacao: { gte: new Date(dataInicio), lte: new Date(dataFim + 'T23:59:59') },
      },
      include: { beneficiario: true, itens: { include: { item: true } } },
    });
    const por: Record<string, any> = {};
    for (const m of movs) {
      const key = m.beneficiario?.nome || '—';
      if (!por[key]) {
        por[key] = {
          beneficiario: key,
          cpf: m.beneficiario?.cpf || '',
          bairro: m.beneficiario?.bairro || '',
          retiradas: 0,
          totalItens: 0,
          totalQuantidade: 0,
          ultimaRetirada: m.dataMovimentacao,
        };
      }
      por[key].retiradas++;
      for (const mi of m.itens) {
        por[key].totalItens++;
        por[key].totalQuantidade += Number(mi.quantidade);
      }
      if (new Date(m.dataMovimentacao) > new Date(por[key].ultimaRetirada)) {
        por[key].ultimaRetirada = m.dataMovimentacao;
      }
    }
    return Object.values(por).sort((a: any, b: any) => b.retiradas - a.retiradas);
  }

  async logAuditoria(dataInicio: string, dataFim: string) {
    return this.prisma.logAuditoria.findMany({
      where: { createdAt: { gte: new Date(dataInicio), lte: new Date(dataFim + 'T23:59:59') } },
      include: { usuario: { select: { nome: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  // ═══════════ NOVOS RELATORIOS ═══════════

  /** Top 20 itens mais movimentados (por quantidade) no periodo. */
  async topProdutos(dataInicio: string, dataFim: string, limite = 20) {
    const movs = await this.prisma.movimentacao.findMany({
      where: {
        tipo: { in: ['ENTRADA', 'SAIDA'] },
        dataMovimentacao: { gte: new Date(dataInicio), lte: new Date(dataFim + 'T23:59:59') },
      },
      include: { itens: { include: { item: true } } },
    });
    const porItem: Record<string, any> = {};
    for (const m of movs) {
      for (const mi of m.itens) {
        const key = mi.item.id;
        if (!porItem[key]) {
          porItem[key] = {
            codigo: mi.item.codigoInterno,
            nome: mi.item.nome,
            unidade: mi.item.unidadeMedida,
            entradas: 0,
            saidas: 0,
            saldoAtual: Number(mi.item.saldoAtual),
            total: 0,
          };
        }
        if (m.tipo === 'ENTRADA') porItem[key].entradas += Number(mi.quantidade);
        if (m.tipo === 'SAIDA') porItem[key].saidas += Number(mi.quantidade);
        porItem[key].total += Number(mi.quantidade);
      }
    }
    return Object.values(porItem)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, limite);
  }

  /** Resumo executivo do periodo com KPIs e top 3s. */
  async resumoExecutivo(dataInicio: string, dataFim: string) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim + 'T23:59:59');

    const movs = await this.prisma.movimentacao.findMany({
      where: { dataMovimentacao: { gte: inicio, lte: fim } },
      include: { doador: true, beneficiario: true, itens: { include: { item: true } } },
    });

    const entradas = movs.filter((m) => m.tipo === 'ENTRADA');
    const saidasBenef = movs.filter((m) => m.tipo === 'SAIDA' && m.destinoSaida === 'BENEFICIARIO');
    const saidasSetor = movs.filter((m) => m.tipo === 'SAIDA' && m.destinoSaida === 'SETOR');
    const descartes = movs.filter((m) => m.tipo === 'DESCARTE');

    const qtdEntradas = entradas.reduce((s, m) =>
      s + m.itens.reduce((sa, mi) => sa + Number(mi.quantidade), 0), 0);
    const qtdSaidas = saidasBenef.concat(saidasSetor).reduce((s, m) =>
      s + m.itens.reduce((sa, mi) => sa + Number(mi.quantidade), 0), 0);
    const qtdDescartes = descartes.reduce((s, m) =>
      s + m.itens.reduce((sa, mi) => sa + Number(mi.quantidade), 0), 0);

    // Itens unicos atendidos (saidas para beneficiarios)
    const beneficiariosUnicos = new Set(saidasBenef.map((m) => m.beneficiarioId).filter(Boolean));
    const doadoresUnicos = new Set(entradas.map((m) => m.doadorId).filter(Boolean));

    // Top doadores
    const topDoadores = await this.doacoesPorDoador(dataInicio, dataFim);
    const topBeneficiarios = await this.distribuicaoPorBeneficiario(dataInicio, dataFim);
    const topItens = await this.topProdutos(dataInicio, dataFim, 5);

    // Alertas atuais (independente do periodo)
    const itensAlerta = await this.prisma.item.findMany({ where: { ativo: true } });
    const proximoVenc = itensAlerta.filter((i) =>
      calcularStatusValidade(i.dataValidade) === 'PROXIMO').length;
    const paraDescarte = itensAlerta.filter((i) =>
      calcularStatusValidade(i.dataValidade) === 'DESCARTE').length;
    const abaixoMinimo = itensAlerta.filter((i) =>
      Number(i.estoqueMinimo) > 0 && Number(i.saldoAtual) <= Number(i.estoqueMinimo)).length;

    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      kpis: {
        totalEntradas: entradas.length,
        totalSaidas: saidasBenef.length + saidasSetor.length,
        totalDescartes: descartes.length,
        quantidadeRecebida: qtdEntradas,
        quantidadeDistribuida: qtdSaidas,
        quantidadeDescartada: qtdDescartes,
        doadoresUnicos: doadoresUnicos.size,
        beneficiariosAtendidos: beneficiariosUnicos.size,
      },
      alertasAtuais: {
        proximoVencimento: proximoVenc,
        paraDescarte: paraDescarte,
        abaixoMinimo: abaixoMinimo,
      },
      topDoadores: topDoadores.slice(0, 5),
      topBeneficiarios: topBeneficiarios.slice(0, 5),
      topItens,
    };
  }

  // ═══════════ EXPORTACAO PDF ═══════════

  async pdfPosicaoEstoque(setorId?: string): Promise<Buffer> {
    const dados = await this.posicaoEstoque(setorId);
    let setorNome = '';
    if (setorId) {
      const s = await this.prisma.setor.findUnique({ where: { id: setorId } });
      setorNome = s?.nome || '';
    }
    const valorTotal = dados.reduce((s, d) => s + d.saldo, 0);
    const abaixoMinimo = dados.filter((d) => d.abaixoMinimo).length;

    return gerarRelatorioPdf({
      titulo: 'Posição Atual de Estoque',
      subtitulo: 'Saldo de todos os itens ativos do almoxarifado',
      filtros: setorNome ? [{ label: 'Setor', valor: setorNome }] : [],
      orientacao: 'landscape',
      resumo: [
        { label: 'Total de itens', valor: dados.length },
        { label: 'Quantidade total em estoque', valor: formatadores.numero(valorTotal) },
        { label: 'Abaixo do mínimo', valor: abaixoMinimo },
      ],
      colunas: [
        { titulo: 'Código', campo: 'codigo', largura: 0.10 },
        { titulo: 'Item', campo: 'nome', largura: 0.30 },
        { titulo: 'Categoria', campo: 'categoria', largura: 0.13 },
        { titulo: 'Setor', campo: 'setor', largura: 0.13 },
        { titulo: 'Saldo', campo: 'saldo', largura: 0.10, alinhamento: 'right',
          formatar: (v, row) => `${formatadores.numero(v)} ${row.unidade}` },
        { titulo: 'Mín.', campo: 'minimo', largura: 0.07, alinhamento: 'right', formatar: formatadores.numero },
        { titulo: 'Validade', campo: 'validade', largura: 0.09, formatar: formatadores.data },
        { titulo: 'Status', campo: 'statusValidade', largura: 0.08,
          formatar: (v) => ({ VIGENTE: 'OK', PROXIMO: 'Próx. venc.', ADICIONAL: 'Vencido', DESCARTE: 'Descarte' })[v] || v },
      ],
      linhas: dados,
    });
  }

  async pdfMovimentacoes(dataInicio: string, dataFim: string, setorId?: string, tipo?: string): Promise<Buffer> {
    const movs = await this.movimentacoes(dataInicio, dataFim, setorId, tipo);
    const linhas: any[] = [];
    for (const m of movs) {
      for (const mi of m.itens) {
        linhas.push({
          data: m.dataMovimentacao,
          tipo: m.tipo,
          item: mi.item.nome,
          quantidade: Number(mi.quantidade),
          unidade: mi.item.unidadeMedida,
          destino: m.doador?.nome || m.beneficiario?.nome || m.setor?.nome || '—',
          usuario: m.usuario.nome,
        });
      }
    }
    const totalEntradas = linhas.filter((l) => l.tipo === 'ENTRADA').reduce((s, l) => s + l.quantidade, 0);
    const totalSaidas = linhas.filter((l) => l.tipo === 'SAIDA').reduce((s, l) => s + l.quantidade, 0);

    return gerarRelatorioPdf({
      titulo: 'Movimentações',
      subtitulo: 'Histórico de entradas, saídas, descartes e estornos',
      periodo: { inicio: dataInicio, fim: dataFim },
      filtros: tipo ? [{ label: 'Tipo', valor: tipo }] : [],
      resumo: [
        { label: 'Movimentações', valor: movs.length },
        { label: 'Itens movimentados', valor: linhas.length },
        { label: 'Total entradas', valor: formatadores.numero(totalEntradas) },
        { label: 'Total saídas', valor: formatadores.numero(totalSaidas) },
      ],
      colunas: [
        { titulo: 'Data', campo: 'data', largura: 0.12, formatar: formatadores.data },
        { titulo: 'Tipo', campo: 'tipo', largura: 0.10 },
        { titulo: 'Item', campo: 'item', largura: 0.32 },
        { titulo: 'Qtd', campo: 'quantidade', largura: 0.10, alinhamento: 'right',
          formatar: (v, r) => `${formatadores.numero(v)} ${r.unidade}` },
        { titulo: 'Origem / Destino', campo: 'destino', largura: 0.22 },
        { titulo: 'Usuário', campo: 'usuario', largura: 0.14 },
      ],
      linhas,
    });
  }

  async pdfDoacoesPorDoador(dataInicio: string, dataFim: string): Promise<Buffer> {
    const dados = await this.doacoesPorDoador(dataInicio, dataFim);
    const totalDoacoes = dados.reduce((s: number, d: any) => s + d.totalDoacoes, 0);
    const totalItens = dados.reduce((s: number, d: any) => s + d.totalItens, 0);

    return gerarRelatorioPdf({
      titulo: 'Doações por Doador',
      subtitulo: 'Doações recebidas agrupadas por doador',
      periodo: { inicio: dataInicio, fim: dataFim },
      resumo: [
        { label: 'Doadores ativos', valor: dados.length },
        { label: 'Total de doações', valor: totalDoacoes },
        { label: 'Itens recebidos', valor: totalItens },
      ],
      colunas: [
        { titulo: 'Doador', campo: 'doador', largura: 0.40 },
        { titulo: 'Documento', campo: 'documento', largura: 0.18 },
        { titulo: 'Doações', campo: 'totalDoacoes', largura: 0.12, alinhamento: 'right' },
        { titulo: 'Itens', campo: 'totalItens', largura: 0.10, alinhamento: 'right' },
        { titulo: 'Última doação', campo: 'ultimaDoacao', largura: 0.20, formatar: formatadores.data },
      ],
      linhas: dados,
    });
  }

  async pdfDistribuicao(dataInicio: string, dataFim: string): Promise<Buffer> {
    const dados = await this.distribuicaoPorBeneficiario(dataInicio, dataFim);
    const totalRetiradas = dados.reduce((s: number, d: any) => s + d.retiradas, 0);
    const totalItens = dados.reduce((s: number, d: any) => s + d.totalItens, 0);

    return gerarRelatorioPdf({
      titulo: 'Distribuição por Beneficiário',
      subtitulo: 'Itens entregues a famílias atendidas',
      periodo: { inicio: dataInicio, fim: dataFim },
      resumo: [
        { label: 'Beneficiários atendidos', valor: dados.length },
        { label: 'Total de retiradas', valor: totalRetiradas },
        { label: 'Itens distribuídos', valor: totalItens },
      ],
      colunas: [
        { titulo: 'Beneficiário', campo: 'beneficiario', largura: 0.34 },
        { titulo: 'CPF', campo: 'cpf', largura: 0.16 },
        { titulo: 'Bairro', campo: 'bairro', largura: 0.18 },
        { titulo: 'Retiradas', campo: 'retiradas', largura: 0.10, alinhamento: 'right' },
        { titulo: 'Itens', campo: 'totalItens', largura: 0.08, alinhamento: 'right' },
        { titulo: 'Última', campo: 'ultimaRetirada', largura: 0.14, formatar: formatadores.data },
      ],
      linhas: dados,
    });
  }

  async pdfAuditoria(dataInicio: string, dataFim: string): Promise<Buffer> {
    const logs = await this.logAuditoria(dataInicio, dataFim);
    return gerarRelatorioPdf({
      titulo: 'Log de Auditoria',
      subtitulo: 'Histórico de operações realizadas no sistema',
      periodo: { inicio: dataInicio, fim: dataFim },
      orientacao: 'landscape',
      resumo: [
        { label: 'Total de eventos', valor: logs.length },
      ],
      colunas: [
        { titulo: 'Data/Hora', campo: 'createdAt', largura: 0.16, formatar: formatadores.dataHora },
        { titulo: 'Usuário', campo: 'usuario.nome', largura: 0.18 },
        { titulo: 'Ação', campo: 'acao', largura: 0.16 },
        { titulo: 'Entidade', campo: 'entidade', largura: 0.14 },
        { titulo: 'Descrição', campo: 'descricao', largura: 0.36 },
      ],
      linhas: logs,
    });
  }

  async pdfTopProdutos(dataInicio: string, dataFim: string): Promise<Buffer> {
    const dados = await this.topProdutos(dataInicio, dataFim, 30);
    return gerarRelatorioPdf({
      titulo: 'Produtos Mais Movimentados',
      subtitulo: 'Top 30 itens com maior volume de movimentações no período',
      periodo: { inicio: dataInicio, fim: dataFim },
      resumo: [
        { label: 'Itens no ranking', valor: dados.length },
        { label: 'Volume total', valor: formatadores.numero(dados.reduce((s: number, d: any) => s + d.total, 0)) },
      ],
      colunas: [
        { titulo: 'Código', campo: 'codigo', largura: 0.12 },
        { titulo: 'Item', campo: 'nome', largura: 0.40 },
        { titulo: 'Entradas', campo: 'entradas', largura: 0.13, alinhamento: 'right', formatar: formatadores.numero },
        { titulo: 'Saídas', campo: 'saidas', largura: 0.12, alinhamento: 'right', formatar: formatadores.numero },
        { titulo: 'Volume', campo: 'total', largura: 0.11, alinhamento: 'right', formatar: formatadores.numero },
        { titulo: 'Saldo atual', campo: 'saldoAtual', largura: 0.12, alinhamento: 'right',
          formatar: (v, r) => `${formatadores.numero(v)} ${r.unidade}` },
      ],
      linhas: dados,
    });
  }

  async pdfResumoExecutivo(dataInicio: string, dataFim: string): Promise<Buffer> {
    const r = await this.resumoExecutivo(dataInicio, dataFim);
    const linhas = [
      { metrica: 'Total de entradas', valor: r.kpis.totalEntradas },
      { metrica: 'Total de saídas', valor: r.kpis.totalSaidas },
      { metrica: 'Total de descartes', valor: r.kpis.totalDescartes },
      { metrica: 'Quantidade recebida', valor: formatadores.numero(r.kpis.quantidadeRecebida) },
      { metrica: 'Quantidade distribuída', valor: formatadores.numero(r.kpis.quantidadeDistribuida) },
      { metrica: 'Quantidade descartada', valor: formatadores.numero(r.kpis.quantidadeDescartada) },
      { metrica: 'Doadores únicos no período', valor: r.kpis.doadoresUnicos },
      { metrica: 'Beneficiários atendidos no período', valor: r.kpis.beneficiariosAtendidos },
      { metrica: '— Alertas atuais —', valor: '' },
      { metrica: 'Itens próximos do vencimento', valor: r.alertasAtuais.proximoVencimento },
      { metrica: 'Itens para descarte', valor: r.alertasAtuais.paraDescarte },
      { metrica: 'Itens abaixo do estoque mínimo', valor: r.alertasAtuais.abaixoMinimo },
    ];

    return gerarRelatorioPdf({
      titulo: 'Resumo Executivo',
      subtitulo: 'Visão geral das operações do período',
      periodo: { inicio: dataInicio, fim: dataFim },
      resumo: [
        { label: 'Entradas', valor: r.kpis.totalEntradas },
        { label: 'Saídas', valor: r.kpis.totalSaidas },
        { label: 'Doadores', valor: r.kpis.doadoresUnicos },
        { label: 'Beneficiários', valor: r.kpis.beneficiariosAtendidos },
      ],
      colunas: [
        { titulo: 'Métrica', campo: 'metrica', largura: 0.70 },
        { titulo: 'Valor', campo: 'valor', largura: 0.30, alinhamento: 'right' },
      ],
      linhas,
    });
  }

  // ═══════════ EXCEL (com identidade visual Wantuil) ═══════════

  private aplicarCabecalhoExcel(ws: ExcelJS.Worksheet) {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_PETROLEO_HEX } };
    row.height = 22;
    row.alignment = { vertical: 'middle' };
  }

  async excelPosicaoEstoque(setorId?: string): Promise<Buffer> {
    const dados = await this.posicaoEstoque(setorId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Posição de Estoque');
    ws.columns = [
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'EAN', key: 'ean', width: 16 },
      { header: 'Item', key: 'nome', width: 36 },
      { header: 'Categoria', key: 'categoria', width: 16 },
      { header: 'Setor', key: 'setor', width: 18 },
      { header: 'Saldo', key: 'saldo', width: 10 },
      { header: 'Un', key: 'unidade', width: 8 },
      { header: 'Mínimo', key: 'minimo', width: 10 },
      { header: 'Status Validade', key: 'statusValidade', width: 16 },
    ];
    this.aplicarCabecalhoExcel(ws);
    for (const d of dados) {
      const row = ws.addRow(d);
      if (d.abaixoMinimo) {
        row.getCell('saldo').font = { color: { argb: 'FFB0312D' }, bold: true };
      }
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async excelMovimentacoes(dataInicio: string, dataFim: string, setorId?: string): Promise<Buffer> {
    const movs = await this.movimentacoes(dataInicio, dataFim, setorId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Movimentações');
    ws.columns = [
      { header: 'Data', key: 'data', width: 12 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Item', key: 'item', width: 36 },
      { header: 'Qtd', key: 'qtd', width: 8 },
      { header: 'Un', key: 'unidade', width: 6 },
      { header: 'Origem/Destino', key: 'destino', width: 28 },
      { header: 'Usuário', key: 'usuario', width: 20 },
    ];
    this.aplicarCabecalhoExcel(ws);
    for (const m of movs) {
      const destino = m.doador?.nome || m.beneficiario?.nome || m.setor?.nome || '—';
      for (const mi of m.itens) {
        ws.addRow({
          data: fmtData(m.dataMovimentacao),
          tipo: m.tipo,
          item: mi.item.nome,
          qtd: Number(mi.quantidade),
          unidade: mi.item.unidadeMedida,
          destino,
          usuario: m.usuario.nome,
        });
      }
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async excelDoacoesPorDoador(dataInicio: string, dataFim: string): Promise<Buffer> {
    const dados = await this.doacoesPorDoador(dataInicio, dataFim);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Doações por Doador');
    ws.columns = [
      { header: 'Doador', key: 'doador', width: 36 },
      { header: 'Documento', key: 'documento', width: 18 },
      { header: 'Doações', key: 'totalDoacoes', width: 12 },
      { header: 'Itens', key: 'totalItens', width: 10 },
      { header: 'Quantidade total', key: 'totalQuantidade', width: 18 },
      { header: 'Última doação', key: 'ultimaDoacao', width: 16 },
    ];
    this.aplicarCabecalhoExcel(ws);
    for (const d of dados as any[]) {
      ws.addRow({ ...d, ultimaDoacao: fmtData(d.ultimaDoacao) });
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async excelDistribuicao(dataInicio: string, dataFim: string): Promise<Buffer> {
    const dados = await this.distribuicaoPorBeneficiario(dataInicio, dataFim);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Distribuição');
    ws.columns = [
      { header: 'Beneficiário', key: 'beneficiario', width: 36 },
      { header: 'CPF', key: 'cpf', width: 18 },
      { header: 'Bairro', key: 'bairro', width: 20 },
      { header: 'Retiradas', key: 'retiradas', width: 12 },
      { header: 'Itens', key: 'totalItens', width: 10 },
      { header: 'Quantidade total', key: 'totalQuantidade', width: 18 },
      { header: 'Última retirada', key: 'ultimaRetirada', width: 16 },
    ];
    this.aplicarCabecalhoExcel(ws);
    for (const d of dados as any[]) {
      ws.addRow({ ...d, ultimaRetirada: fmtData(d.ultimaRetirada) });
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async excelTopProdutos(dataInicio: string, dataFim: string): Promise<Buffer> {
    const dados = await this.topProdutos(dataInicio, dataFim, 50);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Top Produtos');
    ws.columns = [
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Item', key: 'nome', width: 40 },
      { header: 'Entradas', key: 'entradas', width: 12 },
      { header: 'Saídas', key: 'saidas', width: 12 },
      { header: 'Volume total', key: 'total', width: 14 },
      { header: 'Saldo atual', key: 'saldoAtual', width: 14 },
      { header: 'Un', key: 'unidade', width: 8 },
    ];
    this.aplicarCabecalhoExcel(ws);
    for (const d of dados) ws.addRow(d);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
