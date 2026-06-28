import { parseDataLocal, fmtData } from './data-fuso';

describe('data-fuso — parseDataLocal e fmtData', () => {
  it('parseDataLocal converte YYYY-MM-DD para meio-dia UTC (evita bug de fuso)', () => {
    const d = parseDataLocal('2026-07-18');
    expect(d).toBeInstanceOf(Date);
    // Meio-dia UTC garante que em qualquer fuso entre UTC-11 e UTC+11 o dia
    // continua sendo 18, evitando o bug classico de "1 dia a menos".
    expect(d!.toISOString()).toBe('2026-07-18T12:00:00.000Z');
  });

  it('parseDataLocal aceita Date e devolve direto', () => {
    const original = new Date('2026-07-18T15:30:00.000Z');
    const d = parseDataLocal(original);
    expect(d).toBe(original);
  });

  it('parseDataLocal retorna null para entrada vazia', () => {
    expect(parseDataLocal(null)).toBeNull();
    expect(parseDataLocal(undefined)).toBeNull();
    expect(parseDataLocal('')).toBeNull();
  });

  it('parseDataLocal aceita ISO completa', () => {
    const d = parseDataLocal('2026-07-18T20:00:00.000Z');
    expect(d!.getUTCHours()).toBe(20);
  });

  it('fmtData mostra o dia correto em fuso de Cuiaba (regressao do bug de etiqueta)', () => {
    // Data salva via parseDataLocal: 18 julho meio-dia UTC.
    // Formatada em Cuiaba (UTC-4): 08:00 do dia 18 -> deve mostrar "18/07/2026".
    const d = parseDataLocal('2026-07-18');
    expect(fmtData(d)).toBe('18/07/2026');
  });

  it('fmtData lida com strings ISO sem disparar 1 dia a menos', () => {
    // O bug original era: new Date("2026-07-18") -> 00:00 UTC -> em UTC-4 vira 20h do dia 17.
    // Aqui o parseDataLocal evita isso.
    expect(fmtData(parseDataLocal('2026-07-18'))).toBe('18/07/2026');
  });

  it('fmtData retorna "—" para null/undefined/invalido', () => {
    expect(fmtData(null)).toBe('—');
    expect(fmtData(undefined)).toBe('—');
    expect(fmtData('data-invalida')).toBe('—');
  });
});
