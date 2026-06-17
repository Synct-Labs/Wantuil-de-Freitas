import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SistemaService {
  private logger = new Logger('SistemaService');

  constructor(private prisma: PrismaService) {}

  /**
   * Reset operacional: zera todo o estado de inventario, mas mantem o
   * cadastro (itens, categorias, setores, doadores, beneficiarios, usuarios).
   *
   * Apaga:
   * - Movimentacoes e MovimentacaoItem
   * - Lotes
   * - Logs de auditoria
   * - Notificacoes
   *
   * Zera:
   * - saldoAtual de todos os itens
   *
   * Usado apenas uma vez, na primeira ativacao do modelo de lotes.
   */
  async resetParaUsarLotes() {
    const contagens = {
      movimentacaoItens: 0,
      movimentacoes: 0,
      lotes: 0,
      logs: 0,
      notificacoes: 0,
      itensZerados: 0,
    };

    await this.prisma.$transaction(async (tx) => {
      // 1. Apaga em ordem reversa de dependencia
      contagens.movimentacaoItens = (await tx.movimentacaoItem.deleteMany({})).count;
      contagens.movimentacoes = (await tx.movimentacao.deleteMany({})).count;
      contagens.lotes = (await tx.lote.deleteMany({})).count;
      contagens.logs = (await tx.logAuditoria.deleteMany({})).count;
      contagens.notificacoes = (await tx.notificacao.deleteMany({})).count;

      // 2. Zera saldos dos itens
      const r = await tx.item.updateMany({
        data: { saldoAtual: 0, dataValidade: null, localizacao: null },
      });
      contagens.itensZerados = r.count;
    });

    this.logger.warn(`RESET executado: ${JSON.stringify(contagens)}`);

    return {
      sucesso: true,
      mensagem: 'Sistema resetado. Agora todas as entradas criam lotes.',
      contagens,
    };
  }

  /**
   * Estatisticas gerais do sistema (util pra dashboard admin)
   */
  async estatisticas() {
    const [
      itens, lotes, lotesAtivos, movimentacoes, doadores, beneficiarios, usuarios,
    ] = await Promise.all([
      this.prisma.item.count({ where: { ativo: true } }),
      this.prisma.lote.count(),
      this.prisma.lote.count({ where: { ativo: true } }),
      this.prisma.movimentacao.count(),
      this.prisma.doador.count({ where: { ativo: true } }),
      this.prisma.beneficiario.count({ where: { ativo: true } }),
      this.prisma.usuario.count({ where: { ativo: true } }),
    ]);

    return { itens, lotes, lotesAtivos, movimentacoes, doadores, beneficiarios, usuarios };
  }
}
