import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { DoadoresService } from './doadores.service';

@Controller('doadores')
@UseGuards(JwtGuard, PerfilGuard)
export class DoadoresController {
  constructor(private service: DoadoresService) {}

  @Get() @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR')
  findAll(@Query('busca') busca?: string) { return this.service.findAll(busca); }
  @Get(':id/historico') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR')
  historico(@Param('id') id: string) { return this.service.historico(id); }

  @Post() @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  create(@Body() dto: any) { return this.service.create(dto); }

  @Patch(':id') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Delete(':id') @Perfis('MASTER', 'ADMIN')
  excluir(@Param('id') id: string) { return this.service.excluir(id); }
}
