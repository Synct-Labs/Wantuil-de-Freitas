import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { SistemaService } from './sistema.service';

@Controller('sistema')
@UseGuards(JwtGuard, PerfilGuard)
@Perfis('ADMIN')
export class SistemaController {
  constructor(private service: SistemaService) {}

  @Get('estatisticas')
  estatisticas() { return this.service.estatisticas(); }

  @Post('reset-para-lotes')
  resetParaLotes() { return this.service.resetParaUsarLotes(); }
}
