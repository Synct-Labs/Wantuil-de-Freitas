import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { ItensService } from './itens.service';

@Controller('itens')
@UseGuards(JwtGuard, PerfilGuard)
export class ItensController {
  constructor(private service: ItensService) {}

  @Get()
  findAll(@Query('busca') busca?: string, @Query('categoriaId') categoriaId?: string, @Query('setorId') setorId?: string) {
    return this.service.findAll({ busca, categoriaId, setorId });
  }

  @Get('alertas')
  alertas() { return this.service.alertas(); }

  @Get('ean/:ean')
  findByEan(@Param('ean') ean: string) { return this.service.findByEan(ean); }

  @Post() @Perfis('ADMIN', 'ALMOXARIFE')
  create(@Body() dto: any) { return this.service.create(dto); }

  @Patch(':id') @Perfis('ADMIN', 'ALMOXARIFE')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Delete(':id') @Perfis('ADMIN')
  desativar(@Param('id') id: string) { return this.service.desativar(id); }
}
