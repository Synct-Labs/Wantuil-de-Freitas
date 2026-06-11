import { useEffect, useState } from 'react';
import api from '../api/client';
import { fmtCpfCnpj, fmtData } from '../utils/format';

export default function Beneficiarios() {
  const [lista, setLista] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [busca]);
  function carregar() { api.get('/beneficiarios', { params: { busca } }).then((r) => setLista(r.data)); }

  async function alternarStatus(b: any) {
    await api.patch(`/beneficiarios/${b.id}`, { ativo: !b.ativo });
    carregar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Beneficiários</h2>
        <button className="btn primary" onClick={() => { setEditando(null); setShowForm(true); }}>+ Novo beneficiário</button>
      </div>

      <input className="input" placeholder="Buscar por nome ou CPF..." value={busca}
        onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 320, marginBottom: 16 }} />

      <div className="card">
        <table className="table">
          <thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Bairro</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {lista.map((b) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 500 }}>{b.nome}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtCpfCnpj(b.cpf)}</td>
                <td style={{ fontSize: 12 }}>{b.telefone || '—'}</td>
                <td>{b.bairro || '—'}</td>
                <td><span className={`pill ${b.ativo ? 'green' : 'red'}`}>{b.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                  <button className="btn sm" onClick={() => { setEditando(b); setShowForm(true); }}>✏️</button>
                  <button className="btn sm" onClick={() => alternarStatus(b)} style={{ marginLeft: 4 }}>
                    {b.ativo ? '🚫' : '✓'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>Nenhum beneficiário encontrado.</div>}
      </div>

      {showForm && <FormBeneficiario beneficiario={editando} onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); carregar(); }} />}
    </div>
  );
}

function FormBeneficiario({ beneficiario, onClose, onSave }: any) {
  const [form, setForm] = useState({
    nome: beneficiario?.nome || '',
    cpf: beneficiario?.cpf || '',
    dataNascimento: beneficiario?.dataNascimento?.split('T')[0] || '',
    telefone: beneficiario?.telefone || '',
    endereco: beneficiario?.endereco || '',
    bairro: beneficiario?.bairro || '',
    situacaoFamiliar: beneficiario?.situacaoFamiliar || '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      if (beneficiario) await api.patch(`/beneficiarios/${beneficiario.id}`, form);
      else await api.post('/beneficiarios', form);
      onSave();
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={salvar}>
        <strong>{beneficiario ? 'Editar beneficiário' : 'Novo beneficiário'}</strong>
        <label className="label" style={{ marginTop: 14 }}>Nome completo *</label>
        <input className="input" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <label className="label">CPF *</label>
            <input className="input" required disabled={!!beneficiario} value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
          </div>
          <div>
            <label className="label">Data nascimento</label>
            <input className="input" type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div>
            <label className="label">Bairro</label>
            <input className="input" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
          </div>
        </div>
        <label className="label" style={{ marginTop: 10 }}>Endereço</label>
        <input className="input" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
        <label className="label" style={{ marginTop: 10 }}>Situação familiar</label>
        <textarea className="input" rows={2} value={form.situacaoFamiliar}
          onChange={(e) => setForm({ ...form, situacaoFamiliar: e.target.value })} style={{ marginBottom: 14 }} />
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
