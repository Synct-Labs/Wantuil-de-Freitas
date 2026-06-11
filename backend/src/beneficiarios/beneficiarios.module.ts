import { Module } from '@nestjs/common';
import { BeneficiariosService } from './beneficiarios.service';
import { BeneficiariosController } from './beneficiarios.controller';

@Module({ providers: [BeneficiariosService], controllers: [BeneficiariosController] })
export class BeneficiariosModule {}
