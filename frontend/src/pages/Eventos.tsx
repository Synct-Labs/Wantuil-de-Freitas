import { useEffect, useState } from 'react';
import api from '../api/client';
import Icon, { IconName } from '../components/Icon';
import ScannerLote from '../components/ScannerLote';
import { fmtData } from '../utils/format';
import { useAuth } from '../context/AuthContext';

interface Evento {
  id: string;
  nome: string;
  descricao?: string;
  dataInicio: string;
  dataFim?: string;
  responsavel?: string;
  status: 'PLANEJADO' | 'EM_ANDAMENTO' | 'FINALIZADO' | 'CANCELADO';
  observacao?: string;
  reservasAtivas: number;
  saidasRealizadas: number;
}

const STATUS_COR: Record<string, { bg: string; texto: string; label: string }> = {
  PLANEJADO:    { bg: 'var(--surface-2)', texto: 'var(--text-2)', label: 'Planejado' },
  EM_ANDAMENTO: { bg: 'var(--green-bg)',  texto: 'var(--green)',  label: 'Em andamento' },
  FINALIZADO:   { bg: '#E1E8F4',          texto: 'var(--wf-azul-dk)', label: 'Finalizado' },
  CANCELADO:    { bg: 'var(--r-50)',      texto: 'var(--r-600)',  label: 'Cancelado' },
};

export default function Eventos() {
  const { podeFazer } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [verDetalhe, setVerDetalhe] = useState<string | null>(null);

  useEffect(() => { carregar(); }, [filtroStatus]);

  function carregar() {
    api.get('/eventos', { params: { status: filtroStatus || undefined } })
      .then((r) => setEventos(r.data));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }} className="desktop-only">Eventos</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Todos os status</option>
            <option value="PLANEJADO">Planejados</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="FINALIZADO">Finalizados</option>
            <option value="CANCELADO">Cancelados</option>
          </select>
          {podeFazer('eventos.criar') && (
            <button className="btn primary" onClick={() => { setEditando(null); setShowForm(true); }}>
              <Icon name="plus" size={14} /> Novo evento
            </button>
          )}
        </div>
      </div>

      {eventos.length === 0 ? (
        <div className="empty-state">
          <Icon name="calendar" size={36} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
          <div className="empty-state-title">Nenhum evento cadastrado</div>
          <div className="empty-state-desc">Crie um evento para reservar estoque e organizar as distribuições.</div>
        </div>
      ) : (
        <div className="grid-2">
          {eventos.map((ev) => {
            const cor = STATUS_COR[ev.status];
            return (
              <div key={ev.id} className="card" style={{ cursor: 'pointer' }}
                onClick={() => setVerDetalhe(ev.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{ev.nome}</div>
                    {ev.descricao && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ev.descricao}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                    background: cor.bg, color: cor.texto, whiteSpace: 'nowrap',
                    textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {cor.label}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="calendar" size={11} /> {fmtData(ev.dataInicio)}
                    {ev.dataFim && ev.dataFim !== ev.dataInicio && <> a {fmtData(ev.dataFim)}</>}
                  </div>
                  {ev.responsavel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="user" size={11} /> {ev.responsavel}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 10,
                  borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-2)' }}>
                  <div><strong style={{ color: 'var(--primary-dk)' }}>{ev.reservasAtivas}</strong> reserva(s)</div>
                  <div><strong style={{ color: 'var(--primary-dk)' }}>{ev.saidasRealizadas}</strong> saída(s)</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <FormEvento evento={editando}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); carregar(); }} />
      )}

      {verDetalhe && (
        <DetalheEvento eventoId={verDetalhe}
          onClose={() => { setVerDetalhe(null); carregar(); }}
          onEditar={(ev) => { setEditando(ev); setVerDetalhe(null); setShowForm(true); }} />
      )}
    </div>
  );
}

// ─── Formulario novo/editar ─────────────────────────────────────────
function FormEvento({ evento, onClose, onSave }: any) {
  const [form, setForm] = useState({
    nome: evento?.nome || '',
    descricao: evento?.descricao || '',
    dataInicio: evento?.dataInicio ? evento.dataInicio.slice(0, 10) : new Date().toISOString().slice(0, 10),
    dataFim: evento?.dataFim ? evento.dataFim.slice(0, 10) : '',
    responsavel: evento?.responsavel || '',
    observacao: evento?.observacao || '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setSalvando(true);
    try {
      const payload = {
        ...form, descricao: form.descricao || undefined, dataFim: form.dataFim || undefined,
        responsavel: form.responsavel || undefined, observacao: form.observacao || undefined,
      };
      if (evento) await api.patch(`/eventos/${evento.id}`, payload);
      else await api.post('/eventos', payload);
      onSave();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={salvar} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar" size={18} color="var(--primary)" />
            <span className="modal-title">{evento ? 'Editar evento' : 'Novo evento'}</span>
          </div>
          <button type="button" className="btn icon sm ghost" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>

        <label className="label">Nome *</label>
        <input className="input" required value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Ex: Distribuição de Natal 2026" style={{ marginBottom: 12 }} />

        <label className="label">Descrição</label>
        <textarea className="input" rows={2} value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          style={{ marginBottom: 12, resize: 'vertical' }} />

        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div>
            <label className="label">Data início *</label>
            <input className="input" type="date" required value={form.dataInicio}
              onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} />
          </div>
          <div>
            <label className="label">Data fim (opcional)</label>
            <input className="input" type="date" value={form.dataFim}
              onChange={(e) => setForm({ ...form, dataFim: e.target.value })} />
          </div>
        </div>

        <label className="label">Responsável</label>
        <input className="input" value={form.responsavel}
          onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
          style={{ marginBottom: 12 }} />

        <label className="label">Observações</label>
        <textarea className="input" rows={2} value={form.observacao}
          onChange={(e) => setForm({ ...form, observacao: e.target.value })}
          style={{ marginBottom: 14, resize: 'vertical' }} />

        {erro && (
          <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--r-50)',
            color: 'var(--r-600)', fontSize: 12, marginBottom: 12 }}>{erro}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={salvando}>
            {salvando ? <><span className="spinner" />Salvando…</> : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal de detalhe (reservas + saidas + relatorio) ─────────────────
function DetalheEvento({ eventoId, onClose, onEditar }: any) {
  const { podeFazer } = useAuth();
  const [evento, setEvento] = useState<any>(null);
  const [showAddReserva, setShowAddReserva] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => { carregar(); }, [eventoId]);

  function carregar() {
    api.get(`/eventos/${eventoId}`).then((r) => setEvento(r.data));
  }

  async function acao(endpoint: string, mensagem: string) {
    if (!confirm(mensagem)) return;
    setCarregando(true);
    try {
      await api.post(`/eventos/${eventoId}/${endpoint}`);
      carregar();
    } catch (e: any) { alert(e.response?.data?.message || 'Erro'); }
    finally { setCarregando(false); }
  }

  async function removerReserva(reservaId: string) {
    if (!confirm('Remover esta reserva e liberar o saldo do lote?')) return;
    try {
      await api.delete(`/eventos/${eventoId}/reservas/${reservaId}`);
      carregar();
    } catch (e: any) { alert(e.response?.data?.message || 'Erro ao remover'); }
  }

  function baixarPdf() {
    const token = localStorage.getItem('token');
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/eventos/${eventoId}/relatorio/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.blob()).then((b) => window.open(URL.createObjectURL(b), '_blank'));
  }

  if (!evento) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 700 }}><span className="spinner" /></div>
      </div>
    );
  }

  const cor = STATUS_COR[evento.status];
  const podeOperar = evento.status === 'PLANEJADO' || evento.status === 'EM_ANDAMENTO';
  const totalReservado = evento.reservas.reduce((s: number, r: any) => s + Number(r.quantidadeReservada), 0);
  const totalConsumido = evento.reservas.reduce((s: number, r: any) => s + Number(r.quantidadeConsumida), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, flex: 1 }}>
            <Icon name="calendar" size={18} color="var(--primary)" style={{ marginTop: 2 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="modal-title">{evento.nome}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                  background: cor.bg, color: cor.texto, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {cor.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                  {fmtData(evento.dataInicio)}
                  {evento.dataFim && evento.dataFim !== evento.dataInicio && ` a ${fmtData(evento.dataFim)}`}
                  {evento.responsavel && ` · ${evento.responsavel}`}
                </span>
              </div>
            </div>
          </div>
          <button className="btn icon sm ghost" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Ações de status */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {evento.status === 'PLANEJADO' && podeFazer('eventos.criar') && (
            <button className="btn sm primary" onClick={() => acao('iniciar', 'Iniciar este evento?')}>
              <Icon name="play" size={12} /> Iniciar
            </button>
          )}
          {podeOperar && podeFazer('eventos.criar') && (
            <>
              <button className="btn sm" onClick={() => acao('finalizar',
                'Finalizar o evento? Reservas não consumidas serão liberadas e voltam ao estoque.')}>
                <Icon name="check" size={12} /> Finalizar
              </button>
              <button className="btn sm danger" onClick={() => acao('cancelar', 'Cancelar este evento?')}>
                <Icon name="x" size={12} /> Cancelar
              </button>
              <button className="btn sm" onClick={() => onEditar(evento)}>
                <Icon name="pencil" size={12} /> Editar
              </button>
            </>
          )}
          <button className="btn sm primary" onClick={baixarPdf} style={{ marginLeft: 'auto' }}>
            <Icon name="file-text" size={12} /> Relatório PDF
          </button>
        </div>

        {evento.descricao && (
          <div className="card" style={{ marginBottom: 14, padding: 10, background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{evento.descricao}</div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid-3" style={{ marginBottom: 14 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase' }}>Reservas ativas</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{evento.reservas.filter((r: any) => r.ativa).length}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase' }}>Reservado</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{totalReservado.toFixed(0)}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase' }}>Consumido</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{totalConsumido.toFixed(0)}</div>
          </div>
        </div>

        {/* Reservas */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Reservas</span>
          {podeOperar && podeFazer('eventos.criar') && (
            <button className="btn sm primary" onClick={() => setShowAddReserva(true)}>
              <Icon name="plus" size={12} /> Adicionar reserva
            </button>
          )}
        </div>
        {evento.reservas.length === 0 ? (
          <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: 'var(--text-3)',
            border: '1px dashed var(--border-2)', borderRadius: 8, marginBottom: 14 }}>
            Nenhuma reserva. Escaneie a etiqueta de um lote para reservar.
          </div>
        ) : (
          <div className="table-responsive" style={{ marginBottom: 14 }}>
            <table className="table">
              <thead><tr><th>Lote</th><th>Item</th><th>Reservado</th><th>Consumido</th><th>Restante</th>{podeOperar && <th></th>}</tr></thead>
              <tbody>
                {evento.reservas.map((r: any) => (
                  <tr key={r.id} style={{ opacity: r.ativa ? 1 : 0.5 }}>
                    <td data-label="Lote" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.lote.codigoLote}</td>
                    <td data-label="Item"><strong>{r.lote.item.nome}</strong></td>
                    <td data-label="Reservado">{r.quantidadeReservada} {r.lote.item.unidadeMedida}</td>
                    <td data-label="Consumido">{r.quantidadeConsumida} {r.lote.item.unidadeMedida}</td>
                    <td data-label="Restante">{r.quantidadeRestante} {r.lote.item.unidadeMedida}</td>
                    {podeOperar && (
                      <td data-actions style={{ textAlign: 'right' }}>
                        {r.ativa && (
                          <button className="btn icon sm" onClick={() => removerReserva(r.id)} title="Remover reserva"
                            style={{ color: 'var(--r-600)' }}>
                            <Icon name="trash" size={12} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Saídas */}
        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Saídas realizadas</div>
        {evento.movimentacoes.length === 0 ? (
          <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: 'var(--text-3)',
            border: '1px dashed var(--border-2)', borderRadius: 8 }}>
            Nenhuma saída ainda. Use a tela <strong>Saídas</strong> e selecione "Evento" como destino.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>Data</th><th>Item</th><th>Lote</th><th>Quantidade</th><th>Responsável</th></tr></thead>
              <tbody>
                {evento.movimentacoes.flatMap((m: any) => m.itens.map((mi: any, idx: number) => (
                  <tr key={m.id + '-' + idx}>
                    <td data-label="Data">{fmtData(m.dataMovimentacao)}</td>
                    <td data-label="Item"><strong>{mi.item.nome}</strong></td>
                    <td data-label="Lote" style={{ fontFamily: 'monospace', fontSize: 11 }}>{mi.lote?.codigoLote || '—'}</td>
                    <td data-label="Quantidade">{mi.quantidade} {mi.item.unidadeMedida}</td>
                    <td data-label="Responsável" style={{ fontSize: 12, color: 'var(--text-2)' }}>{m.usuario.nome}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}

        {showAddReserva && (
          <AddReservaScanner eventoId={eventoId} onClose={() => setShowAddReserva(false)}
            onSucesso={() => { setShowAddReserva(false); carregar(); }} />
        )}
      </div>
    </div>
  );
}

// ─── Modal: escanear etiqueta + escolher quantidade pra reservar ───────
function AddReservaScanner({ eventoId, onClose, onSucesso }: any) {
  const [showScanner, setShowScanner] = useState(true);
  const [lote, setLote] = useState<any>(null);
  const [qtd, setQtd] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function reservar() {
    setSalvando(true); setErro('');
    try {
      await api.post(`/eventos/${eventoId}/reservas`, { loteId: lote.id, quantidade: qtd });
      onSucesso();
    } catch (e: any) { setErro(e.response?.data?.message || 'Erro ao reservar'); }
    finally { setSalvando(false); }
  }

  if (showScanner) {
    return <ScannerLote
      onClose={onClose}
      onLoteEncontrado={(l: any) => { setLote(l); setShowScanner(false); }} />;
  }

  if (!lote) return null;

  const disponivel = Math.max(0, Number(lote.quantidadeAtual) - (lote.reservadoTotal || 0));

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="bookmark" size={18} color="var(--primary)" />
            <span className="modal-title">Reservar para o evento</span>
          </div>
          <button className="btn icon sm ghost" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ background: 'var(--primary-bg)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{lote.item.nome}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'monospace', marginBottom: 6 }}>{lote.codigoLote}</div>
          <div style={{ fontSize: 12 }}>
            Saldo total: {lote.quantidadeAtual} {lote.item.unidadeMedida}
            {(lote.reservadoTotal || 0) > 0 && (
              <> · Já reservado: {lote.reservadoTotal} (disponível: <strong>{disponivel}</strong>)</>
            )}
          </div>
        </div>

        <label className="label">Quantidade a reservar ({lote.item.unidadeMedida})</label>
        <input className="input" type="number" min="1" max={disponivel} step="any" value={qtd}
          onChange={(e) => setQtd(parseFloat(e.target.value) || 0)}
          style={{ marginBottom: 14 }} />

        {erro && (
          <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--r-50)',
            color: 'var(--r-600)', fontSize: 12, marginBottom: 12 }}>{erro}</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowScanner(true)}>Outro lote</button>
          <button className="btn primary" onClick={reservar} disabled={salvando || qtd <= 0 || qtd > disponivel}
            style={{ flex: 1, justifyContent: 'center' }}>
            {salvando ? <><span className="spinner" /> Reservando</> : <><Icon name="check" size={13} /> Confirmar reserva</>}
          </button>
        </div>
      </div>
    </div>
  );
}
