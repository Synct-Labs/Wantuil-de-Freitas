import { useEffect, useState } from 'react';
import api from '../api/client';
import Icon from '../components/Icon';
import { fmtCpfCnpj } from '../utils/format';
import { excluirComConfirmacao } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';

export default function Beneficiarios() {
  const { podeFazer } = useAuth();
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

  async function excluir(b: any) {
    const ok = await excluirComConfirmacao({
      url: `/beneficiarios/${b.id}`,
      pergunta: `Excluir "${b.nome}"?\n\nObservação: se já recebeu doações, será desativado em vez de excluído.`,
    });
    if (ok) carregar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }} className="desktop-only">Beneficiários</h2>
        {podeFazer('benef.criar') && (
          <button className="btn primary" onClick={() => { setEditando(null); setShowForm(true); }}>
            <Icon name="plus" size={14} />Novo beneficiário
          </button>
        )}
      </div>

      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 16 }}>
        <Icon name="search" size={14} color="var(--text-3)"
          style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
        <input className="input" placeholder="Buscar por nome ou CPF"
          value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 34 }} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table table-responsive">
          <thead>
            <tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Bairro</th><th>Status</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
          </thead>
          <tbody>
            {lista.map((b) => (
              <tr key={b.id}>
                <td data-label="Nome" style={{ fontWeight: 600 }}>{b.nome}</td>
                <td data-label="CPF" style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'monospace' }}>{fmtCpfCnpj(b.cpf)}</td>
                <td data-label="Telefone" style={{ fontSize: 12 }}>{b.telefone || '—'}</td>
                <td data-label="Bairro">{b.bairro || '—'}</td>
                <td data-label="Status">
                  <span className={`pill ${b.ativo ? 'green' : 'red'}`}>{b.ativo ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td data-actions style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    {podeFazer('benef.editar') && (
                      <button className="btn icon sm" onClick={() => { setEditando(b); setShowForm(true); }} title="Editar">
                        <Icon name="pencil" size={13} />
                      </button>
                    )}
                    {podeFazer('benef.editar') && (
                      <button className="btn icon sm" onClick={() => alternarStatus(b)} title={b.ativo ? 'Desativar' : 'Reativar'}>
                        <Icon name={b.ativo ? 'eye-off' : 'eye'} size={13} />
                      </button>
                    )}
                    {podeFazer('benef.excluir') && (
                      <button className="btn icon sm" onClick={() => excluir(b)} title="Excluir"
                        style={{ color: 'var(--r-600)' }}>
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && (
          <div className="empty-state">
            <Icon name="users" size={36} color="var(--text-3)" style={{ margin: '0 auto 10px' }} />
            <div className="empty-state-title">Nenhum beneficiário cadastrado</div>
          </div>
        )}
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
        <div className="modal-header">
          <span className="modal-title">{beneficiario ? 'Editar beneficiário' : 'Novo beneficiário'}</span>
          <button type="button" className="btn icon sm ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <label className="label">Nome completo *</label>
        <input className="input" required value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })} style={{ marginBottom: 12 }} />
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div>
            <label className="label">CPF *</label>
            <input className="input" required disabled={!!beneficiario} value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              style={{ fontFamily: 'monospace' }} />
          </div>
          <div>
            <label className="label">Data nascimento</label>
            <input className="input" type="date" value={form.dataNascimento}
              onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
          </div>
        </div>
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div>
            <label className="label">Bairro</label>
            <input className="input" value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
          </div>
        </div>
        <label className="label">Endereço</label>
        <input className="input" value={form.endereco}
          onChange={(e) => setForm({ ...form, endereco: e.target.value })} style={{ marginBottom: 12 }} />
        <label className="label">Situação familiar</label>
        <textarea className="input" rows={2} value={form.situacaoFamiliar}
          onChange={(e) => setForm({ ...form, situacaoFamiliar: e.target.value })}
          style={{ marginBottom: 16, resize: 'vertical' }} />
        {erro && (
          <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--r-50)',
            color: 'var(--r-600)', fontSize: 12, marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-circle" size={14} />{erro}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={salvando}>
            {salvando ? <><span className="spinner" /> Salvando</> : <><Icon name="check" size={14} /> Salvar</>}
          </button>
        </div>
      </form>
    </div>
  );
}
