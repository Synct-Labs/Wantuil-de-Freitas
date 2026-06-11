import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { CategoriasService } from './categorias.service';

@Controller('categorias')
@UseGuards(JwtGuard)
export class CategoriasController {
  constructor(private service: CategoriasService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
}
