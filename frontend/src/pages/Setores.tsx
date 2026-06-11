import { useEffect, useState } from 'react';
import api from '../api/client';
import { STATUS_VALIDADE } from '../utils/format';

export default function Setores() {
  const [setores, setSetores] = useState<any[]>([]);
  const [detalhes, setDetalhes] = useState<Record<string, any>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', responsavel: '' });

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    const { data } = await api.get('/setores');
    setSetores(data);
    for (const s of data) {
      const { data: det } = await api.get(`/setores/${s.id}`);
      setDetalhes((d) => ({ ...d, [s.id]: det }));
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/setores', form);
    setShowForm(false); setForm({ nome: '', responsavel: '' });
    carregar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Setores</h2>
        <button className="btn primary" onClick={() => setShowForm(true)}>+ Novo setor</button>
      </div>

      <div className="grid2">
        {setores.map((s) => {
          const det = detalhes[s.id];
          return (
            <div key={s.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--g100)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏢</div>
                <div>
                  <div style={{ fontWeight: 500 }}>{s.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{s.responsavel || 'Sem responsável'}</div>
                </div>
              </div>
              <div className="grid2" style={{ marginBottom: 12 }}>
                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Itens</div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--g600)' }}>{s._count?.itens || 0}</div>
                </div>
                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Saídas</div>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>{s._count?.movimentacoes || 0}</div>
                </div>
              </div>
              {det?.itens?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Itens neste setor</div>
                  {det.itens.slice(0, 5).map((it: any) => (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between',
                      fontSize: 12, padding: '4px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <span>{it.nome}</span>
                      <span style={{ color: 'var(--text2)' }}>{it.saldoAtual} {it.unidadeMedida}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={criar}>
            <strong>Novo setor</strong>
            <label className="label" style={{ marginTop: 14 }}>Nome *</label>
            <input className="input" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <label className="label" style={{ marginTop: 10 }}>Responsável</label>
            <input className="input" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" type="submit" style={{ flex: 1, justifyContent: 'center' }}>Criar</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
