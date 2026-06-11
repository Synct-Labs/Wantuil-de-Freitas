import { useEffect, useState } from 'react';
import api from '../api/client';
import { fmtCpfCnpj, fmtData } from '../utils/format';

export default function Doadores() {
  const [lista, setLista] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [busca]);
  function carregar() { api.get('/doadores', { params: { busca } }).then((r) => setLista(r.data)); }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Doadores</h2>
        <button className="btn primary" onClick={() => { setEditando(null); setShowForm(true); }}>+ Novo doador</button>
      </div>

      <input className="input" placeholder="Buscar por nome ou CPF/CNPJ..." value={busca}
        onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 320, marginBottom: 16 }} />

      <div className="card">
        <table className="table">
          <thead><tr><th>Nome</th><th>Tipo</th><th>CPF/CNPJ</th><th>Telefone</th><th>Doações</th><th></th></tr></thead>
          <tbody>
            {lista.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 500 }}>{d.nome}</td>
                <td><span className={`pill ${d.tipo === 'PF' ? 'green' : 'blue'}`}>{d.tipo}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtCpfCnpj(d.cpfCnpj)}</td>
                <td style={{ fontSize: 12 }}>{d.telefone || '—'}</td>
                <td style={{ fontWeight: 500, color: 'var(--g600)' }}>{d._count?.movimentacoes || 0}</td>
                <td><button className="btn sm" onClick={() => { setEditando(d); setShowForm(true); }}>✏️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>Nenhum doador encontrado.</div>}
      </div>

      {showForm && <FormDoador doador={editando} onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); carregar(); }} />}
    </div>
  );
}

function FormDoador({ doador, onClose, onSave }: any) {
  const [form, setForm] = useState({
    tipo: doador?.tipo || 'PF',
    nome: doador?.nome || '',
    cpfCnpj: doador?.cpfCnpj || '',
    telefone: doador?.telefone || '',
    email: doador?.email || '',
    endereco: doador?.endereco || '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      if (doador) await api.patch(`/doadores/${doador.id}`, form);
      else await api.post('/doadores', form);
      onSave();
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={salvar}>
        <strong>{doador ? 'Editar doador' : 'Novo doador'}</strong>
        <label className="label" style={{ marginTop: 14 }}>Tipo</label>
        <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as any })} disabled={!!doador}>
          <option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option>
        </select>
        <label className="label" style={{ marginTop: 10 }}>Nome / Razão Social *</label>
        <input className="input" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <label className="label" style={{ marginTop: 10 }}>{form.tipo === 'PF' ? 'CPF' : 'CNPJ'} *</label>
        <input className="input" required disabled={!!doador} value={form.cpfCnpj} onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })} />
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <label className="label" style={{ marginTop: 10 }}>Endereço</label>
        <textarea className="input" rows={2} value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} style={{ marginBottom: 14 }} />
        {erro && <div style={{ color: 'var(--r600)', fontSize: 12, marginBottom: 10 }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" type="submit" disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
