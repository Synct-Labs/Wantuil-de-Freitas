import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { RelatoriosService } from './relatorios.service';

@Controller('relatorios')
@UseGuards(JwtGuard, PerfilGuard)
@Perfis('MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR')
export class RelatoriosController {
  constructor(private service: RelatoriosService) {}

  // ═══════════ JSON (dados pra tela) ═══════════
  @Get('estoque') estoque(@Query('setorId') setorId?: string) { return this.service.posicaoEstoque(setorId); }

  @Get('movimentacoes')
  movs(@Query('dataInicio') di: string, @Query('dataFim') df: string,
    @Query('setorId') setorId?: string, @Query('tipo') tipo?: string) {
    return this.service.movimentacoes(di, df, setorId, tipo);
  }

  @Get('doacoes')
  doacoes(@Query('dataInicio') di: string, @Query('dataFim') df: string) {
    return this.service.doacoesPorDoador(di, df);
  }

  @Get('distribuicao')
  distribuicao(@Query('dataInicio') di: string, @Query('dataFim') df: string) {
    return this.service.distribuicaoPorBeneficiario(di, df);
  }

  @Get('top-produtos')
  topProdutos(@Query('dataInicio') di: string, @Query('dataFim') df: string) {
    return this.service.topProdutos(di, df);
  }

  @Get('resumo-executivo')
  resumoExecutivo(@Query('dataInicio') di: string, @Query('dataFim') df: string) {
    return this.service.resumoExecutivo(di, df);
  }

  @Get('auditoria') @Perfis('MASTER')
  auditoria(@Query('dataInicio') di: string, @Query('dataFim') df: string) {
    return this.service.logAuditoria(di, df);
  }

  // ═══════════ EXCEL ═══════════
  @Get('estoque/excel')
  async estoqueExcel(@Res() res: Response, @Query('setorId') setorId?: string) {
    const buf = await this.service.excelPosicaoEstoque(setorId);
    enviarPlanilha(res, buf, 'posicao_estoque.xlsx');
  }

  @Get('movimentacoes/excel')
  async movsExcel(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string,
    @Query('setorId') setorId?: string) {
    const buf = await this.service.excelMovimentacoes(di, df, setorId);
    enviarPlanilha(res, buf, 'movimentacoes.xlsx');
  }

  @Get('doacoes/excel')
  async doacoesExcel(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string) {
    const buf = await this.service.excelDoacoesPorDoador(di, df);
    enviarPlanilha(res, buf, 'doacoes_por_doador.xlsx');
  }

  @Get('distribuicao/excel')
  async distribuicaoExcel(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string) {
    const buf = await this.service.excelDistribuicao(di, df);
    enviarPlanilha(res, buf, 'distribuicao_por_beneficiario.xlsx');
  }

  @Get('top-produtos/excel')
  async topProdutosExcel(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string) {
    const buf = await this.service.excelTopProdutos(di, df);
    enviarPlanilha(res, buf, 'top_produtos.xlsx');
  }

  // ═══════════ PDF ═══════════
  @Get('estoque/pdf')
  async estoquePdf(@Res() res: Response, @Query('setorId') setorId?: string) {
    const buf = await this.service.pdfPosicaoEstoque(setorId);
    enviarPdf(res, buf, 'posicao_estoque.pdf');
  }

  @Get('movimentacoes/pdf')
  async movsPdf(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string,
    @Query('setorId') setorId?: string, @Query('tipo') tipo?: string) {
    const buf = await this.service.pdfMovimentacoes(di, df, setorId, tipo);
    enviarPdf(res, buf, 'movimentacoes.pdf');
  }

  @Get('doacoes/pdf')
  async doacoesPdf(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string) {
    const buf = await this.service.pdfDoacoesPorDoador(di, df);
    enviarPdf(res, buf, 'doacoes_por_doador.pdf');
  }

  @Get('distribuicao/pdf')
  async distribuicaoPdf(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string) {
    const buf = await this.service.pdfDistribuicao(di, df);
    enviarPdf(res, buf, 'distribuicao_por_beneficiario.pdf');
  }

  @Get('top-produtos/pdf')
  async topProdutosPdf(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string) {
    const buf = await this.service.pdfTopProdutos(di, df);
    enviarPdf(res, buf, 'top_produtos.pdf');
  }

  @Get('resumo-executivo/pdf')
  async resumoExecutivoPdf(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string) {
    const buf = await this.service.pdfResumoExecutivo(di, df);
    enviarPdf(res, buf, 'resumo_executivo.pdf');
  }

  @Get('auditoria/pdf') @Perfis('MASTER')
  async auditoriaPdf(@Res() res: Response, @Query('dataInicio') di: string, @Query('dataFim') df: string) {
    const buf = await this.service.pdfAuditoria(di, df);
    enviarPdf(res, buf, 'auditoria.pdf');
  }
}

function enviarPdf(res: Response, buf: Buffer, nome: string) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${nome}"`,
    'Content-Length': buf.length,
  });
  res.end(buf);
}

function enviarPlanilha(res: Response, buf: Buffer, nome: string) {
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${nome}"`,
  });
  res.end(buf);
}
