import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument = require('pdfkit');

// Code 128-B
const PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

function code128Bars(text: string): number[] {
  const codes = [104]; // START-B
  for (const ch of text) codes.push(ch.charCodeAt(0) - 32);
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  codes.push(checksum % 103);
  codes.push(106); // STOP
  const widths: number[] = [];
  for (const c of codes) for (const w of PATTERNS[c]) widths.push(parseInt(w));
  return widths;
}

@Injectable()
export class EtiquetasService {
  constructor(private prisma: PrismaService) {}

  /**
   * Etiqueta 50x25mm para um LOTE especifico.
   * Imprime N copias do MESMO codigo de lote (para os N pacotes fisicos).
   *
   * Barcode: codigoLote (L-AAAAMMDD-NNNN) — quando lido na saida, identifica o lote.
   */
  async gerarPdfLote(loteId: string, quantidade: number): Promise<Buffer> {
    const lote = await this.prisma.lote.findUnique({
      where: { id: loteId },
      include: { item: true },
    });
    if (!lote) throw new NotFoundException('Lote nao encontrado');

    const MM = 2.8346;
    const W = 50 * MM, H = 25 * MM;
    const doc = new PDFDocument({ size: [W, H], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));

    const codigo = lote.codigoLote;
    const entrada = new Date(lote.dataEntrada).toLocaleDateString('pt-BR');
    const validade = lote.dataValidade
      ? new Date(lote.dataValidade).toLocaleDateString('pt-BR')
      : 'S/VALIDADE';

    for (let n = 0; n < quantidade; n++) {
      if (n > 0) doc.addPage({ size: [W, H], margin: 0 });

      // Nome do produto (limitado para caber)
      doc.font('Helvetica-Bold').fontSize(7);
      doc.text(lote.item.nome.toUpperCase().substring(0, 48), 4, 3, { width: W - 8, height: 14, ellipsis: true });

      // Datas
      doc.font('Helvetica').fontSize(5.5);
      doc.text(`ENTRADA: ${entrada}   VAL: ${validade}`, 4, 18, { width: W - 8 });

      // Barcode Code128 do codigo do LOTE
      const bars = code128Bars(codigo);
      const totalUnits = bars.reduce((a, b) => a + b, 0);
      const barAreaW = W - 16;
      const unit = barAreaW / totalUnits;
      let x = 8;
      const barTop = 30, barH = 24;
      let dark = true;
      doc.fillColor('#000');
      for (const w of bars) {
        if (dark) doc.rect(x, barTop, w * unit, barH).fill();
        x += w * unit;
        dark = !dark;
      }

      // Codigo legivel embaixo
      doc.font('Helvetica-Bold').fontSize(5.5);
      doc.fillColor('#000').text(codigo, 0, barTop + barH + 2, { width: W, align: 'center' });
    }

    doc.end();
    return done;
  }
}
