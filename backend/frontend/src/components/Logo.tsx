interface Props { size?: number; collapsed?: boolean; light?: boolean }

export default function Logo({ size = 32, collapsed = false, light = true }: Props) {
  // Cores
  const corFigura = '#2A4A8A';
  const corEstrela = '#F5C842';
  const corTexto = light ? '#FFFFFF' : '#2A4A8A';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Marca: estrela + figura humana estilizada */}
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        {/* Estrela com raios assimétricos */}
        <g transform="translate(28, 14)">
          <path d={`
            M 0,0
            L -3,-12 L 0,-3 L 5,-14 L 2,-3 L 14,-8 L 4,-1
            L 16,2 L 4,1 L 12,10 L 2,3 L 5,14 L 1,4
            L -4,12 L -1,3 L -12,8 L -2,1 L -14,-3 L -2,-2 Z
          `} fill={corEstrela} />
        </g>
        {/* Figura humana estilizada (braço erguido) */}
        <path d="M 22 35 Q 35 25, 42 30 L 50 25 Q 56 28, 56 38 L 56 70 Q 56 78, 50 82 Q 42 85, 36 80 Q 30 70, 32 60 Q 26 50, 22 35 Z"
          fill={corFigura} />
        {/* Cabeça */}
        <circle cx="40" cy="38" r="6" fill={corFigura} />
      </svg>
      {!collapsed && (
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: corTexto, letterSpacing: '.08em', opacity: 0.85 }}>
            ASSOCIAÇÃO ESPÍRITA
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: corTexto, fontFamily: 'Georgia, serif' }}>
            Wantuil de Freitas
          </div>
        </div>
      )}
    </div>
  );
}
