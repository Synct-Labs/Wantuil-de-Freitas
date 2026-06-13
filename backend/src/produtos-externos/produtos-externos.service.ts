import { Injectable, Logger } from '@nestjs/common';

export interface ProdutoEncontrado {
  ean: string;
  nome: string;
  marca?: string;
  categoria?: string;
  categoriaSugerida?: string;
  imagemUrl?: string;
  fonte: 'open-food-facts' | 'open-beauty-facts' | 'open-products-facts';
}

/**
 * Consulta cascata em APIs publicas gratuitas do projeto Open Facts.
 * Todas tem o mesmo formato de resposta.
 *
 *  - Open Food Facts     → alimentos
 *  - Open Beauty Facts   → higiene pessoal, cabelo, cosmeticos
 *  - Open Products Facts → limpeza, utensilios, geral
 *
 * Estrategia: consulta as 3 em paralelo, retorna o primeiro que encontrar
 * (com prioridade: food > beauty > products).
 */
@Injectable()
export class ProdutosExternosService {
  private logger = new Logger('ProdutosExternos');

  private readonly APIS = [
    { url: 'https://world.openfoodfacts.org', fonte: 'open-food-facts' as const, categoriaSugerida: 'Alimentos' },
    { url: 'https://world.openbeautyfacts.org', fonte: 'open-beauty-facts' as const, categoriaSugerida: 'Higiene' },
    { url: 'https://world.openproductsfacts.org', fonte: 'open-products-facts' as const, categoriaSugerida: 'Limpeza' },
  ];

  async buscarPorEan(ean: string): Promise<ProdutoEncontrado | null> {
    const eanLimpo = (ean || '').replace(/\D/g, '');
    if (!eanLimpo) return null;

    // Consulta em paralelo (Promise.all com timeout individual)
    const resultados = await Promise.all(
      this.APIS.map(api => this.consultarApi(api, eanLimpo))
    );

    // Retorna o primeiro nao-nulo
    return resultados.find(r => r !== null) || null;
  }

  private async consultarApi(
    api: { url: string; fonte: any; categoriaSugerida: string },
    ean: string,
  ): Promise<ProdutoEncontrado | null> {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 4000);

      const resp = await fetch(
        `${api.url}/api/v2/product/${ean}?fields=product_name,product_name_pt,brands,categories,categories_tags,image_url,generic_name`,
        { signal: ctrl.signal, headers: { 'User-Agent': 'AlmoxarifadoWantuil/1.0' } }
      );
      clearTimeout(timeout);

      if (!resp.ok) return null;
      const data: any = await resp.json();

      if (data.status !== 1 || !data.product) return null;
      const p = data.product;

      // Prefere nome em portugues, depois nome generico, depois product_name padrao
      const nome = p.product_name_pt || p.product_name || p.generic_name;
      if (!nome) return null;

      return {
        ean,
        nome: this.capitalizar(nome),
        marca: p.brands || undefined,
        categoria: this.normalizarCategoria(p.categories),
        categoriaSugerida: api.categoriaSugerida,
        imagemUrl: p.image_url || undefined,
        fonte: api.fonte,
      };
    } catch (e) {
      this.logger.warn(`Falha em ${api.fonte}: ${e.message}`);
      return null;
    }
  }

  private capitalizar(s: string): string {
    return s.split(' ')
      .map(w => w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
      .join(' ')
      .trim();
  }

  private normalizarCategoria(cat: string): string | undefined {
    if (!cat) return undefined;
    return cat.split(',')[0].trim();
  }
}
