/**
 * Formatadores de data/hora sempre no fuso de Cuiabá (America/Cuiaba, UTC-4 fixo).
 * O servidor pode rodar em UTC (Render), mas a instituição é em Mato Grosso,
 * então qualquer data exibida em PDFs/notificações/e-mails deve usar este fuso.
 */
const FUSO_CUIABA = 'America/Cuiaba';

/**
 * "14/01/2026" (apenas data, no fuso de Cuiabá).
 */
export function fmtData(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_CUIABA,
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(dt);
}

/**
 * "14/01/2026 às 15:30" (data + hora, no fuso de Cuiabá).
 */
export function fmtDataHora(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  const data = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_CUIABA,
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(dt);
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_CUIABA,
    hour: '2-digit', minute: '2-digit',
  }).format(dt);
  return `${data} às ${hora}`;
}

/**
 * "14/01/2026 15:30" — versao compacta (sem "às"), para etiquetas e listas.
 */
export function fmtDataHoraCompacta(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_CUIABA,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(dt);
}

/**
 * Numero formatado em pt-BR (1.234,56)
 */
export function fmtNumero(v: number | string | null | undefined, decimais = 0): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais });
}

/**
 * Converte uma string "YYYY-MM-DD" (date input HTML, sem hora) para um
 * Date no MEIO-DIA UTC daquele dia.
 *
 * Por que meio-dia UTC: garante que ao formatar em qualquer fuso entre
 * UTC-11 e UTC+11, o dia permanece o mesmo. Salvar como meia-noite UTC
 * causa o classico bug de "data com 1 dia a menos" em fusos negativos
 * (como o de Cuiaba, UTC-4): meia-noite UTC menos 4h vira 20h do dia
 * anterior, e ai a data exibida pula 1 dia para tras.
 *
 * Aceita tambem strings ISO completas (passa direto pro Date).
 */
export function parseDataLocal(s: string | Date | null | undefined): Date | null {
  if (!s) return null;
  if (s instanceof Date) return s;
  // Se for so YYYY-MM-DD (10 chars, sem T nem fuso), ancora no meio-dia UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00.000Z`);
  }
  // Caso contrario (ja tem hora/fuso), confia no parsing nativo
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
