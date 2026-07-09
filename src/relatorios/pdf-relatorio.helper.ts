import PDFDocument = require('pdfkit');
import { fmtData, fmtDataHora } from '../common/data-fuso';

interface Coluna {
  titulo: string;
  campo: string;
  largura: number;       // em pt (proporcao da pagina)
  alinhamento?: 'left' | 'right' | 'center';
  formatar?: (val: any, row: any) => string;
}

interface RelatorioPdfOpts {
  titulo: string;
  subtitulo?: string;
  periodo?: { inicio?: string; fim?: string };
  filtros?: { label: string; valor: string }[];
  colunas: Coluna[];
  linhas: any[];
  totais?: { label: string; valor: string }[];
  resumo?: { label: string; valor: string | number }[];   // KPIs no topo
  orientacao?: 'portrait' | 'landscape';
}

// Paleta Wantuil
const COR_PRIMARIA = '#2A4A8A';
const COR_PETROLEO = '#4A9BA4';
const COR_AMARELO = '#F5C842';
const COR_TEXTO = '#1A2A2C';
const COR_TEXTO_SUAVE = '#5A6B6E';
const COR_BORDA = '#D9E3E5';
const COR_ZEBRA = '#F4F7F8';

/**
 * Gera um PDF de relatorio com layout profissional padronizado:
 * - Cabecalho institucional (titulo + periodo + filtros)
 * - KPIs em destaque (opcional)
 * - Tabela formatada com zebra rows e cabecalho colorido
 * - Linha de totais (opcional)
 * - Rodape com numeracao de paginas e data de emissao
 */
export function gerarRelatorioPdf(opts: RelatorioPdfOpts): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const orientacao = opts.orientacao || 'portrait';
      const doc = new (PDFDocument as any)({
        size: 'A4',
        layout: orientacao,
        margins: { top: 50, bottom: 50, left: 40, right: 40 },
        bufferPages: true,
        info: {
          Title: opts.titulo,
          Author: 'Associacao Espirita Wantuil de Freitas',
          Subject: 'Relatorio de Almoxarifado',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const larguraTotal = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ─── CABECALHO INSTITUCIONAL ───
      const yInicial = doc.y;

      // Tenta inserir a logo (50x50). Se nao encontrar, segue sem.
      let xTexto = doc.page.margins.left + 12;
      try {
        const fs = require('fs');
        const path = require('path');
        const candidatos = [
          path.join(__dirname, '..', '..', 'assets', 'logo-wantuil.jpg'),
          path.join(__dirname, '..', '..', '..', 'assets', 'logo-wantuil.jpg'),
          path.join(process.cwd(), 'assets', 'logo-wantuil.jpg'),
          path.join(process.cwd(), 'dist', 'assets', 'logo-wantuil.jpg'),
        ];
        const logoPath = candidatos.find((p: string) => fs.existsSync(p));
        if (logoPath) {
          doc.image(logoPath, doc.page.margins.left, yInicial, { width: 56, height: 56 });
          xTexto = doc.page.margins.left + 68;
        }
      } catch {
        // ignora falha de logo (relatorio continua sendo gerado)
      }

      // Bloco amarelo decorativo (cor da estrela da logo)
      doc.rect(xTexto - 8, yInicial, 4, 60).fill(COR_AMARELO);

      doc.fillColor(COR_PRIMARIA)
        .fontSize(9).font('Helvetica-Bold')
        .text('ASSOCIAÇÃO ESPÍRITA', xTexto, yInicial + 2);
      doc.fontSize(16).font('Helvetica-Bold')
        .text('Wantuil de Freitas', xTexto, yInicial + 14);
      doc.fillColor(COR_TEXTO_SUAVE).fontSize(8).font('Helvetica')
        .text('Sistema de Gestão de Almoxarifado · Cuiabá/MT',
          xTexto, yInicial + 36);

      // Data e hora de emissao (direita)
      const agora = new Date();
      const dataHora = fmtDataHora(agora);
      doc.fillColor(COR_TEXTO_SUAVE).fontSize(8).font('Helvetica')
        .text(`Emitido em ${dataHora}`,
          doc.page.margins.left, yInicial + 4,
          { width: larguraTotal, align: 'right' });

      doc.y = yInicial + 70;

      // ─── TITULO DO RELATORIO ───
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .lineWidth(1.5).strokeColor(COR_PRIMARIA).stroke();

      doc.moveDown(0.6);
      doc.fillColor(COR_TEXTO).fontSize(15).font('Helvetica-Bold')
        .text(opts.titulo.toUpperCase(), { align: 'left' });
      if (opts.subtitulo) {
        doc.fillColor(COR_TEXTO_SUAVE).fontSize(10).font('Helvetica')
          .text(opts.subtitulo);
      }
      doc.moveDown(0.5);

      // ─── FILTROS / PERIODO ───
      if (opts.periodo || opts.filtros?.length) {
        const filtrosLinhas: string[] = [];
        if (opts.periodo?.inicio || opts.periodo?.fim) {
          const ini = opts.periodo.inicio ? formatarData(opts.periodo.inicio) : '—';
          const fim = opts.periodo.fim ? formatarData(opts.periodo.fim) : '—';
          filtrosLinhas.push(`Período: ${ini} a ${fim}`);
        }
        opts.filtros?.forEach((f) => filtrosLinhas.push(`${f.label}: ${f.valor}`));

        doc.fillColor(COR_TEXTO_SUAVE).fontSize(9).font('Helvetica')
          .text(filtrosLinhas.join('   ·   '));
        doc.moveDown(0.8);
      }

      // ─── RESUMO / KPIs ───
      if (opts.resumo?.length) {
        const cardLargura = (larguraTotal - (opts.resumo.length - 1) * 8) / opts.resumo.length;
        const yResumo = doc.y;
        opts.resumo.forEach((kpi, idx) => {
          const x = doc.page.margins.left + idx * (cardLargura + 8);
          doc.rect(x, yResumo, cardLargura, 42)
            .fillAndStroke(COR_ZEBRA, COR_BORDA);
          doc.fillColor(COR_TEXTO_SUAVE).fontSize(8).font('Helvetica-Bold')
            .text(kpi.label.toUpperCase(), x + 10, yResumo + 6, { width: cardLargura - 20 });
          doc.fillColor(COR_PRIMARIA).fontSize(16).font('Helvetica-Bold')
            .text(String(kpi.valor), x + 10, yResumo + 20, { width: cardLargura - 20 });
        });
        doc.y = yResumo + 50;
        // Reseta cursor X (KPIs deixam o cursor preso na largura do ultimo card).
        doc.x = doc.page.margins.left;
        doc.moveDown(0.5);
      }

      // ─── TABELA ───
      const cabecalhoTabela = () => {
        const yHead = doc.y;
        doc.rect(doc.page.margins.left, yHead, larguraTotal, 22).fill(COR_PRIMARIA);
        let x = doc.page.margins.left + 6;
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
        opts.colunas.forEach((col) => {
          const w = col.largura * larguraTotal;
          doc.text(col.titulo.toUpperCase(), x, yHead + 7,
            { width: w - 8, align: col.alinhamento || 'left' });
          x += w;
        });
        doc.y = yHead + 22;
      };

      cabecalhoTabela();

      // Linhas com altura dinamica (ate 2 linhas de texto por celula)
      doc.font('Helvetica').fontSize(9);
      let zebra = false;
      opts.linhas.forEach((row, _idx) => {
        const yRow = doc.y;

        // Mede a altura necessaria de cada celula e usa a maior
        let alturaConteudoMax = 0;
        opts.colunas.forEach((col) => {
          const w = col.largura * larguraTotal;
          const valorBruto = obterValor(row, col.campo);
          const valor = col.formatar ? col.formatar(valorBruto, row) : String(valorBruto ?? '');
          const h = doc.heightOfString(valor, { width: w - 8 });
          if (h > alturaConteudoMax) alturaConteudoMax = h;
        });
        // Altura final: minimo 18, maximo ~36 (2 linhas), com padding
        const alturaRow = Math.min(36, Math.max(18, Math.ceil(alturaConteudoMax) + 8));

        // Quebra de pagina?
        if (yRow + alturaRow > doc.page.height - 70) {
          doc.addPage();
          cabecalhoTabela();
          zebra = false;
        }

        const y = doc.y;
        if (zebra) {
          doc.rect(doc.page.margins.left, y, larguraTotal, alturaRow).fill(COR_ZEBRA);
        }

        let x = doc.page.margins.left + 6;
        doc.fillColor(COR_TEXTO);
        opts.colunas.forEach((col) => {
          const w = col.largura * larguraTotal;
          const valorBruto = obterValor(row, col.campo);
          const valor = col.formatar ? col.formatar(valorBruto, row) : String(valorBruto ?? '');
          // Permite quebra de linha, ate 2 linhas, depois ellipsis
          doc.text(valor, x, y + 5, {
            width: w - 8,
            height: alturaRow - 6,
            align: col.alinhamento || 'left',
            ellipsis: true,
          });
          x += w;
        });

        doc.y = y + alturaRow;
        zebra = !zebra;
      });

      // Linha de fechamento da tabela
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .lineWidth(0.5).strokeColor(COR_BORDA).stroke();

      // ─── TOTAIS ───
      if (opts.totais?.length) {
        doc.moveDown(0.4);
        const yTotal = doc.y;
        doc.rect(doc.page.margins.left, yTotal, larguraTotal, 26)
          .fillAndStroke(COR_PETROLEO, COR_PETROLEO);
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
        const totalCols = opts.totais.length;
        const colW = larguraTotal / totalCols;
        opts.totais.forEach((t, i) => {
          const x = doc.page.margins.left + i * colW;
          doc.fontSize(8).font('Helvetica').fillColor('#E8F3F4')
            .text(t.label.toUpperCase(), x + 10, yTotal + 5, { width: colW - 20 });
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF')
            .text(t.valor, x + 10, yTotal + 14, { width: colW - 20 });
        });
        doc.y = yTotal + 30;
      }

      // ─── ESTADO VAZIO ───
      if (opts.linhas.length === 0) {
        doc.moveDown(2);
        doc.fillColor(COR_TEXTO_SUAVE).fontSize(11).font('Helvetica-Oblique')
          .text('Nenhum registro encontrado no período selecionado.', { align: 'center' });
      }

      // ─── RODAPE E PAGINACAO ───
      const totalPaginas = (doc as any).bufferedPageRange().count;
      for (let i = 0; i < totalPaginas; i++) {
        doc.switchToPage(i);
        const yRodape = doc.page.height - 30;
        doc.fontSize(7).font('Helvetica').fillColor(COR_TEXTO_SUAVE);
        doc.text(`Página ${i + 1} de ${totalPaginas}`,
          doc.page.margins.left, yRodape,
          { width: larguraTotal, align: 'center' });
        doc.text('Documento gerado automaticamente pelo Sistema Wantuil',
          doc.page.margins.left, yRodape + 10,
          { width: larguraTotal, align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Helpers
function obterValor(obj: any, caminho: string): any {
  return caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function formatarData(d: string | Date): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return fmtData(dt);
}

export const formatadores = {
  data: (v: any) => fmtData(v),
  dataHora: (v: any) => fmtDataHora(v),
  numero: (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR'),
  numero2: (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};
