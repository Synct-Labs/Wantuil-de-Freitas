import { useEffect, useState, useCallback, ReactNode, createContext, useContext } from 'react';
import Icon from './Icon';

/**
 * Sistema de toast (notificacao temporaria no canto da tela).
 *
 * Uso:
 *   const toast = useToast();
 *   toast.sucesso('Saída registrada', '6 unidades de Coca-Cola para Cozinha');
 *   toast.erro('Falha ao salvar', 'Verifique a quantidade');
 *   toast.info('Info qualquer');
 *
 * Para funcionar, envolva o app em <ToastProvider> (ja feito no main.tsx).
 */

type Tipo = 'sucesso' | 'erro' | 'aviso' | 'info';

interface ToastMsg {
  id: number;
  tipo: Tipo;
  titulo: string;
  detalhe?: string;
}

interface ToastApi {
  sucesso: (titulo: string, detalhe?: string) => void;
  erro: (titulo: string, detalhe?: string) => void;
  aviso: (titulo: string, detalhe?: string) => void;
  info: (titulo: string, detalhe?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ESTILOS: Record<Tipo, { bg: string; cor: string; borda: string; icon: string }> = {
  sucesso: { bg: 'var(--green-bg)',  cor: 'var(--green)',     borda: 'var(--green)',     icon: 'check' },
  erro:    { bg: 'var(--r-50)',      cor: 'var(--r-600)',     borda: 'var(--r-200)',     icon: 'alert-circle' },
  aviso:   { bg: 'var(--a-50)',      cor: 'var(--a-600)',     borda: 'var(--a-200)',     icon: 'alert-triangle' },
  info:    { bg: 'var(--primary-bg)', cor: 'var(--primary-dk)', borda: 'var(--primary)',  icon: 'info' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const remover = useCallback((id: number) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }, []);

  const adicionar = useCallback((tipo: Tipo, titulo: string, detalhe?: string) => {
    const id = Date.now() + Math.random();
    setToasts((arr) => [...arr, { id, tipo, titulo, detalhe }]);
    // Auto-remove apos 4s (6s para erros, da mais tempo de ler)
    const ms = tipo === 'erro' ? 6000 : 4000;
    setTimeout(() => remover(id), ms);
  }, [remover]);

  const api: ToastApi = {
    sucesso: (t, d) => adicionar('sucesso', t, d),
    erro:    (t, d) => adicionar('erro', t, d),
    aviso:   (t, d) => adicionar('aviso', t, d),
    info:    (t, d) => adicionar('info', t, d),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Container fixo na viewport, top-right */}
      <div style={{
        position: 'fixed',
        top: 70,
        right: 16,
        zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        maxWidth: 'calc(100vw - 32px)', width: 360,
        pointerEvents: 'none',
      }}>
        {toasts.map((t) => <Toast key={t.id} msg={t} onClose={() => remover(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ msg, onClose }: { msg: ToastMsg; onClose: () => void }) {
  const [visivel, setVisivel] = useState(false);
  const estilo = ESTILOS[msg.tipo];

  useEffect(() => {
    // Anima entrada
    requestAnimationFrame(() => setVisivel(true));
  }, []);

  return (
    <div style={{
      background: estilo.bg,
      border: `1px solid ${estilo.borda}`,
      borderRadius: 8,
      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
      padding: '10px 12px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      transform: visivel ? 'translateX(0)' : 'translateX(120%)',
      opacity: visivel ? 1 : 0,
      transition: 'transform 0.25s ease, opacity 0.25s ease',
      pointerEvents: 'auto',
    }}>
      <Icon name={estilo.icon as any} size={16} color={estilo.cor} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: estilo.cor, lineHeight: 1.3 }}>
          {msg.titulo}
        </div>
        {msg.detalhe && (
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>
            {msg.detalhe}
          </div>
        )}
      </div>
      <button onClick={onClose} aria-label="Fechar"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-3)', padding: 0, flexShrink: 0, display: 'flex' }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}
