interface Props {
  dados: { label: string; valor: number; cor?: string }[];
  altura?: number;
  formatarValor?: (v: number) => string;
}

/**
 * Grafico de barras horizontais SVG simples.
 * Mostra label, valor e barra proporcional ao maior valor.
 */
export default function GraficoBarras({ dados, altura = 26, formatarValor }: Props) {
  if (!dados.length) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
        Sem dados para exibir
      </div>
    );
  }

  const max = Math.max(...dados.map((d) => d.valor)) || 1;
  const fmt = formatarValor || ((v: number) => v.toLocaleString('pt-BR'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dados.map((d, i) => {
        const pct = (d.valor / max) * 100;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <div style={{ flex: '0 0 38%', minWidth: 0, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)', fontWeight: 500 }}>
              {d.label}
            </div>
            <div style={{ flex: 1, position: 'relative', height: altura,
              background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                background: d.cor || 'var(--primary)',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ flex: '0 0 60px', textAlign: 'right', fontWeight: 600,
              color: 'var(--primary-dk)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(d.valor)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
