import { useEffect, useState } from 'react';
import api from '../api/client';
import Scanner from '../components/Scanner';
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
      alert('Entrada registrada com sucesso!');
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
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Entradas (Doações)</h2>
      <div className="grid2">
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 12 }}>➕ Registrar entrada</div>

          <label className="label">Doador</label>
          <select className="input" value={doadorId} onChange={(e) => setDoadorId(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">Doação avulsa</option>
            {doadores.map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>

          <div style={{ border: '0.5px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 500 }}>Itens</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, position: 'relative' }}>
              <input className="input" placeholder="Buscar item ou digitar EAN..." value={busca}
                onChange={(e) => setBusca(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="btn" onClick={() => setShowScanner(true)}>📷</button>
              {sugestoes.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                  border: '0.5px solid var(--border2)', borderRadius: 8, marginTop: 2, zIndex: 10 }}>
                  {sugestoes.map((s) => (
                    <div key={s.id} onClick={() => adicionarItem(s)}
                      style={{ padding: 8, cursor: 'pointer', borderBottom: '0.5px solid var(--border)' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>Saldo: {s.saldoAtual} {s.unidadeMedida}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {itens.map((it, idx) => (
              <div key={idx} style={{ background: 'var(--g50)', borderRadius: 6, padding: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{it.nome}</div>
                  </div>
                  <button className="btn sm" onClick={() => imprimirEtiquetas(it)} title="Imprimir etiquetas">🏷️</button>
                  <button className="btn sm" onClick={() => setItens(itens.filter((_, i) => i !== idx))}>✕</button>
                </div>
                <div className="grid2" style={{ marginTop: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text2)' }}>Qtd</div>
                    <input className="input" type="number" min="1" value={it.quantidade}
                      onChange={(e) => { const v = [...itens]; v[idx].quantidade = parseFloat(e.target.value) || 0; setItens(v); }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text2)' }}>Validade (opcional)</div>
                    <input className="input" type="date" value={it.dataValidade}
                      onChange={(e) => { const v = [...itens]; v[idx].dataValidade = e.target.value; setItens(v); }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <label className="label">Observações</label>
          <textarea className="input" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} style={{ marginBottom: 12 }} />
          {erro && <div style={{ color: 'var(--r600)', fontSize: 12, marginBottom: 10 }}>{erro}</div>}
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : '✅ Confirmar entrada'}
          </button>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 12 }}>📋 Entradas recentes</div>
          {movs.map((m) => (
            <div key={m.id} style={{ padding: '9px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>
                  {m.itens.map((mi: any) => mi.item.nome).join(', ')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--g600)', fontWeight: 500 }}>
                  +{m.itens.reduce((s: number, mi: any) => s + Number(mi.quantidade), 0)} un
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                {m.doador?.nome || 'Avulsa'} · {fmtData(m.dataMovimentacao)} · {m.usuario.nome}
              </div>
            </div>
          ))}
          {movs.length === 0 && <div style={{ fontSize: 13, color: 'var(--text2)' }}>Nenhuma entrada registrada.</div>}
        </div>
      </div>

      {showScanner && (
        <Scanner
          onClose={() => setShowScanner(false)}
          onItemEncontrado={(i) => adicionarItem(i)}
          onCadastroManual={(ean) => { alert(`EAN ${ean} não cadastrado. Vá em Itens para cadastrar.`); }}
        />
      )}
    </div>
  );
}
