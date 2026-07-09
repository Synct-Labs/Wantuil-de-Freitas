import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ItensModule } from './itens/itens.module';
import { ProdutosBaseModule } from './produtos-base/produtos-base.module';
import { CategoriasModule } from './categorias/categorias.module';
import { SetoresModule } from './setores/setores.module';
import { DoadoresModule } from './doadores/doadores.module';
import { BeneficiariosModule } from './beneficiarios/beneficiarios.module';
import { MovimentacoesModule } from './movimentacoes/movimentacoes.module';
import { EtiquetasModule } from './etiquetas/etiquetas.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { ProdutosExternosModule } from './produtos-externos/produtos-externos.module';
import { LotesModule } from './lotes/lotes.module';
import { HealthModule } from './health/health.module';
import { SistemaModule } from './sistema/sistema.module';
import { EventosModule } from './eventos/eventos.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Logger estruturado: JSON em producao (facil de filtrar/grep),
    // formato legivel em desenvolvimento. Cada request gera um log
    // com metodo, path, status e tempo. Erros saem com stack trace
    // completo. Compatvel com agregadores tipo Datadog/Loki sem
    // configuracao extra.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport: process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        // Evita logar dados sensiveis nos request logs
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.senha', '*.password', '*.token'],
        // Resposta mais limpa: nao loga query/body por default em producao
        serializers: process.env.NODE_ENV === 'production'
          ? {
              req: (req) => ({ method: req.method, url: req.url, id: req.id }),
              res: (res) => ({ statusCode: res.statusCode }),
            }
          : undefined,
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ItensModule,
    ProdutosBaseModule,
    CategoriasModule,
    SetoresModule,
    DoadoresModule,
    BeneficiariosModule,
    MovimentacoesModule,
    EtiquetasModule,
    RelatoriosModule,
    NotificacoesModule,
    ProdutosExternosModule,
    LotesModule,
    HealthModule,
    SistemaModule,
    EventosModule,
  ],
})
export class AppModule {}
