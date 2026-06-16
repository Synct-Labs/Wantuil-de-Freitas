import { Module } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import { NotificacoesController } from './notificacoes.controller';

@Module({
  providers: [NotificacoesService],
  controllers: [NotificacoesController],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
