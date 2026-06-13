import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ItensModule } from './itens/itens.module';
import { CategoriasModule } from './categorias/categorias.module';
import { SetoresModule } from './setores/setores.module';
import { DoadoresModule } from './doadores/doadores.module';
import { BeneficiariosModule } from './beneficiarios/beneficiarios.module';
import { MovimentacoesModule } from './movimentacoes/movimentacoes.module';
import { EtiquetasModule } from './etiquetas/etiquetas.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { ProdutosExternosModule } from './produtos-externos/produtos-externos.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ItensModule,
    CategoriasModule,
    SetoresModule,
    DoadoresModule,
    BeneficiariosModule,
    MovimentacoesModule,
    EtiquetasModule,
    RelatoriosModule,
    NotificacoesModule,
    ProdutosExternosModule,
  ],
})
export class AppModule {}
