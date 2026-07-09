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
   * Limpa categorias e setores que sobraram do seed e que ainda nao foram usados.
   *
   * Seguranca: NUNCA apaga uma categoria que tenha itens vinculados, nem
   * um setor com movimentacoes ou lotes. Se voce ja cadastrou item em
   * "Alimentos", essa categoria sera preservada.
   */
  async limparDadosExemplo() {
    const CATEGORIAS_EXEMPLO = ['Alimentos', 'Higiene', 'Limpeza', 'Vestuario', 'Medicamentos', 'Outros'];
    const SETORES_EXEMPLO = ['Estoque Geral', 'Cozinha', 'Enfermaria', 'Abrigo'];

    const apagadas: { categorias: string[]; setores: string[] } = { categorias: [], setores: [] };
    const mantidos: { categorias: string[]; setores: string[] } = { categorias: [], setores: [] };

    for (const nome of CATEGORIAS_EXEMPLO) {
      const cat = await this.prisma.categoria.findUnique({
        where: { nome },
        include: { _count: { select: { itens: true } } },
      });
      if (!cat) continue;
      if (cat._count.itens === 0) {
        await this.prisma.categoria.delete({ where: { id: cat.id } });
        apagadas.categorias.push(nome);
      } else {
        mantidos.categorias.push(`${nome} (${cat._count.itens} item${cat._count.itens > 1 ? 's' : ''})`);
      }
    }

    for (const nome of SETORES_EXEMPLO) {
      const setor = await this.prisma.setor.findUnique({
        where: { nome },
        include: { _count: { select: { movimentacoes: true, lotes: true } } },
      });
      if (!setor) continue;
      const emUso = setor._count.movimentacoes + setor._count.lotes;
      if (emUso === 0) {
        await this.prisma.setor.delete({ where: { id: setor.id } });
        apagadas.setores.push(nome);
      } else {
        mantidos.setores.push(`${nome} (em uso)`);
      }
    }

    this.logger.log(`Limpeza: ${apagadas.categorias.length} categorias e ${apagadas.setores.length} setores apagados`);
    return {
      mensagem: `Limpeza concluída: ${apagadas.categorias.length} categoria(s) e ${apagadas.setores.length} setor(es) removidos.`,
      apagadas, mantidos,
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
