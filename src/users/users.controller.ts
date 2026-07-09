import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { UsersService } from './users.service';

@Controller('usuarios')
@UseGuards(JwtGuard, PerfilGuard)
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @Perfis('MASTER', 'ADMIN')
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @Perfis('MASTER', 'ADMIN')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Perfis('MASTER', 'ADMIN')
  create(@Body() dto: any, @Req() req: any) {
    return this.service.create(dto, req.user.perfil);
  }

  @Patch(':id')
  @Perfis('MASTER', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.service.update(id, dto, req.user.perfil);
  }

  @Delete(':id')
  @Perfis('MASTER', 'ADMIN')
  excluir(@Param('id') id: string, @Req() req: any) {
    return this.service.excluir(id, req.user.id, req.user.perfil);
  }

  @Patch(':id/desativar')
  @Perfis('MASTER', 'ADMIN')
  desativar(@Param('id') id: string, @Req() req: any) {
    return this.service.desativar(id, req.user.id, req.user.perfil);
  }
}
