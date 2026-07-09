import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { BeneficiariosService } from './beneficiarios.service';

@Controller('beneficiarios')
@UseGuards(JwtGuard, PerfilGuard)
export class BeneficiariosController {
  constructor(private service: BeneficiariosService) {}

  @Get() findAll(@Query('busca') busca?: string) { return this.service.findAll(busca); }
  @Get(':id/historico') historico(@Param('id') id: string) { return this.service.historico(id); }

  @Post() @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  create(@Body() dto: any) { return this.service.create(dto); }

  @Patch(':id') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Delete(':id') @Perfis('MASTER', 'ADMIN')
  excluir(@Param('id') id: string) { return this.service.excluir(id); }
}
