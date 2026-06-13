import { Module } from '@nestjs/common';
import { ProdutosExternosService } from './produtos-externos.service';
import { ProdutosExternosController } from './produtos-externos.controller';

@Module({
  providers: [ProdutosExternosService],
  controllers: [ProdutosExternosController],
})
export class ProdutosExternosModule {}
