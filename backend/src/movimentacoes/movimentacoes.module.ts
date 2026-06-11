import { Module } from '@nestjs/common';
import { MovimentacoesService } from './movimentacoes.service';
import { MovimentacoesController } from './movimentacoes.controller';

@Module({ providers: [MovimentacoesService], controllers: [MovimentacoesController] })
export class MovimentacoesModule {}
