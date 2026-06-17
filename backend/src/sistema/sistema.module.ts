import { Module } from '@nestjs/common';
import { SistemaService } from './sistema.service';
import { SistemaController } from './sistema.controller';

@Module({
  providers: [SistemaService],
  controllers: [SistemaController],
})
export class SistemaModule {}
