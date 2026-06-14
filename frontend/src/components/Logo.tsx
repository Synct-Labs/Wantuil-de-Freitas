interface Props {
  variant?: 'sidebar' | 'login';
  size?: number;
}

/**
 * Logo oficial da Associacao Espirita Wantuil de Freitas.
 * Usa a imagem original (frontend/public/logo-wantuil.jpg).
 *
 * - variant="sidebar": versao compacta no canto da barra lateral
 * - variant="login": versao grande centralizada na tela de login
 */
export default function Logo({ variant = 'sidebar', size }: Props) {
  if (variant === 'login') {
    return (
      <img
        src="/logo-wantuil.jpg"
        alt="Associação Espírita Wantuil de Freitas"
        style={{
          width: size || 140,
          height: size || 140,
          borderRadius: 16,
          display: 'block',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      />
    );
  }

  // Variante sidebar: imagem com cantos arredondados, "selo" institucional
  return (
    <img
      src="/logo-wantuil.jpg"
      alt="Associação Espírita Wantuil de Freitas"
      style={{
        width: '100%',
        maxWidth: 190,
        height: 'auto',
        borderRadius: 10,
        display: 'block',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    />
  );
}
