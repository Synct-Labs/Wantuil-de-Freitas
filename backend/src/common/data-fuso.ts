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

/** Numero formatado em pt-BR (1.234,56) */
export function fmtNumero(v: number | string | null | undefined, decimais = 0): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais });
}
