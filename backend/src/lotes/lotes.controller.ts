import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { LotesService } from './lotes.service';

@Controller('lotes')
@UseGuards(JwtGuard, PerfilGuard)
export class LotesController {
  constructor(private service: LotesService) {}

  @Get()
  findAll(
    @Query('itemId') itemId?: string,
    @Query('ativo') ativo?: string,
    @Query('busca') busca?: string,
  ) {
    return this.service.findAll({
      itemId,
      busca,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
  }

  @Get('alertas')
  alertas() { return this.service.alertas(); }

  // Busca pelo codigo da etiqueta (scanner na tela de Saidas)
  @Get('codigo/:codigo')
  findByCodigo(@Param('codigo') codigo: string) {
    return this.service.findByCodigo(codigo);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id') @Perfis('ADMIN', 'ALMOXARIFE')
  atualizar(@Param('id') id: string, @Body() dto: any) {
    return this.service.atualizar(id, dto);
  }
}
