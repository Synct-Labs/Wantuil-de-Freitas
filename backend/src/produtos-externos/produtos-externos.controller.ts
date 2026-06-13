import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { ProdutosExternosService } from './produtos-externos.service';

@Controller('produtos-externos')
@UseGuards(JwtGuard)
export class ProdutosExternosController {
  constructor(private service: ProdutosExternosService) {}

  @Get('ean/:ean')
  async buscar(@Param('ean') ean: string) {
    const produto = await this.service.buscarPorEan(ean);
    return produto || { encontrado: false, ean };
  }

  @Get('buscar')
  async buscarPorNome(@Query('q') termo: string) {
    return this.service.buscarPorNome(termo);
  }

  @Post('salvar-manual')
  async salvarManualmente(@Body() dto: { ean: string; nome: string; marca?: string; categoria?: string; categoriaSugerida?: string }) {
    return this.service.salvarManualmente(dto);
  }
}
