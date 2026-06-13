import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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
}
