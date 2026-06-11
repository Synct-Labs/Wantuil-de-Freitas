import { Module } from '@nestjs/common';
import { EtiquetasService } from './etiquetas.service';
import { EtiquetasController } from './etiquetas.controller';

@Module({ providers: [EtiquetasService], controllers: [EtiquetasController] })
export class EtiquetasModule {}
