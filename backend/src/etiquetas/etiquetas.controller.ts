import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtGuard } from '../auth/jwt.guard';
import { EtiquetasService } from './etiquetas.service';

@Controller('etiquetas')
@UseGuards(JwtGuard)
export class EtiquetasController {
  constructor(private service: EtiquetasService) {}

  @Get(':itemId')
  async gerar(
    @Param('itemId') itemId: string,
    @Query('qtd') qtd: string,
    @Query('dataEntrada') dataEntrada: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.gerarPdf(itemId, Math.max(1, parseInt(qtd) || 1), dataEntrada);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename=etiquetas.pdf',
    });
    res.send(pdf);
  }
}
