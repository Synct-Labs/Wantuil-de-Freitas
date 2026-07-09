import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { CategoriasService } from './categorias.service';

@Controller('categorias')
@UseGuards(JwtGuard, PerfilGuard)
export class CategoriasController {
  constructor(private service: CategoriasService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Post() @Perfis('MASTER', 'ADMIN') create(@Body() dto: any) { return this.service.create(dto); }
  @Patch(':id') @Perfis('MASTER', 'ADMIN') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Delete(':id') @Perfis('MASTER', 'ADMIN') excluir(@Param('id') id: string) { return this.service.excluir(id); }
}
