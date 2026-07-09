import { Module } from '@nestjs/common';
import { ProdutosBaseController } from './produtos-base.controller';
import { ProdutosBaseService } from './produtos-base.service';

@Module({
  controllers: [ProdutosBaseController],
  providers: [ProdutosBaseService],
})
export class ProdutosBaseModule {}
