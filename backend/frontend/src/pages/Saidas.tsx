import { useEffect, useState } from 'react';
import api from '../api/client';
import Scanner from '../components/Scanner';
import Icon from '../components/Icon';
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
      alert('Saída registrada com sucesso.');
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao registrar');
    } finally { setSalvando(false); }
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }} className="desktop-only">Saídas — Distribuição</h2>

      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Icon name="arrow-up" size={16} color="var(--r-600)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Registrar saída</span>
          </div>

          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label className="label">Destino</label>
              <select className="select" value={destinoTipo}
                onChange={(e) => { setDestinoTipo(e.target.value as any); setDestinoId(''); }}>
                <option value="BENEFICIARIO">Beneficiário</option>
                <option value="SETOR">Setor interno</option>
              </select>
            </div>
            <div>
              <label className="label">{destinoTipo === 'BENEFICIARIO' ? 'Beneficiário' : 'Setor'} *</label>
              <select className="select" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                <option value="">Selecione...</option>
                {destinoTipo === 'BENEFICIARIO'
                  ? beneficiarios.map((b: any) => <option key={b.id} value={b.id}>{b.nome}</option>)
                  : setores.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          </div>

          <label className="label">Finalidade</label>
          <input className="input" value={finalidade}
            onChange={(e) => setFinalidade(e.target.value)}
            placeholder="Ex: Cesta básica mensal" style={{ marginBottom: 12 }} />

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.04em' }}>Itens</div>

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
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
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
                Nenhum item adicionado
              </div>
            )}

            {itens.map((it, idx) => {
              const resultado = it.saldoAtual - it.quantidade;
              const violaMinimo = resultado <= it.estoqueMinimo;
              const saldoInsuficiente = resultado < 0;
              return (
                <div key={idx} style={{
                  background: saldoInsuficiente ? 'var(--r-50)' : violaMinimo ? 'var(--a-50)' : 'var(--surface-2)',
                  borderRadius: 6, padding: 10, marginBottom: 6,
                  border: saldoInsuficiente ? '1px solid var(--r-600)' : '1px solid transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{it.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                        Saldo: {it.saldoAtual} → após retirada: {resultado} · Mínimo: {it.estoqueMinimo}
                      </div>
                    </div>
                    <input className="input" type="number" min="1" max={it.saldoAtual} value={it.quantidade}
                      onChange={(e) => { const v = [...itens]; v[idx].quantidade = parseFloat(e.target.value) || 0; setItens(v); }}
                      style={{ width: 72 }} />
                    <button className="btn icon sm" onClick={() => setItens(itens.filter((_, i) => i !== idx))}>
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {violacoes.length > 0 && (
            <div style={{
              background: 'var(--r-50)', border: '1px solid var(--r-600)',
              borderRadius: 8, padding: 12, marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon name="alert-triangle" size={16} color="var(--r-600)" />
                <span style={{ fontWeight: 600, color: 'var(--r-600)', fontSize: 13 }}>
                  Esta retirada deixa o estoque abaixo do mínimo
                </span>
              </div>
              {violacoes.map((v: any, i: number) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                  <strong>{v.item}</strong>: {v.saldoAtual} → <strong style={{ color: 'var(--r-600)' }}>{v.saldoResultante}</strong> (mínimo: {v.estoqueMinimo})
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button className="btn danger sm" onClick={() => salvar(true)}>
                  <Icon name="check" size={13} /> Confirmar mesmo assim
                </button>
                <button className="btn sm" onClick={() => setViolacoes([])}>Cancelar</button>
              </div>
            </div>
          )}

          {erro && (
            <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--r-50)',
              color: 'var(--r-600)', fontSize: 12, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="alert-circle" size={14} />{erro}
            </div>
          )}

          {violacoes.length === 0 && (
            <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => salvar(false)} disabled={salvando}>
              {salvando ? <><span className="spinner" /> Salvando</> : <><Icon name="check" size={14} /> Confirmar saída</>}
            </button>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="file-text" size={16} color="var(--primary)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Saídas recentes</span>
          </div>
          {movs.length === 0 ? (
            <div className="empty-state">
              <Icon name="arrow-up" size={28} color="var(--text-3)" style={{ margin: '0 auto 8px' }} />
              <div className="empty-state-title">Sem saídas recentes</div>
            </div>
          ) : movs.map((m) => (
            <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {m.itens.map((mi: any) => mi.item.nome).join(', ')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--r-600)', fontWeight: 600, flexShrink: 0 }}>
                  −{m.itens.reduce((s: number, mi: any) => s + Number(mi.quantidade), 0)} un
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
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
          onCadastroManual={() => alert('Item não cadastrado. Cadastre primeiro antes de dar saída.')}
        />
      )}
    </div>
  );
}
