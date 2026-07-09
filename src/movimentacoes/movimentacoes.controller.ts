import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  @Post('entrada') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  entrada(@Req() req: any, @Body() dto: any) {
    return this.service.registrarEntrada(req.user.id, dto);
  }

  @Post('saida') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE', 'OPERADOR')
  saida(@Req() req: any, @Body() dto: any) {
    return this.service.registrarSaida(req.user.id, dto);
  }

  @Post('descarte') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  descarte(@Req() req: any, @Body() dto: any) {
    return this.service.registrarDescarte(req.user.id, dto);
  }

  @Post(':id/estorno') @Perfis('MASTER', 'ADMIN')
  estorno(@Req() req: any, @Param('id') id: string) {
    return this.service.estornar(req.user.id, id);
  }

  @Patch(':id/entrada') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  editarEntrada(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.editarEntrada(req.user.id, id, dto);
  }
}
