import { useEffect, useState } from 'react';
import api from '../api/client';
import Icon from '../components/Icon';
import { fmtCpfCnpj } from '../utils/format';
import { excluirComConfirmacao } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';

export default function Doadores() {
  const { podeFazer } = useAuth();
  const [lista, setLista] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [busca]);
  function carregar() { api.get('/doadores', { params: { busca } }).then((r) => setLista(r.data)); }

  async function excluir(d: any) {
    const ok = await excluirComConfirmacao({
      url: `/doadores/${d.id}`,
      pergunta: `Excluir "${d.nome}"?\n\nObservação: se tiver doações registradas, será desativado em vez de excluído.`,
    });
    if (ok) carregar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }} className="desktop-only">Doadores</h2>
        {podeFazer('doadores.criar') && (
          <button className="btn primary" onClick={() => { setEditando(null); setShowForm(true); }}>
            <Icon name="plus" size={14} />Novo doador
          </button>
        )}
      </div>

      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 16 }}>
        <Icon name="search" size={14} color="var(--text-3)"
          style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
        <input className="input" placeholder="Buscar por nome ou CPF/CNPJ"
          value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingLeft: 34 }} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table table-responsive">
          <thead>
            <tr><th>Nome</th><th>Tipo</th><th>CPF/CNPJ</th><th>Telefone</th><th>Doações</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
          </thead>
          <tbody>
            {lista.map((d) => (
              <tr key={d.id}>
                <td data-label="Nome" style={{ fontWeight: 600 }}>{d.nome}</td>
                <td data-label="Tipo">
                  <span className={`pill ${d.tipo === 'PF' ? 'green' : 'blue'}`}>{d.tipo}</span>
                </td>
                <td data-label="Documento" style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'monospace' }}>
                  {fmtCpfCnpj(d.cpfCnpj)}
                </td>
                <td data-label="Telefone" style={{ fontSize: 12 }}>{d.telefone || '—'}</td>
                <td data-label="Doações" style={{ fontWeight: 600, color: 'var(--primary-dk)' }}>{d._count?.movimentacoes || 0}</td>
                <td data-actions style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    {podeFazer('doadores.editar') && (
                      <button className="btn icon sm" onClick={() => { setEditando(d); setShowForm(true); }} title="Editar">
                        <Icon name="pencil" size={13} />
                      </button>
                    )}
                    {podeFazer('doadores.excluir') && (
                      <button className="btn icon sm" onClick={() => excluir(d)} title="Excluir"
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
            <Icon name="heart" size={36} color="var(--text-3)" style={{ margin: '0 auto 10px' }} />
            <div className="empty-state-title">Nenhum doador cadastrado</div>
          </div>
        )}
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
        <div className="modal-header">
          <span className="modal-title">{doador ? 'Editar doador' : 'Novo doador'}</span>
          <button type="button" className="btn icon sm ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <label className="label">Tipo</label>
        <select className="select" value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}
          disabled={!!doador} style={{ marginBottom: 12 }}>
          <option value="PF">Pessoa Física</option>
          <option value="PJ">Pessoa Jurídica</option>
        </select>
        <label className="label">Nome / Razão Social *</label>
        <input className="input" required value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })} style={{ marginBottom: 12 }} />
        <label className="label">{form.tipo === 'PF' ? 'CPF' : 'CNPJ'} *</label>
        <input className="input" required disabled={!!doador} value={form.cpfCnpj}
          onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })}
          style={{ marginBottom: 12, fontFamily: 'monospace' }} />
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <label className="label">Endereço</label>
        <textarea className="input" rows={2} value={form.endereco}
          onChange={(e) => setForm({ ...form, endereco: e.target.value })}
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
