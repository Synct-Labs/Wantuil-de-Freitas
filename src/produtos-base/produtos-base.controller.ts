import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { ProdutosBaseService } from './produtos-base.service';

@Controller('produtos-base')
@UseGuards(JwtGuard, PerfilGuard)
export class ProdutosBaseController {
  constructor(private service: ProdutosBaseService) {}

  @Get() @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR')
  findAll(@Query('busca') busca?: string) { return this.service.findAll(busca); }

  @Get(':id') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post() @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  create(@Body() dto: any) { return this.service.create(dto); }

  @Patch(':id') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Delete(':id') @Perfis('MASTER', 'ADMIN')
  excluir(@Param('id') id: string) { return this.service.excluir(id); }
}
