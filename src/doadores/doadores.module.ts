import { Module } from '@nestjs/common';
import { DoadoresService } from './doadores.service';
import { DoadoresController } from './doadores.controller';

@Module({ providers: [DoadoresService], controllers: [DoadoresController] })
export class DoadoresModule {}
