import { useEffect, useState } from 'react';
import api from '../api/client';
import ScannerLote from '../components/ScannerLote';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
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

interface LoteDisponivel {
  id: string;
  codigoLote: string;
  quantidadeAtual: number;
  dataValidade?: string;
  statusValidade?: string;
}

interface ItemComLotes {
  id: string;
  nome: string;
  codigoInterno: string;
  unidadeMedida: string;
  saldoAtual: number;
  lotes: LoteDisponivel[];
}

// Cor por status de validade
function corStatus(status?: string) {
  if (status === 'DESCARTE' || status === 'ADICIONAL') return 'var(--r-600)';
  if (status === 'PROXIMO') return 'var(--a-600)';
  return 'var(--text-2)';
}
function labelStatus(status?: string) {
  if (status === 'VIGENTE') return '';
  if (status === 'PROXIMO') return ' ⚠ próx. vencimento';
  if (status === 'ADICIONAL') return ' ⚠ vencido (adicional)';
  if (status === 'DESCARTE') return ' 🔴 descarte';
  return '';
}

export default function Saidas() {
  const toast = useToast();
  const [modoEntrada, setModoEntrada] = useState<'scanner' | 'manual'>('scanner');
  const [destinoTipo, setDestinoTipo] = useState<'SETOR' | 'EVENTO'>('SETOR');
  const [destinoId, setDestinoId] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [setores, setSetores] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<LinhaLoteSaida[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [violacoes, setViolacoes] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Modo manual
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemComLotes[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [itemSelecionadoId, setItemSelecionadoId] = useState('');
  const [loteSelecionadoId, setLoteSelecionadoId] = useState('');
  const [qtdManual, setQtdManual] = useState(1);

  useEffect(() => {
    api.get('/setores').then((r) => setSetores(r.data));
    api.get('/eventos').then((r) => setEventos(r.data.filter((e: any) =>
      e.status === 'PLANEJADO' || e.status === 'EM_ANDAMENTO')));
    carregarMovs();
  }, []);

  useEffect(() => {
    if (modoEntrada === 'manual' && itensDisponiveis.length === 0) {
      carregarItensComLotes();
    }
  }, [modoEntrada]);

  function carregarMovs() {
    api.get('/movimentacoes', { params: { tipo: 'SAIDA' } }).then((r) => setMovs(r.data.slice(0, 6)));
  }

  async function carregarItensComLotes() {
    setCarregandoItens(true);
    try {
      // Busca todos os lotes ativos com saldo > 0 e inclui item
      const [resItens, resLotes] = await Promise.all([
        api.get('/itens'),
        api.get('/lotes', { params: { ativo: 'true' } }),
      ]);
      const lotesPorItem: Record<string, LoteDisponivel[]> = {};
      for (const lote of resLotes.data) {
        if (Number(lote.quantidadeAtual) <= 0) continue;
        if (!lotesPorItem[lote.itemId]) lotesPorItem[lote.itemId] = [];
        lotesPorItem[lote.itemId].push({
          id: lote.id,
          codigoLote: lote.codigoLote,
          quantidadeAtual: Number(lote.quantidadeAtual),
          dataValidade: lote.dataValidade,
          statusValidade: lote.statusValidade,
        });
      }
      // Ordena lotes por validade (mais antigos primeiro — FEFO)
      for (const id in lotesPorItem) {
        lotesPorItem[id].sort((a, b) => {
          if (!a.dataValidade && !b.dataValidade) return 0;
          if (!a.dataValidade) return 1;
          if (!b.dataValidade) return -1;
          return new Date(a.dataValidade).getTime() - new Date(b.dataValidade).getTime();
        });
      }
      const itens: ItemComLotes[] = resItens.data
        .filter((i: any) => i.ativo && lotesPorItem[i.id]?.length > 0)
        .map((i: any) => ({
          id: i.id,
          nome: i.nome,
          codigoInterno: i.codigoInterno,
          unidadeMedida: i.unidadeMedida,
          saldoAtual: Number(i.saldoAtual),
          lotes: lotesPorItem[i.id] || [],
        }))
        .sort((a: ItemComLotes, b: ItemComLotes) => a.nome.localeCompare(b.nome, 'pt-BR'));
      setItensDisponiveis(itens);
    } finally {
      setCarregandoItens(false);
    }
  }

  // Item selecionado no modo manual
  const itemAtual = itensDisponiveis.find(i => i.id === itemSelecionadoId);
  const loteAtual = itemAtual?.lotes.find(l => l.id === loteSelecionadoId);

  function aoSelecionarItem(id: string) {
    setItemSelecionadoId(id);
    setLoteSelecionadoId('');
    setQtdManual(1);
    // Auto-seleciona o primeiro lote (FEFO)
    const item = itensDisponiveis.find(i => i.id === id);
    if (item?.lotes.length) {
      setLoteSelecionadoId(item.lotes[0].id);
    }
  }

  function adicionarManual() {
    if (!itemAtual || !loteAtual) return;
    const existe = linhas.findIndex(l => l.loteId === loteAtual.id);
    if (existe >= 0) {
      const v = [...linhas];
      v[existe].quantidade = Math.min(v[existe].quantidade + qtdManual, v[existe].disponivel);
      setLinhas(v);
    } else {
      setLinhas([...linhas, {
        loteId: loteAtual.id,
        codigoLote: loteAtual.codigoLote,
        itemNome: itemAtual.nome,
        unidade: itemAtual.unidadeMedida,
        quantidade: Math.min(qtdManual, loteAtual.quantidadeAtual),
        disponivel: loteAtual.quantidadeAtual,
        dataValidade: loteAtual.dataValidade,
      }]);
    }
    setItemSelecionadoId('');
    setLoteSelecionadoId('');
    setQtdManual(1);
  }

  function adicionarLote(lote: any) {
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
        ...(destinoTipo === 'SETOR' ? { setorId: destinoId } : { eventoId: destinoId }),
        finalidade,
        confirmadoMinimo,
        lotes: linhas.map((l) => ({ loteId: l.loteId, quantidade: l.quantidade })),
      };
      const { data } = await api.post('/movimentacoes/saida', payload);
      if (data.requerConfirmacao) {
        setViolacoes(data.violacoes);
        return;
      }
      const itens = linhas.slice(0, 2).map(l => `${l.quantidade} ${l.unidade} de ${l.itemNome}`).join(' + ');
      const sufixo = linhas.length > 2 ? ` + mais ${linhas.length - 2} item(s)` : '';
      const destinoNome = destinoTipo === 'SETOR'
        ? setores.find(s => s.id === destinoId)?.nome
        : eventos.find(e => e.id === destinoId)?.nome;
      toast.sucesso('Saída registrada', `${itens}${sufixo}${destinoNome ? ` → ${destinoNome}` : ''}`);
      setLinhas([]); setDestinoId(''); setFinalidade(''); setViolacoes([]);
      // Recarrega lotes disponíveis após saída
      if (modoEntrada === 'manual') await carregarItensComLotes();
      carregarMovs();
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
                <option value="SETOR">Setor interno</option>
                <option value="EVENTO">Evento</option>
              </select>
            </div>
            <div>
              <label className="label">{destinoTipo === 'SETOR' ? 'Setor' : 'Evento'} *</label>
              <select className="select" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                <option value="">Selecione…</option>
                {destinoTipo === 'SETOR'
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

          {/* Modo de adição: Scanner ou Manual */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 12,
            border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setModoEntrada('scanner')}
              style={{
                flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: modoEntrada === 'scanner' ? 'var(--primary)' : 'var(--surface-2)',
                color: modoEntrada === 'scanner' ? '#fff' : 'var(--text-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <Icon name="barcode" size={14} /> Scanner
            </button>
            <button
              onClick={() => setModoEntrada('manual')}
              style={{
                flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: modoEntrada === 'manual' ? 'var(--primary)' : 'var(--surface-2)',
                color: modoEntrada === 'manual' ? '#fff' : 'var(--text-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderLeft: '1px solid var(--border)',
              }}>
              <Icon name="list" size={14} /> Manual
            </button>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Lotes a retirar
            </div>

            {/* Modo Scanner */}
            {modoEntrada === 'scanner' && (
              <button className="btn primary" onClick={() => setShowScanner(true)}
                style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
                <Icon name="barcode" size={14} /> Escanear etiqueta de lote
              </button>
            )}

            {/* Modo Manual */}
            {modoEntrada === 'manual' && (
              <div style={{ marginBottom: 10 }}>
                {carregandoItens ? (
                  <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: 'var(--text-3)' }}>
                    <span className="spinner" /> Carregando itens…
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Selecionar item */}
                    <div>
                      <label className="label">Item</label>
                      <select className="select" value={itemSelecionadoId}
                        onChange={(e) => aoSelecionarItem(e.target.value)}>
                        <option value="">Selecione o item…</option>
                        {itensDisponiveis.map(i => (
                          <option key={i.id} value={i.id}>
                            {i.nome} — saldo: {i.saldoAtual} {i.unidadeMedida}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selecionar lote/validade */}
                    {itemAtual && itemAtual.lotes.length > 0 && (
                      <div>
                        <label className="label">
                          Validade / Lote
                          <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 6, fontSize: 10 }}>
                            (ordem FEFO — mais antigo primeiro)
                          </span>
                        </label>
                        <select className="select" value={loteSelecionadoId}
                          onChange={(e) => setLoteSelecionadoId(e.target.value)}>
                          <option value="">Selecione o lote…</option>
                          {itemAtual.lotes.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.dataValidade ? fmtData(l.dataValidade) : 'Sem validade'}
                              {labelStatus(l.statusValidade)}
                              {' '}— {l.quantidadeAtual} {itemAtual.unidadeMedida}
                              {' '}({l.codigoLote})
                            </option>
                          ))}
                        </select>
                        {loteAtual && (
                          <div style={{ fontSize: 11, marginTop: 4, color: corStatus(loteAtual.statusValidade) }}>
                            Disponível neste lote: <strong>{loteAtual.quantidadeAtual} {itemAtual.unidadeMedida}</strong>
                            {loteAtual.dataValidade && ` · Validade: ${fmtData(loteAtual.dataValidade)}`}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quantidade */}
                    {loteAtual && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label className="label">Quantidade</label>
                          <input className="input" type="number" min="1"
                            max={loteAtual.quantidadeAtual} step="any"
                            value={qtdManual}
                            onChange={(e) => setQtdManual(parseFloat(e.target.value) || 1)} />
                        </div>
                        <button className="btn primary" onClick={adicionarManual}
                          disabled={!loteAtual || qtdManual <= 0}>
                          <Icon name="plus" size={14} /> Adicionar
                        </button>
                      </div>
                    )}

                    {itensDisponiveis.length === 0 && !carregandoItens && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
                        Nenhum item com estoque disponível.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {linhas.length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                Nenhum lote adicionado.
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
          onLoteEncontrado={(lote) => { adicionarLote(lote); setShowScanner(false); }}
        />
      )}
    </div>
  );
}
