import { useEffect, useState } from 'react';
import api from '../api/client';
import { excluirComConfirmacao } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';

export default function Setores() {
  const { podeFazer } = useAuth();
  const [setores, setSetores] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState({ nome: '', responsavel: '' });

  useEffect(() => { carregar(); }, []);
  async function carregar() {
    const { data } = await api.get('/setores');
    setSetores(data);
  }

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
      pergunta: `Excluir o setor "${s.nome}"?\n\nObservação: se tiver itens vinculados, mova-os primeiro. Se tiver histórico, será desativado.`,
    });
    if (ok) carregar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Setores</h2>
        {podeFazer('setores.gerenciar') && (
          <button className="btn primary" onClick={abrirNovo}>+ Novo setor</button>
        )}
      </div>

      <div className="grid2">
        {setores.map((s) => (
          <div key={s.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--g100)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏢</div>
                <div>
                  <div style={{ fontWeight: 500 }}>{s.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{s.responsavel || 'Sem responsável'}</div>
                </div>
              </div>
              {podeFazer('setores.gerenciar') && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn sm" onClick={() => editar(s)} title="Editar">✏️</button>
                  <button className="btn sm" style={{ color: 'var(--r600)' }} onClick={() => excluir(s)} title="Excluir">🗑️</button>
                </div>
              )}
            </div>
            <div className="grid2">
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>Itens</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--g600)' }}>{s._count?.itens || 0}</div>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>Saídas</div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{s._count?.movimentacoes || 0}</div>
              </div>
            </div>
          </div>
        ))}
        {setores.length === 0 && <div style={{ gridColumn: 'span 2', padding: 24, textAlign: 'center', color: 'var(--text2)' }}>Nenhum setor cadastrado.</div>}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={salvar}>
            <strong>{editando ? 'Editar setor' : 'Novo setor'}</strong>
            <label className="label" style={{ marginTop: 14 }}>Nome *</label>
            <input className="input" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <label className="label" style={{ marginTop: 10 }}>Responsável</label>
            <input className="input" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" type="submit" style={{ flex: 1, justifyContent: 'center' }}>Salvar</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
