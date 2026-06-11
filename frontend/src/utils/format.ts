export const fmtData = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

export const fmtCpfCnpj = (doc?: string) => {
  if (!doc) return '—';
  const n = doc.replace(/\D/g, '');
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
};

export const STATUS_VALIDADE: Record<string, { label: string; cor: string }> = {
  VIGENTE: { label: 'Vigente', cor: 'green' },
  PROXIMO: { label: 'Próx. vencimento', cor: 'amber' },
  VENCIDO: { label: 'Vencido', cor: 'orange' },
  ADICIONAL: { label: 'Período adicional', cor: 'orange' },
  DESCARTE: { label: 'Descarte', cor: 'red' },
};
