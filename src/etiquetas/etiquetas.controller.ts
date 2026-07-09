import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtGuard } from '../auth/jwt.guard';
import { EtiquetasService } from './etiquetas.service';

@Controller('etiquetas')
@UseGuards(JwtGuard)
export class EtiquetasController {
  constructor(private service: EtiquetasService) {}

  /**
   * Gera N etiquetas para um lote especifico.
   * URL: /api/etiquetas/lote/:loteId?qtd=5
   */
  @Get('lote/:loteId')
  async gerarLote(
    @Param('loteId') loteId: string,
    @Query('qtd') qtd: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.gerarPdfLote(loteId, Math.max(1, parseInt(qtd) || 1));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename=etiquetas.pdf',
    });
    res.send(pdf);
  }
}
