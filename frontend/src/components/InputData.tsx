import { useState, useEffect } from 'react';
import Icon from './Icon';

/**
 * Input de data que aceita tanto digitacao manual (dd/mm/aaaa) quanto o
 * date picker nativo. Internamente trabalha com formato ISO (YYYY-MM-DD),
 * que e o que vai para o backend.
 *
 * Em mobile, o usuario pode tocar no icone do calendario do navegador
 * para abrir o picker. Em desktop, pode digitar diretamente.
 */
interface Props {
  value: string; // formato ISO YYYY-MM-DD ou vazio
  onChange: (iso: string) => void;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}

function isoParaBr(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function brParaIso(br: string): string | null {
  // Aceita dd/mm/aaaa ou ddmmaaaa
  const limpo = br.replace(/\D/g, '');
  if (limpo.length !== 8) return null;
  const d = limpo.slice(0, 2);
  const m = limpo.slice(2, 4);
  const a = limpo.slice(4, 8);
  const dia = parseInt(d), mes = parseInt(m), ano = parseInt(a);
  if (mes < 1 || mes > 12) return null;
  if (dia < 1 || dia > 31) return null;
  if (ano < 1900 || ano > 2100) return null;
  return `${a}-${m}-${d}`;
}

function aplicarMascara(v: string): string {
  const digitos = v.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

export default function InputData({ value, onChange, required, className, style, placeholder }: Props) {
  const [texto, setTexto] = useState(isoParaBr(value));

  // Sincroniza quando value externo muda (ex: limpar form)
  useEffect(() => {
    setTexto(isoParaBr(value));
  }, [value]);

  function handleTextoChange(novo: string) {
    const mascarado = aplicarMascara(novo);
    setTexto(mascarado);
    // So propaga pro pai quando estiver completo e valido
    if (mascarado.length === 10) {
      const iso = brParaIso(mascarado);
      if (iso) onChange(iso);
    } else if (mascarado === '') {
      onChange('');
    }
  }

  function handlePickerChange(iso: string) {
    setTexto(isoParaBr(iso));
    onChange(iso);
  }

  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        type="text"
        className={className || 'input'}
        value={texto}
        onChange={(e) => handleTextoChange(e.target.value)}
        placeholder={placeholder || 'dd/mm/aaaa'}
        maxLength={10}
        inputMode="numeric"
        required={required}
        style={{ paddingRight: 36 }}
      />
      {/* Date picker nativo escondido, acionado pelo icone */}
      <input
        type="date"
        value={value || ''}
        onChange={(e) => handlePickerChange(e.target.value)}
        style={{
          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
          width: 28, opacity: 0, cursor: 'pointer',
        }}
        tabIndex={-1}
        aria-label="Abrir calendário"
      />
      <span style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: 'var(--text-3)', display: 'flex', alignItems: 'center',
      }}>
        <Icon name="calendar" size={14} />
      </span>
    </div>
  );
}
