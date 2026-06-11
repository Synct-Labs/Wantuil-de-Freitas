import { useEffect, useState } from 'react';
import api from '../api/client';
import Scanner from '../components/Scanner';
import { fmtData } from '../utils/format';

interface ItemLote { itemId: string; nome: string; quantidade: number; saldoAtual: number; estoqueMinimo: number; unidade: string }

export default function Saidas() {
  const [destinoTipo, setDestinoTipo] = useState<'BENEFICIARIO' | 'SETOR'>('BENEFICIARIO');
  const [destinoId, setDestinoId] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [beneficiarios, setBeneficiarios] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [violacoes, setViolacoes] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/beneficiarios').then((r) => setBeneficiarios(r.data.filter((b: any) => b.ativo)));
    api.get('/setores').then((r) => setSetores(r.data));
    carregarMovs();
  }, []);

  useEffect(() => {
    if (busca.length < 2) { setSugestoes([]); return; }
    const t = setTimeout(() => api.get('/itens', { params: { busca } }).then((r) => setSugestoes(r.data.slice(0, 5))), 200);
    return () => clearTimeout(t);
  }, [busca]);

  function carregarMovs() {
    api.get('/movimentacoes', { params: { tipo: 'SAIDA' } }).then((r) => setMovs(r.data.slice(0, 6)));
  }

  function adicionarItem(i: any) {
    if (itens.find((it) => it.itemId === i.id)) return;
    setItens([...itens, {
      itemId: i.id, nome: i.nome, quantidade: 1,
      saldoAtual: Number(i.saldoAtual), estoqueMinimo: Number(i.estoqueMinimo),
      unidade: i.unidadeMedida,
    }]);
    setBusca(''); setSugestoes([]);
  }

  async function salvar(confirmarMinimo = false) {
    if (!destinoId) { setErro('Selecione um destino'); return; }
    if (!itens.length) { setErro('Adicione ao menos um item'); return; }
    setErro(''); setSalvando(true);
    try {
      const payload: any = {
        destinoSaida: destinoTipo,
        ...(destinoTipo === 'BENEFICIARIO' ? { beneficiarioId: destinoId } : { setorId: destinoId }),
        finalidade,
        confirmadoMinimo: confirmarMinimo,
        itens: itens.map((i) => ({ itemId: i.itemId, quantidade: i.quantidade })),
      };
      const { data } = await api.post('/movimentacoes/saida', payload);
      if (data.requerConfirmacao) {
        setViolacoes(data.violacoes);
        return;
      }
      setItens([]); setDestinoId(''); setFinalidade(''); setViolacoes([]);
      carregarMovs();
      alert('Saída registrada!');
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao registrar');
    } finally { setSalvando(false); }
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Saídas (Distribuição)</h2>
      <div className="grid2">
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 12 }}>↑ Registrar saída</div>

          <div className="grid2" style={{ marginBottom: 12 }}>
            <div>
              <label className="label">Destino</label>
              <select className="input" value={destinoTipo} onChange={(e) => { setDestinoTipo(e.target.value as any); setDestinoId(''); }}>
                <option value="BENEFICIARIO">Beneficiário</option>
                <option value="SETOR">Setor interno</option>
              </select>
            </div>
            <div>
              <label className="label">{destinoTipo === 'BENEFICIARIO' ? 'Beneficiário' : 'Setor'} *</label>
              <select className="input" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                <option value="">Selecione...</option>
                {destinoTipo === 'BENEFICIARIO'
                  ? beneficiarios.map((b: any) => <option key={b.id} value={b.id}>{b.nome}</option>)
                  : setores.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          </div>

          <label className="label">Finalidade</label>
          <input className="input" value={finalidade} onChange={(e) => setFinalidade(e.target.value)}
            placeholder="Ex: Cesta básica mensal" style={{ marginBottom: 12 }} />

          <div style={{ border: '0.5px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 500 }}>Itens</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, position: 'relative' }}>
              <input className="input" placeholder="Buscar item ou digitar EAN..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1 }} />
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

            {itens.map((it, idx) => {
              const resultado = it.saldoAtual - it.quantidade;
              const violaMinimo = resultado <= it.estoqueMinimo;
              const saldoInsuficiente = resultado < 0;
              return (
                <div key={idx} style={{
                  background: saldoInsuficiente ? 'var(--r50)' : violaMinimo ? 'var(--a50)' : 'var(--g50)',
                  borderRadius: 6, padding: 8, marginBottom: 6,
                  border: saldoInsuficiente ? '0.5px solid var(--r600)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{it.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                        Saldo: {it.saldoAtual} → resultante: {resultado} · Mínimo: {it.estoqueMinimo}
                      </div>
                    </div>
                    <input className="input" type="number" min="1" max={it.saldoAtual} value={it.quantidade}
                      onChange={(e) => { const v = [...itens]; v[idx].quantidade = parseFloat(e.target.value) || 0; setItens(v); }}
                      style={{ width: 70 }} />
                    <button className="btn sm" onClick={() => setItens(itens.filter((_, i) => i !== idx))}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>

          {violacoes.length > 0 && (
            <div style={{ background: 'var(--r50)', border: '0.5px solid var(--r600)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 500, color: 'var(--r600)', marginBottom: 6 }}>⚠️ Esta retirada deixa o estoque abaixo do mínimo</div>
              {violacoes.map((v: any, i: number) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                  <strong>{v.item}</strong>: {v.saldoAtual} → <strong style={{ color: 'var(--r600)' }}>{v.saldoResultante}</strong> (mín: {v.estoqueMinimo})
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="btn danger sm" onClick={() => salvar(true)}>Confirmar mesmo assim</button>
                <button className="btn sm" onClick={() => setViolacoes([])}>Cancelar</button>
              </div>
            </div>
          )}

          {erro && <div style={{ color: 'var(--r600)', fontSize: 12, marginBottom: 10 }}>{erro}</div>}
          {violacoes.length === 0 && (
            <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => salvar(false)} disabled={salvando}>
              {salvando ? 'Salvando...' : '✅ Confirmar saída'}
            </button>
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 12 }}>📋 Saídas recentes</div>
          {movs.map((m) => (
            <div key={m.id} style={{ padding: '9px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>
                  {m.itens.map((mi: any) => mi.item.nome).join(', ')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--r600)', fontWeight: 500 }}>
                  −{m.itens.reduce((s: number, mi: any) => s + Number(mi.quantidade), 0)} un
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                {m.beneficiario?.nome || m.setor?.nome || '—'} · {fmtData(m.dataMovimentacao)} · {m.usuario.nome}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showScanner && (
        <Scanner
          onClose={() => setShowScanner(false)}
          onItemEncontrado={(i) => adicionarItem(i)}
          onCadastroManual={() => alert('Item não cadastrado. Cadastre antes de dar saída.')}
        />
      )}
    </div>
  );
}
