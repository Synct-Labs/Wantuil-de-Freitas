import { useEffect, useState } from 'react';
import api from '../api/client';
import Scanner from '../components/Scanner';
import Icon from '../components/Icon';
import { fmtData } from '../utils/format';

interface ItemLote { itemId: string; nome: string; quantidade: number; dataValidade?: string; codigoEan?: string }

export default function Entradas() {
  const [doadores, setDoadores] = useState<any[]>([]);
  const [doadorId, setDoadorId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/doadores').then((r) => setDoadores(r.data));
    carregarMovs();
  }, []);

  useEffect(() => {
    if (busca.length < 2) { setSugestoes([]); return; }
    const t = setTimeout(() => {
      api.get('/itens', { params: { busca } }).then((r) => setSugestoes(r.data.slice(0, 5)));
    }, 200);
    return () => clearTimeout(t);
  }, [busca]);

  function carregarMovs() {
    api.get('/movimentacoes', { params: { tipo: 'ENTRADA' } }).then((r) => setMovs(r.data.slice(0, 6)));
  }

  function adicionarItem(i: any) {
    if (itens.find((it) => it.itemId === i.id)) return;
    setItens([...itens, { itemId: i.id, nome: i.nome, quantidade: 1, codigoEan: i.codigoEan, dataValidade: '' }]);
    setBusca(''); setSugestoes([]);
  }

  async function salvar() {
    if (!itens.length) { setErro('Adicione ao menos um item'); return; }
    setSalvando(true); setErro('');
    try {
      await api.post('/movimentacoes/entrada', {
        doadorId: doadorId || undefined, observacao,
        itens: itens.map((i) => ({ itemId: i.itemId, quantidade: i.quantidade, dataValidade: i.dataValidade || undefined })),
      });
      setItens([]); setDoadorId(''); setObservacao('');
      carregarMovs();
      alert('Entrada registrada com sucesso.');
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao registrar');
    } finally { setSalvando(false); }
  }

  function imprimirEtiquetas(item: ItemLote) {
    const token = localStorage.getItem('token');
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/etiquetas/${item.itemId}?qtd=${item.quantidade}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.blob()).then((b) => window.open(URL.createObjectURL(b), '_blank'));
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }} className="desktop-only">Entradas — Doações Recebidas</h2>

      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Icon name="arrow-down" size={16} color="var(--green)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Registrar nova entrada</span>
          </div>

          <label className="label">Doador</label>
          <select className="select" value={doadorId}
            onChange={(e) => setDoadorId(e.target.value)} style={{ marginBottom: 14 }}>
            <option value="">Doação avulsa (sem doador identificado)</option>
            {doadores.map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.04em' }}>Itens da doação</div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 8, position: 'relative' }}>
              <input className="input" placeholder="Buscar item ou digitar código"
                value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="btn" onClick={() => setShowScanner(true)} title="Scanner">
                <Icon name="barcode" size={14} />
              </button>
              {sugestoes.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                  background: 'var(--surface)', border: '1px solid var(--border-2)',
                  borderRadius: 6, zIndex: 10, maxHeight: 240, overflowY: 'auto',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                }}>
                  {sugestoes.map((s) => (
                    <div key={s.id} onClick={() => adicionarItem(s)}
                      style={{ padding: '8px 12px', cursor: 'pointer',
                        borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                        Saldo: {s.saldoAtual} {s.unidadeMedida}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {itens.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                Nenhum item adicionado ainda
              </div>
            )}

            {itens.map((it, idx) => (
              <div key={idx} style={{
                background: 'var(--surface-2)', borderRadius: 6,
                padding: 10, marginBottom: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.nome}</div>
                  </div>
                  <button className="btn icon sm" onClick={() => imprimirEtiquetas(it)} title="Etiquetas">
                    <Icon name="tag" size={13} />
                  </button>
                  <button className="btn icon sm" onClick={() => setItens(itens.filter((_, i) => i !== idx))} title="Remover">
                    <Icon name="x" size={13} />
                  </button>
                </div>
                <div className="grid-2" style={{ gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 2 }}>Quantidade</div>
                    <input className="input" type="number" min="1" value={it.quantidade}
                      onChange={(e) => { const v = [...itens]; v[idx].quantidade = parseFloat(e.target.value) || 0; setItens(v); }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 2 }}>Validade (opcional)</div>
                    <input className="input" type="date" value={it.dataValidade}
                      onChange={(e) => { const v = [...itens]; v[idx].dataValidade = e.target.value; setItens(v); }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <label className="label">Observações</label>
          <textarea className="input" rows={2} value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            style={{ marginBottom: 14, resize: 'vertical' }} placeholder="Opcional" />

          {erro && (
            <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--r-50)',
              color: 'var(--r-600)', fontSize: 12, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="alert-circle" size={14} />{erro}
            </div>
          )}

          <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={salvar} disabled={salvando}>
            {salvando ? <><span className="spinner" /> Salvando</> : <><Icon name="check" size={14} /> Confirmar entrada</>}
          </button>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="file-text" size={16} color="var(--primary)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Entradas recentes</span>
          </div>
          {movs.length === 0 ? (
            <div className="empty-state">
              <Icon name="arrow-down" size={28} color="var(--text-3)" style={{ margin: '0 auto 8px' }} />
              <div className="empty-state-title">Sem entradas recentes</div>
            </div>
          ) : movs.map((m) => (
            <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {m.itens.map((mi: any) => mi.item.nome).join(', ')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>
                  +{m.itens.reduce((s: number, mi: any) => s + Number(mi.quantidade), 0)} un
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                {m.doador?.nome || 'Doação avulsa'} · {fmtData(m.dataMovimentacao)} · {m.usuario.nome}
              </div>
            </div>
          ))}

          <div style={{
            marginTop: 16, padding: 12,
            background: 'var(--primary-bg)', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Icon name="bell" size={16} color="var(--primary-dk)" />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Próximo resumo</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Sábado às 08h00</div>
            </div>
          </div>
        </div>
      </div>

      {showScanner && (
        <Scanner
          onClose={() => setShowScanner(false)}
          onItemEncontrado={(i) => adicionarItem(i)}
          onCadastroManual={(ean) => alert(`Código ${ean} não cadastrado. Vá em "Itens" para cadastrar.`)}
        />
      )}
    </div>
  );
}
