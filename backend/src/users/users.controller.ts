import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { UsersService } from './users.service';

@Controller('usuarios')
@UseGuards(JwtGuard, PerfilGuard)
export class UsersController {
  constructor(private service: UsersService) {}

  @Get() @Perfis('ADMIN') findAll() { return this.service.findAll(); }
  @Post() @Perfis('ADMIN') create(@Body() dto: any) { return this.service.create(dto); }
  @Patch(':id') @Perfis('ADMIN') update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }
}
