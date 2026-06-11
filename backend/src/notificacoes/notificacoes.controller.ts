import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { NotificacoesService } from './notificacoes.service';

@Controller('notificacoes')
@UseGuards(JwtGuard)
export class NotificacoesController {
  constructor(private service: NotificacoesService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Patch(':id/lida') marcarLida(@Param('id') id: string) { return this.service.marcarLida(id); }

  // Endpoint para testar o resumo manualmente
  @Post('testar-resumo')
  testarResumo() { return this.service.resumoSemanal(); }
}
