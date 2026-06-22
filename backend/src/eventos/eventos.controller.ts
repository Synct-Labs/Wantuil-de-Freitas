import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtGuard } from '../auth/jwt.guard';
import { PerfilGuard } from '../common/perfil.guard';
import { Perfis } from '../common/perfil.decorator';
import { EventosService } from './eventos.service';

@Controller('eventos')
@UseGuards(JwtGuard, PerfilGuard)
export class EventosController {
  constructor(private service: EventosService) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('ativo') ativo?: string) {
    return this.service.findAll({
      status,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
  }

  @Get(':id')
  findById(@Param('id') id: string) { return this.service.findById(id); }

  @Post() @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  criar(@Body() dto: any) { return this.service.criar(dto); }

  @Patch(':id') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  atualizar(@Param('id') id: string, @Body() dto: any) { return this.service.atualizar(id, dto); }

  @Delete(':id') @Perfis('MASTER', 'ADMIN')
  excluir(@Param('id') id: string) { return this.service.excluir(id); }

  @Post(':id/iniciar') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  iniciar(@Param('id') id: string) { return this.service.iniciar(id); }

  @Post(':id/finalizar') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  finalizar(@Param('id') id: string) { return this.service.finalizar(id); }

  @Post(':id/cancelar') @Perfis('MASTER', 'ADMIN')
  cancelar(@Param('id') id: string) { return this.service.cancelar(id); }

  // Reservas
  @Post(':id/reservas') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  adicionarReserva(@Param('id') id: string, @Body() dto: any) {
    return this.service.adicionarReserva(id, dto);
  }

  @Delete(':id/reservas/:reservaId') @Perfis('MASTER', 'ADMIN', 'ALMOXARIFE')
  removerReserva(@Param('id') id: string, @Param('reservaId') reservaId: string) {
    return this.service.removerReserva(id, reservaId);
  }

  // Relatorio PDF
  @Get(':id/relatorio/pdf')
  async relatorio(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.service.gerarRelatorioPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=evento_${id}.pdf`,
    });
    res.send(pdf);
  }
}
