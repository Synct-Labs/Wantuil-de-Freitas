import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Icon from './Icon';

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
}

const TIPO_ROTA: Record<string, string> = {
  ABAIXO_MINIMO: '/itens',
  ESGOTADO: '/itens',
  PROXIMO_VENCIMENTO: '/validade',
  ADICIONAL: '/validade',
  DESCARTE: '/validade',
  VENCIDO: '/validade',
  RESUMO_SEMANAL: '/configuracoes',
};

const TIPO_COR: Record<string, string> = {
  ABAIXO_MINIMO: 'var(--a-600)',
  ESGOTADO: 'var(--r-600)',
  PROXIMO_VENCIMENTO: 'var(--a-600)',
  ADICIONAL: 'var(--or)',
  DESCARTE: 'var(--r-600)',
  VENCIDO: 'var(--or)',
  RESUMO_SEMANAL: 'var(--primary-dk)',
};

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas}h atrás`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `${dias}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function NotificacoesBell() {
  const [aberto, setAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  // Polling da contagem a cada 60s
  useEffect(() => {
    carregarContagem();
    const intervalo = setInterval(carregarContagem, 60_000);
    return () => clearInterval(intervalo);
  }, []);

  // Carrega lista quando abre
  useEffect(() => {
    if (aberto) carregarLista();
  }, [aberto]);

  // Fecha ao clicar fora
  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [aberto]);

  async function carregarContagem() {
    try {
      const { data } = await api.get('/notificacoes/contagem-nao-lidas');
      setNaoLidas(data.total || 0);
    } catch {/* silencioso */}
  }

  async function carregarLista() {
    setCarregando(true);
    try {
      const { data } = await api.get('/notificacoes', { params: { limite: 15 } });
      setLista(data);
    } catch {/* silencioso */}
    finally { setCarregando(false); }
  }

  async function abrirNotificacao(n: Notificacao) {
    if (!n.lida) {
      try {
        await api.patch(`/notificacoes/${n.id}/lida`);
        setLista(lista.map(x => x.id === n.id ? { ...x, lida: true } : x));
        setNaoLidas(Math.max(0, naoLidas - 1));
      } catch {/* segue */}
    }
    const rota = TIPO_ROTA[n.tipo];
    if (rota) {
      setAberto(false);
      nav(rota);
    }
  }

  async function marcarTodasLidas() {
    try {
      await api.post('/notificacoes/marcar-todas-lidas');
      setLista(lista.map(n => ({ ...n, lida: true })));
      setNaoLidas(0);
    } catch {/* segue */}
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setAberto(!aberto)}
        aria-label="Notificações"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 8, borderRadius: 6, position: 'relative',
          color: 'rgba(255,255,255,0.85)',
          display: 'flex', alignItems: 'center',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Icon name="bell" size={18} />
        {naoLidas > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: 'var(--wf-amarelo)',
            color: 'var(--wf-azul-dk)',
            fontSize: 9, fontWeight: 700,
            minWidth: 16, height: 16, borderRadius: 8,
            padding: '0 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div style={(() => {
          // Posiciona em FIXED ancorado a viewport para nao ser cortado por
          // overflow do topbar ou de containers ancestrais.
          const rect = containerRef.current?.getBoundingClientRect();
          const topo = (rect?.bottom ?? 56) + 8;
          // Margem segura da borda direita
          const direita = Math.max(8, window.innerWidth - (rect?.right ?? window.innerWidth));
          return {
            position: 'fixed' as const, top: topo, right: direita,
            width: 360, maxWidth: 'calc(100vw - 16px)',
            background: 'var(--surface)',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            border: '1px solid var(--border)',
            zIndex: 1000,
            maxHeight: 'min(480px, calc(100vh - 80px))', display: 'flex', flexDirection: 'column' as const,
          };
        })()}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
              Notificações {naoLidas > 0 && <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>({naoLidas} novas)</span>}
            </div>
            {naoLidas > 0 && (
              <button onClick={marcarTodasLidas}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--primary-dk)', fontSize: 11, fontWeight: 500,
                  padding: 4,
                }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {carregando ? (
              <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner" /></div>
            ) : lista.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
                <Icon name="bell" size={28} color="var(--text-3)" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>Sem notificações</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Tudo certo por aqui.</div>
              </div>
            ) : (
              lista.map((n) => (
                <button key={n.id} onClick={() => abrirNotificacao(n)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 16px',
                    background: n.lida ? 'transparent' : 'var(--primary-bg)',
                    border: 'none', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex', gap: 10,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = n.lida ? 'var(--surface-2)' : 'var(--surface-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = n.lida ? 'transparent' : 'var(--primary-bg)')}
                >
                  <div style={{
                    width: 6, alignSelf: 'stretch', borderRadius: 3,
                    background: TIPO_COR[n.tipo] || 'var(--text-3)',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: n.lida ? 500 : 600,
                      color: 'var(--text)', marginBottom: 2, lineHeight: 1.35,
                    }}>
                      {n.titulo}
                    </div>
                    <div style={{
                      fontSize: 11, color: 'var(--text-2)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      marginBottom: 4,
                    }}>
                      {n.mensagem.split('\n')[0].replace(/^[ℹ⚠🔴]\s*/, '')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                      {tempoRelativo(n.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
