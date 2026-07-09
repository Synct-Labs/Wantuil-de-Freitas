import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProdutosExternosService } from './produtos-externos.service';
import { ProdutosExternosController } from './produtos-externos.controller';

@Module({
  imports: [PrismaModule],
  providers: [ProdutosExternosService],
  controllers: [ProdutosExternosController],
  exports: [ProdutosExternosService],
})
export class ProdutosExternosModule {}
