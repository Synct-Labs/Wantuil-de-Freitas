import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { NotificacoesService } from './notificacoes.service';

@Controller('notificacoes')
@UseGuards(JwtGuard, PerfilGuard)
export class NotificacoesController {
  constructor(private service: NotificacoesService) {}

  @Get()
  findAll(@Query('apenasNaoLidas') apenasNaoLidas?: string, @Query('limite') limite?: string) {
    return this.service.findAll({
      apenasNaoLidas: apenasNaoLidas === 'true' || apenasNaoLidas === '1',
      limite: limite ? parseInt(limite, 10) : undefined,
    });
  }

  @Get('contagem-nao-lidas')
  contagem() { return this.service.contarNaoLidas(); }

  @Patch(':id/lida')
  marcarLida(@Param('id') id: string) { return this.service.marcarLida(id); }

  @Post('marcar-todas-lidas')
  marcarTodasLidas() { return this.service.marcarTodasLidas(); }

  @Delete(':id')
  excluir(@Param('id') id: string) { return this.service.excluir(id); }

  // Gera notificacoes baseadas no estado atual dos itens (idempotente).
  // Util para popular o sistema apos primeira instalacao ou quando algo desconfigura.
  @Post('verificar-agora')
  verificarAgora() { return this.service.verificarItens(); }

  // Dispara resumo semanal sob demanda (apenas MASTER)
  @Post('testar-resumo') @Perfis('MASTER')
  testarResumo() { return this.service.resumoSemanal(); }

  // Diagnostico de configuracao de email (apenas MASTER)
  @Get('diagnostico-email') @Perfis('MASTER')
  diagnostico() { return this.service.diagnosticoEmail(); }

  // Envia email de teste (apenas MASTER)
  @Post('testar-email') @Perfis('MASTER')
  testarEmail() { return this.service.testarEmail(); }
}
