import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type FonteProduto =
  | 'catalogo-local'
  | 'dotcompany'
  | 'produto-xyz'
  | 'cosmos-bluesoft'
  | 'open-food-facts'
  | 'open-beauty-facts'
  | 'open-products-facts'
  | 'upcitemdb';

export interface ProdutoEncontrado {
  ean: string;
  nome: string;
  marca?: string;
  categoria?: string;
  categoriaSugerida?: string;
  imagemUrl?: string;
  fonte: FonteProduto;
}

/**
 * Cascata de busca de produtos por EAN em DUAS ondas paralelas:
 *
 *   0. Catalogo local (instantaneo, sem rede)
 *      ↓
 *   ONDA 1 (paralelo) — APIs BRASILEIRAS
 *     - DotCompany       (1M+ produtos, 50/dia)
 *     - Produto XYZ      (colaborativa, sem auth)
 *     - Cosmos Bluesoft  (referencia BR, opt-in via COSMOS_TOKEN)
 *      ↓ (se nenhuma achar)
 *   ONDA 2 (paralelo) — APIs GLOBAIS
 *     - Open Food Facts      (alimentos)
 *     - Open Beauty Facts    (higiene)
 *     - Open Products Facts  (limpeza/geral)
 *     - UPCitemdb            (100/dia, cobertura UPC mundial)
 *
 * Toda resposta positiva e gravada no catalogo local. Da proxima vez,
 * o mesmo EAN responde instantaneamente.
 */
@Injectable()
export class ProdutosExternosService {
  private logger = new Logger('ProdutosExternos');
  private readonly COSMOS_TOKEN = process.env.COSMOS_TOKEN;
  private readonly USER_AGENT = 'AlmoxarifadoWantuil/1.0 (instituicao-caridade)';

  constructor(private prisma: PrismaService) {}

  async buscarPorEan(ean: string): Promise<ProdutoEncontrado | null> {
    const eanLimpo = (ean || '').replace(/\D/g, '');
    if (!eanLimpo) return null;

    // ─── 0. CACHE LOCAL ───
    const local = await this.prisma.catalogoProduto.findUnique({ where: { ean: eanLimpo } });
    if (local) {
      await this.prisma.catalogoProduto.update({
        where: { id: local.id },
        data: { vezesUsado: { increment: 1 } },
      });
      return {
        ean: local.ean,
        nome: local.nome,
        marca: local.marca || undefined,
        categoria: local.categoria || undefined,
        categoriaSugerida: local.categoriaSugerida || undefined,
        imagemUrl: local.imagemUrl || undefined,
        fonte: 'catalogo-local',
      };
    }

    // ─── ONDA 1: APIs brasileiras em paralelo ───
    const brasileiras = await this.primeiroQueRetornar([
      this.consultarDotCompany(eanLimpo),
      this.consultarProdutoXyz(eanLimpo),
      this.COSMOS_TOKEN ? this.consultarCosmos(eanLimpo) : Promise.resolve(null),
    ]);
    if (brasileiras) {
      await this.salvarNoCatalogo(brasileiras);
      return brasileiras;
    }

    // ─── ONDA 2: APIs globais em paralelo ───
    const globais = await this.primeiroQueRetornar([
      this.consultarOpenFacts(eanLimpo, 'food'),
      this.consultarOpenFacts(eanLimpo, 'beauty'),
      this.consultarOpenFacts(eanLimpo, 'products'),
      this.consultarUpcItemDb(eanLimpo),
    ]);
    if (globais) {
      await this.salvarNoCatalogo(globais);
      return globais;
    }

    return null;
  }

  async buscarPorNome(termo: string, limite = 10): Promise<ProdutoEncontrado[]> {
    if (!termo || termo.trim().length < 2) return [];
    const resultados = await this.prisma.catalogoProduto.findMany({
      where: { nome: { contains: termo.trim(), mode: 'insensitive' } },
      orderBy: [{ vezesUsado: 'desc' }, { nome: 'asc' }],
      take: limite,
    });
    return resultados.map((r) => ({
      ean: r.ean,
      nome: r.nome,
      marca: r.marca || undefined,
      categoria: r.categoria || undefined,
      categoriaSugerida: r.categoriaSugerida || undefined,
      imagemUrl: r.imagemUrl || undefined,
      fonte: 'catalogo-local' as const,
    }));
  }

  async salvarManualmente(dados: {
    ean: string; nome: string; marca?: string; categoria?: string; categoriaSugerida?: string;
  }) {
    const eanLimpo = (dados.ean || '').replace(/\D/g, '');
    if (!eanLimpo) return null;
    return this.prisma.catalogoProduto.upsert({
      where: { ean: eanLimpo },
      create: {
        ean: eanLimpo, nome: dados.nome,
        marca: dados.marca, categoria: dados.categoria,
        categoriaSugerida: dados.categoriaSugerida,
        fonte: 'manual',
      },
      update: { vezesUsado: { increment: 1 } },
    });
  }

  // ═══════════ HELPER: Primeira promise que retornar nao-nulo ═══════════
  /**
   * Resolve com o primeiro resultado nao-nulo, ou null se todas falharem.
   * Aguarda todas terminarem (rejeitadas ou resolvidas) para evitar
   * cancelar requisicoes em andamento.
   */
  private async primeiroQueRetornar(
    promises: Promise<ProdutoEncontrado | null>[],
  ): Promise<ProdutoEncontrado | null> {
    const resultados = await Promise.allSettled(promises);
    for (const r of resultados) {
      if (r.status === 'fulfilled' && r.value !== null) return r.value;
    }
    return null;
  }

  // ═══════════ FONTE 1: DotCompany ═══════════
  private async consultarDotCompany(ean: string): Promise<ProdutoEncontrado | null> {
    try {
      const resp = await this.fetchComTimeout(
        `https://erp.dotcompany.com.br/api/catalogo/public/buscar?q=${ean}`,
        5000,
      );
      if (!resp || !resp.ok) return null;
      const data: any = await resp.json();
      if (!data?.sucesso || !data?.produto) return null;
      const p = data.produto;
      return this.validar({
        ean,
        nome: this.capitalizar(p.nome || ''),
        marca: p.marca || undefined,
        categoria: p.categoria || undefined,
        categoriaSugerida: this.inferirCategoria(p.nome, p.categoria),
        imagemUrl: p.imagem_url || undefined,
        fonte: 'dotcompany',
      });
    } catch (e: any) {
      this.logger.debug(`DotCompany falhou: ${e.message}`);
      return null;
    }
  }

  // ═══════════ FONTE 2: Produto XYZ (colaborativa brasileira) ═══════════
  private async consultarProdutoXyz(ean: string): Promise<ProdutoEncontrado | null> {
    try {
      const resp = await this.fetchComTimeout(
        `https://api.produto.xyz/v1/gtin/${ean}`,
        4000,
      );
      if (!resp || !resp.ok) return null;
      const data: any = await resp.json();
      // O retorno pode ser { Product: { ... } } ou { product: { ... } }
      const p = data?.Product || data?.product;
      if (!p?.name) return null;
      return this.validar({
        ean,
        nome: this.capitalizar(p.name),
        marca: p.manufacturer || undefined,
        categoria: p.category || undefined,
        categoriaSugerida: this.inferirCategoria(p.name, p.category),
        fonte: 'produto-xyz',
      });
    } catch (e: any) {
      this.logger.debug(`Produto XYZ falhou: ${e.message}`);
      return null;
    }
  }

  // ═══════════ FONTE 3: Cosmos Bluesoft (opt-in via COSMOS_TOKEN) ═══════════
  private async consultarCosmos(ean: string): Promise<ProdutoEncontrado | null> {
    if (!this.COSMOS_TOKEN) return null;
    try {
      const resp = await this.fetchComTimeout(
        `https://api.cosmos.bluesoft.com.br/gtins/${ean}.json`,
        5000,
        {
          // Cabecalhos obrigatorios da Cosmos Bluesoft.
          // O User-Agent deve ser EXATAMENTE 'Cosmos-API-Request' (definido pela Bluesoft).
          'X-Cosmos-Token': this.COSMOS_TOKEN,
          'User-Agent': 'Cosmos-API-Request',
          'Content-Type': 'application/json',
        },
      );
      if (!resp || !resp.ok) return null;
      const data: any = await resp.json();
      if (!data?.description) return null;
      return this.validar({
        ean,
        nome: this.capitalizar(data.description),
        marca: data.brand?.name || undefined,
        categoria: data.gpc?.description || data.ncm?.description || undefined,
        categoriaSugerida: this.inferirCategoria(data.description, data.gpc?.description),
        imagemUrl: data.thumbnail || undefined,
        fonte: 'cosmos-bluesoft',
      });
    } catch (e: any) {
      this.logger.debug(`Cosmos falhou: ${e.message}`);
      return null;
    }
  }

  // ═══════════ FONTE 4-6: Open Food/Beauty/Products Facts ═══════════
  private async consultarOpenFacts(
    ean: string,
    tipo: 'food' | 'beauty' | 'products',
  ): Promise<ProdutoEncontrado | null> {
    const config = {
      food:     { url: 'https://world.openfoodfacts.org',     fonte: 'open-food-facts' as const,     catSug: 'Alimentos' },
      beauty:   { url: 'https://world.openbeautyfacts.org',   fonte: 'open-beauty-facts' as const,   catSug: 'Higiene'   },
      products: { url: 'https://world.openproductsfacts.org', fonte: 'open-products-facts' as const, catSug: 'Limpeza'   },
    }[tipo];
    try {
      const resp = await this.fetchComTimeout(
        `${config.url}/api/v2/product/${ean}?fields=product_name,product_name_pt,brands,categories,image_url,generic_name`,
        4000,
      );
      if (!resp || !resp.ok) return null;
      const data: any = await resp.json();
      if (data.status !== 1 || !data.product) return null;
      const p = data.product;
      const nome = p.product_name_pt || p.product_name || p.generic_name;
      if (!nome) return null;
      return this.validar({
        ean,
        nome: this.capitalizar(nome),
        marca: p.brands || undefined,
        categoria: p.categories ? p.categories.split(',')[0].trim() : undefined,
        categoriaSugerida: config.catSug,
        imagemUrl: p.image_url || undefined,
        fonte: config.fonte,
      });
    } catch {
      return null;
    }
  }

  // ═══════════ FONTE 7: UPCitemdb (100/dia, cobertura UPC mundial) ═══════════
  private async consultarUpcItemDb(ean: string): Promise<ProdutoEncontrado | null> {
    try {
      const resp = await this.fetchComTimeout(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${ean}`,
        4000,
      );
      if (!resp || !resp.ok) return null;
      const data: any = await resp.json();
      const item = data?.items?.[0];
      if (!item?.title) return null;
      return this.validar({
        ean,
        nome: this.capitalizar(item.title),
        marca: item.brand || undefined,
        categoria: item.category || undefined,
        categoriaSugerida: this.inferirCategoria(item.title, item.category),
        imagemUrl: item.images?.[0] || undefined,
        fonte: 'upcitemdb',
      });
    } catch (e: any) {
      this.logger.debug(`UPCitemdb falhou: ${e.message}`);
      return null;
    }
  }

  // ═══════════ Helpers ═══════════
  private async fetchComTimeout(
    url: string,
    ms: number,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response | null> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': this.USER_AGENT, ...extraHeaders },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async salvarNoCatalogo(p: ProdutoEncontrado) {
    try {
      await this.prisma.catalogoProduto.upsert({
        where: { ean: p.ean },
        create: {
          ean: p.ean, nome: p.nome, marca: p.marca,
          categoria: p.categoria, categoriaSugerida: p.categoriaSugerida,
          imagemUrl: p.imagemUrl, fonte: p.fonte,
        },
        update: { vezesUsado: { increment: 1 } },
      });
    } catch (e: any) {
      this.logger.warn(`Falha ao cachear ${p.ean}: ${e.message}`);
    }
  }

  /**
   * Valida um ProdutoEncontrado antes de aceitar como "encontrado".
   * Garante que tem nome real, nao e um placeholder/lixo, e bloqueia
   * respostas vazias ou genericas que algumas APIs retornam.
   */
  private validar(p: ProdutoEncontrado | null): ProdutoEncontrado | null {
    if (!p) return null;
    const nome = (p.nome || '').trim();
    if (nome.length < 3) return null;

    // Bloqueia respostas genericas/lixo
    const nomeLower = nome.toLowerCase();
    const placeholders = [
      'produto', 'produto desconhecido', 'desconhecido', 'sem nome', 'sem descricao',
      'n/d', 'n/a', 'nao informado', 'nao identificado', 'unknown', 'no name', 'untitled',
      'null', 'undefined', '---', '...', 'teste', 'test',
    ];
    if (placeholders.includes(nomeLower)) return null;

    // Bloqueia nome formado so por digitos ou caracteres especiais
    if (/^[\d\s\-_./]+$/.test(nome)) return null;

    // Sem letras = invalido
    if (!/[a-zA-ZÀ-ÿ]/.test(nome)) return null;

    return p;
  }

  private capitalizar(s: string): string {
    return s
      .split(' ')
      .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
      .join(' ')
      .trim();
  }

  private inferirCategoria(nome?: string, categoriaApi?: string): string | undefined {
    const texto = `${nome || ''} ${categoriaApi || ''}`.toLowerCase();
    if (/(detergente|sabao|amaciante|desinfetante|agua sanitaria|qboa|cloro|alcool|esponja|vassoura|panos?|lava|limpeza)/i.test(texto)) return 'Limpeza';
    if (/(shampoo|condicionador|sabonete|creme dental|pasta|escova de dente|absorvente|fralda|papel higienico|desodorante|hidratante|cabelo|cosmetic)/i.test(texto)) return 'Higiene';
    if (/(arroz|feijao|macarrao|leite|oleo|cafe|acucar|sal|farinha|biscoito|atum|sardinha|molho|extrato|achocolatado|alimento|food|grain)/i.test(texto)) return 'Alimentos';
    return undefined;
  }
}
