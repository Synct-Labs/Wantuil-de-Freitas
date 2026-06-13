import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { SetoresService } from './setores.service';

@Controller('setores')
@UseGuards(JwtGuard, PerfilGuard)
export class SetoresController {
  constructor(private service: SetoresService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') detalhe(@Param('id') id: string) { return this.service.detalhe(id); }
  @Post() @Perfis('ADMIN') create(@Body() dto: any) { return this.service.create(dto); }
  @Patch(':id') @Perfis('ADMIN') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Delete(':id') @Perfis('ADMIN') excluir(@Param('id') id: string) { return this.service.excluir(id); }
}
