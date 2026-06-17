import { useEffect, useState } from 'react';
import api from '../api/client';
import ScannerLote from '../components/ScannerLote';
import Icon from '../components/Icon';
import { fmtData } from '../utils/format';

interface LinhaLoteSaida {
  loteId: string;
  codigoLote: string;
  itemNome: string;
  unidade: string;
  quantidade: number;
  disponivel: number;
  dataValidade?: string;
}

export default function Saidas() {
  const [destinoTipo, setDestinoTipo] = useState<'BENEFICIARIO' | 'SETOR' | 'EVENTO'>('BENEFICIARIO');
  const [destinoId, setDestinoId] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [beneficiarios, setBeneficiarios] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<LinhaLoteSaida[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [violacoes, setViolacoes] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/beneficiarios').then((r) => setBeneficiarios(r.data.filter((b: any) => b.ativo)));
    api.get('/setores').then((r) => setSetores(r.data));
    api.get('/eventos').then((r) => setEventos(r.data.filter((e: any) =>
      e.status === 'PLANEJADO' || e.status === 'EM_ANDAMENTO')));
    carregarMovs();
  }, []);

  function carregarMovs() {
    api.get('/movimentacoes', { params: { tipo: 'SAIDA' } }).then((r) => setMovs(r.data.slice(0, 6)));
  }

  function adicionarLote(lote: any) {
    // Se ja existe na lista, soma +1 (varios scans da mesma etiqueta = mais unidades)
    const existe = linhas.findIndex((l) => l.loteId === lote.id);
    if (existe >= 0) {
      const v = [...linhas];
      v[existe].quantidade = Math.min(v[existe].quantidade + 1, v[existe].disponivel);
      setLinhas(v);
      return;
    }
    setLinhas([...linhas, {
      loteId: lote.id,
      codigoLote: lote.codigoLote,
      itemNome: lote.item.nome,
      unidade: lote.item.unidadeMedida,
      quantidade: 1,
      disponivel: Number(lote.quantidadeAtual),
      dataValidade: lote.dataValidade,
    }]);
  }

  function atualizarQtd(idx: number, qtd: number) {
    const v = [...linhas];
    v[idx].quantidade = Math.min(Math.max(0, qtd), v[idx].disponivel);
    setLinhas(v);
  }
  function remover(idx: number) { setLinhas(linhas.filter((_, i) => i !== idx)); }

  async function salvar(confirmadoMinimo = false) {
    if (!destinoId) { setErro('Selecione um destino'); return; }
    if (!linhas.length) { setErro('Adicione ao menos um lote'); return; }
    setErro(''); setSalvando(true);
    try {
      const payload: any = {
        destinoSaida: destinoTipo,
        ...(destinoTipo === 'BENEFICIARIO' ? { beneficiarioId: destinoId }
          : destinoTipo === 'SETOR' ? { setorId: destinoId }
          : { eventoId: destinoId }),
        finalidade,
        confirmadoMinimo,
        lotes: linhas.map((l) => ({ loteId: l.loteId, quantidade: l.quantidade })),
      };
      const { data } = await api.post('/movimentacoes/saida', payload);
      if (data.requerConfirmacao) {
        setViolacoes(data.violacoes);
        return;
      }
      setLinhas([]); setDestinoId(''); setFinalidade(''); setViolacoes([]);
      carregarMovs();
      alert('Saída registrada com sucesso.');
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao registrar');
    } finally { setSalvando(false); }
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }} className="desktop-only">
        Saídas — Distribuição
      </h2>

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
                <option value="EVENTO">Evento</option>
              </select>
            </div>
            <div>
              <label className="label">
                {destinoTipo === 'BENEFICIARIO' ? 'Beneficiário'
                  : destinoTipo === 'SETOR' ? 'Setor'
                  : 'Evento'} *
              </label>
              <select className="select" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                <option value="">Selecione…</option>
                {destinoTipo === 'BENEFICIARIO'
                  ? beneficiarios.map((b: any) => <option key={b.id} value={b.id}>{b.nome}</option>)
                  : destinoTipo === 'SETOR'
                  ? setores.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)
                  : eventos.map((ev: any) => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
              </select>
              {destinoTipo === 'EVENTO' && eventos.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  Nenhum evento ativo. Crie ou inicie um evento primeiro.
                </div>
              )}
            </div>
          </div>

          <label className="label">Finalidade</label>
          <input className="input" value={finalidade}
            onChange={(e) => setFinalidade(e.target.value)}
            placeholder="Ex: Cesta básica mensal" style={{ marginBottom: 12 }} />

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Lotes a retirar (escaneie a etiqueta)
            </div>

            <button className="btn primary" onClick={() => setShowScanner(true)} style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
              <Icon name="barcode" size={14} /> Escanear etiqueta de lote
            </button>

            {linhas.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                Nenhum lote adicionado.<br />
                <span style={{ fontSize: 11 }}>
                  Clique no botão acima para ler a etiqueta de cada lote que sairá.
                </span>
              </div>
            )}

            {linhas.map((l, idx) => (
              <div key={idx} style={{
                background: 'var(--surface-2)', borderRadius: 6, padding: 10, marginBottom: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.itemNome}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                      {l.codigoLote} · disponível: {l.disponivel} {l.unidade}
                      {l.dataValidade ? ` · val: ${fmtData(l.dataValidade)}` : ''}
                    </div>
                  </div>
                  <input className="input" type="number" min="1" max={l.disponivel} step="any"
                    value={l.quantidade}
                    onChange={(e) => atualizarQtd(idx, parseFloat(e.target.value) || 0)}
                    style={{ width: 78 }} />
                  <button className="btn icon sm" onClick={() => remover(idx)} title="Remover">
                    <Icon name="x" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {violacoes.length > 0 && (
            <div style={{
              background: 'var(--r-50)', border: '1px solid var(--r-600)',
              borderRadius: 8, padding: 12, marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon name="alert-triangle" size={16} color="var(--r-600)" />
                <span style={{ fontWeight: 600, color: 'var(--r-600)', fontSize: 13 }}>
                  Esta saída deixa o estoque abaixo do mínimo
                </span>
              </div>
              {violacoes.map((v: any, i: number) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                  <strong>{v.item}</strong>: {v.saldoAtual} → <strong style={{ color: 'var(--r-600)' }}>{v.saldoResultante}</strong>
                  &nbsp;(mínimo: {v.estoqueMinimo})
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

        {/* Histórico */}
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
                  −{m.itens.reduce((s: number, mi: any) => s + Number(mi.quantidade), 0)}
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
        <ScannerLote
          onClose={() => setShowScanner(false)}
          onLoteEncontrado={(lote) => adicionarLote(lote)}
        />
      )}
    </div>
  );
}
