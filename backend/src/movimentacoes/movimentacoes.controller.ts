import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { MovimentacoesService } from './movimentacoes.service';

@Controller('movimentacoes')
@UseGuards(JwtGuard, PerfilGuard)
export class MovimentacoesController {
  constructor(private service: MovimentacoesService) {}

  @Get()
  findAll(
    @Query('tipo') tipo?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('setorId') setorId?: string,
  ) {
    return this.service.findAll({ tipo, dataInicio, dataFim, setorId });
  }

  @Post('entrada') @Perfis('ADMIN', 'ALMOXARIFE')
  entrada(@Req() req: any, @Body() dto: any) {
    return this.service.registrarEntrada(req.user.id, dto);
  }

  @Post('saida') @Perfis('ADMIN', 'ALMOXARIFE')
  saida(@Req() req: any, @Body() dto: any) {
    return this.service.registrarSaida(req.user.id, dto);
  }

  @Post('descarte') @Perfis('ADMIN', 'ALMOXARIFE')
  descarte(@Req() req: any, @Body() dto: any) {
    return this.service.registrarDescarte(req.user.id, dto);
  }

  @Post(':id/estorno') @Perfis('ADMIN')
  estorno(@Req() req: any, @Param('id') id: string) {
    return this.service.estornar(req.user.id, id);
  }
}
