import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtGuard } from '../auth/jwt.guard';
import { RelatoriosService } from './relatorios.service';

@Controller('relatorios')
@UseGuards(JwtGuard)
export class RelatoriosController {
  constructor(private service: RelatoriosService) {}

  @Get('estoque')
  estoque(@Query('setorId') setorId?: string) {
    return this.service.posicaoEstoque(setorId);
  }

  @Get('movimentacoes')
  movs(
    @Query('dataInicio') di: string, @Query('dataFim') df: string,
    @Query('setorId') setorId?: string, @Query('tipo') tipo?: string,
  ) {
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

  @Get('auditoria')
  auditoria(@Query('dataInicio') di: string, @Query('dataFim') df: string) {
    return this.service.logAuditoria(di, df);
  }

  @Get('estoque/excel')
  async estoqueExcel(@Res() res: Response, @Query('setorId') setorId?: string) {
    const buf = await this.service.excelPosicaoEstoque(setorId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=posicao_estoque.xlsx',
    });
    res.send(buf);
  }

  @Get('movimentacoes/excel')
  async movsExcel(
    @Res() res: Response,
    @Query('dataInicio') di: string, @Query('dataFim') df: string, @Query('setorId') setorId?: string,
  ) {
    const buf = await this.service.excelMovimentacoes(di, df, setorId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=movimentacoes.xlsx',
    });
    res.send(buf);
  }
}
