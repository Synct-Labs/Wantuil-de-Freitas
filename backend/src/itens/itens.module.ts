import { Module } from '@nestjs/common';
import { ItensService } from './itens.service';
import { ItensController } from './itens.controller';

@Module({ providers: [ItensService], controllers: [ItensController], exports: [ItensService] })
export class ItensModule {}
