import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { excluirComConfirmacao } from '../utils/confirm';

const PERFIS = ['ADMIN', 'ALMOXARIFE', 'GESTOR', 'OPERADOR'];

export default function Configuracoes() {
  const { usuario, podeFazer } = useAuth();
  const [tab, setTab] = useState<'usuarios' | 'categorias' | 'notificacoes'>('usuarios');

  if (!podeFazer('configuracoes')) {
    return <div className="card">Acesso restrito a administradores.</div>;
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Configurações</h2>

      <div style={{ display: 'flex', gap: 4, borderBottom: '0.5px solid var(--border)', marginBottom: 16 }}>
        {[
          { id: 'usuarios', label: '👥 Usuários' },
          { id: 'categorias', label: '🏷️ Categorias' },
          { id: 'notificacoes', label: '🔔 Notificações' },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{
              padding: '8px 14px', fontSize: 13, background: 'none',
              border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--g600)' : 'var(--text2)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--g400)' : 'transparent'}`,
              fontWeight: tab === t.id ? 500 : 400, marginBottom: -1,
            }}>{t.label}</button>
        ))}
      </div>

      {tab === 'usuarios' && <Usuarios />}
      {tab === 'categorias' && <Categorias />}
      {tab === 'notificacoes' && <Notificacoes />}
    </div>
  );
}

function Usuarios() {
  const { usuario } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  useEffect(() => { carregar(); }, []);
  function carregar() { api.get('/usuarios').then((r) => setUsers(r.data)); }

  async function alternarStatus(u: any) {
    if (u.id === usuario?.id) return alert('Você não pode desativar a si mesmo');
    try {
      await api.patch(`/usuarios/${u.id}`, { ativo: !u.ativo });
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro');
    }
  }

  async function excluir(u: any) {
    if (u.id === usuario?.id) return alert('Você não pode excluir a si mesmo');
    const ok = await excluirComConfirmacao({
      url: `/usuarios/${u.id}`,
      pergunta: `Excluir usuário "${u.nome}"?\n\nObservação: se já tiver movimentações registradas, será apenas desativado.`,
    });
    if (ok) carregar();
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong>Usuários do sistema</strong>
        <button className="btn primary sm" onClick={() => { setEditando(null); setShowForm(true); }}>+ Novo usuário</button>
      </div>
      <table className="table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={{ fontWeight: 500 }}>{u.nome}{u.id === usuario?.id ? ' (você)' : ''}</td>
              <td>{u.email}</td>
              <td><span className="pill blue">{u.perfil}</span></td>
              <td><span className={`pill ${u.ativo ? 'green' : 'red'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn sm" onClick={() => { setEditando(u); setShowForm(true); }} title="Editar">✏️</button>
                  {u.id !== usuario?.id && (
                    <>
                      <button className="btn sm" onClick={() => alternarStatus(u)} title={u.ativo ? 'Desativar' : 'Reativar'}>
                        {u.ativo ? '🚫' : '✓'}
                      </button>
                      <button className="btn sm" style={{ color: 'var(--r600)' }} onClick={() => excluir(u)} title="Excluir">🗑️</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showForm && <FormUsuario usuario={editando} onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); carregar(); }} />}
    </div>
  );
}

function FormUsuario({ usuario, onClose, onSave }: any) {
  const [form, setForm] = useState({
    nome: usuario?.nome || '',
    email: usuario?.email || '',
    senha: '',
    perfil: usuario?.perfil || 'OPERADOR',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      if (usuario) {
        const payload: any = { nome: form.nome, email: form.email, perfil: form.perfil };
        if (form.senha) payload.senha = form.senha;
        await api.patch(`/usuarios/${usuario.id}`, payload);
      } else {
        if (!form.senha || form.senha.length < 6) throw new Error('Senha mínima 6 caracteres');
        await api.post('/usuarios', form);
      }
      onSave();
    } catch (e: any) {
      setErro(e.response?.data?.message || e.message || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={salvar}>
        <strong>{usuario ? 'Editar usuário' : 'Novo usuário'}</strong>
        <label className="label" style={{ marginTop: 14 }}>Nome *</label>
        <input className="input" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <label className="label" style={{ marginTop: 10 }}>E-mail *</label>
        <input className="input" type="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label className="label" style={{ marginTop: 10 }}>
          {usuario ? 'Nova senha (deixe vazio para manter)' : 'Senha *'}
        </label>
        <input className="input" type="password" minLength={6} required={!usuario}
          value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })}
          placeholder={usuario ? 'Deixe vazio para manter a atual' : 'Mínimo 6 caracteres'} />
        <label className="label" style={{ marginTop: 10 }}>Perfil</label>
        <select className="input" value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}
          style={{ marginBottom: 14 }}>
          {PERFIS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--g50)', padding: 8, borderRadius: 6, marginBottom: 14 }}>
          <strong>ADMIN:</strong> acesso total. <strong>ALMOXARIFE:</strong> movimentações e cadastros. 
          <strong>GESTOR:</strong> só visualização e relatórios. <strong>OPERADOR:</strong> cadastros de doadores/beneficiários.
        </div>
        {erro && <div style={{ color: 'var(--r600)', fontSize: 12, marginBottom: 10 }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn primary" disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

function Categorias() {
  const [lista, setLista] = useState<any[]>([]);
  const [novo, setNovo] = useState('');

  useEffect(() => { carregar(); }, []);
  function carregar() { api.get('/categorias').then((r) => setLista(r.data)); }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!novo.trim()) return;
    try {
      await api.post('/categorias', { nome: novo.trim() });
      setNovo(''); carregar();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro');
    }
  }

  async function excluir(c: any) {
    const ok = await excluirComConfirmacao({
      url: `/categorias/${c.id}`,
      pergunta: `Excluir a categoria "${c.nome}"?`,
    });
    if (ok) carregar();
  }

  return (
    <div className="card">
      <strong>Categorias de itens</strong>
      <form onSubmit={criar} style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 16 }}>
        <input className="input" placeholder="Nome da nova categoria..." value={novo}
          onChange={(e) => setNovo(e.target.value)} style={{ maxWidth: 280 }} />
        <button className="btn primary sm" type="submit">+ Adicionar</button>
      </form>
      <table className="table">
        <thead><tr><th>Nome</th><th>Itens vinculados</th><th>Ações</th></tr></thead>
        <tbody>
          {lista.map((c) => (
            <tr key={c.id}>
              <td style={{ fontWeight: 500 }}>{c.nome}</td>
              <td style={{ color: 'var(--text2)' }}>{c._count?.itens || 0}</td>
              <td>
                <button className="btn sm" style={{ color: 'var(--r600)' }} onClick={() => excluir(c)} title="Excluir">🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Notificacoes() {
  async function testar() {
    await api.post('/notificacoes/testar-resumo');
    alert('Resumo semanal disparado. Verifique o e-mail e a aba de notificações.');
  }
  return (
    <div className="card">
      <strong>🔔 Notificações</strong>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10, marginBottom: 14 }}>
        O resumo semanal é enviado automaticamente todo sábado às 08h00 (horário de Brasília).
        Use o botão abaixo para testar o envio manualmente.
      </div>
      <button className="btn" onClick={testar}>📧 Disparar resumo agora</button>
    </div>
  );
}
