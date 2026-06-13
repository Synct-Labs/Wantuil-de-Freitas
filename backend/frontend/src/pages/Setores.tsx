import { useEffect, useState } from 'react';
import api from '../api/client';
import Icon from '../components/Icon';
import { excluirComConfirmacao } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';

export default function Setores() {
  const { podeFazer } = useAuth();
  const [setores, setSetores] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState({ nome: '', responsavel: '' });

  useEffect(() => { carregar(); }, []);
  async function carregar() { const { data } = await api.get('/setores'); setSetores(data); }

  function abrirNovo() { setEditando(null); setForm({ nome: '', responsavel: '' }); setShowForm(true); }
  function editar(s: any) { setEditando(s); setForm({ nome: s.nome, responsavel: s.responsavel || '' }); setShowForm(true); }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editando) await api.patch(`/setores/${editando.id}`, form);
      else await api.post('/setores', form);
      setShowForm(false); carregar();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao salvar');
    }
  }

  async function excluir(s: any) {
    const ok = await excluirComConfirmacao({
      url: `/setores/${s.id}`,
      pergunta: `Excluir o setor "${s.nome}"?\n\nObservação: se tiver itens vinculados, mova-os primeiro.`,
    });
    if (ok) carregar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }} className="desktop-only">Setores</h2>
        {podeFazer('setores.gerenciar') && (
          <button className="btn primary" onClick={abrirNovo}>
            <Icon name="plus" size={14} />Novo setor
          </button>
        )}
      </div>

      <div className="grid-2">
        {setores.map((s) => (
          <div key={s.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: 'var(--primary-bg)', color: 'var(--primary-dk)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="building" size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {s.responsavel || 'Sem responsável definido'}
                  </div>
                </div>
              </div>
              {podeFazer('setores.gerenciar') && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn icon sm" onClick={() => editar(s)} title="Editar"><Icon name="pencil" size={13} /></button>
                  <button className="btn icon sm" onClick={() => excluir(s)} title="Excluir"
                    style={{ color: 'var(--r-600)' }}><Icon name="trash" size={13} /></button>
                </div>
              )}
            </div>
            <div className="grid-2">
              <div style={{ background: 'var(--surface-2)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-2)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.04em' }}>Itens</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary-dk)' }}>{s._count?.itens || 0}</div>
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-2)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.04em' }}>Saídas</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{s._count?.movimentacoes || 0}</div>
              </div>
            </div>
          </div>
        ))}
        {setores.length === 0 && (
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="empty-state">
              <Icon name="building" size={36} color="var(--text-3)" style={{ margin: '0 auto 10px' }} />
              <div className="empty-state-title">Nenhum setor cadastrado</div>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={salvar}>
            <div className="modal-header">
              <span className="modal-title">{editando ? 'Editar setor' : 'Novo setor'}</span>
              <button type="button" className="btn icon sm ghost" onClick={() => setShowForm(false)}><Icon name="x" size={16} /></button>
            </div>
            <label className="label">Nome *</label>
            <input className="input" required value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })} style={{ marginBottom: 12 }} />
            <label className="label">Responsável</label>
            <input className="input" value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })} style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn primary"><Icon name="check" size={14} /> Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
