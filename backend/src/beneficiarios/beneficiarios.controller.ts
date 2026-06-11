import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { BeneficiariosService } from './beneficiarios.service';

@Controller('beneficiarios')
@UseGuards(JwtGuard)
export class BeneficiariosController {
  constructor(private service: BeneficiariosService) {}
  @Get() findAll(@Query('busca') busca?: string) { return this.service.findAll(busca); }
  @Get(':id/historico') historico(@Param('id') id: string) { return this.service.historico(id); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
}
