import { Module } from '@nestjs/common';
import { MovimentacoesService } from './movimentacoes.service';
import { MovimentacoesController } from './movimentacoes.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { LotesModule } from '../lotes/lotes.module';

@Module({
  imports: [NotificacoesModule, LotesModule],
  providers: [MovimentacoesService],
  controllers: [MovimentacoesController],
})
export class MovimentacoesModule {}
