import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const PERFIS = ['ADMIN', 'ALMOXARIFE', 'GESTOR', 'OPERADOR'];

export default function Configuracoes() {
  const { usuario } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { if (usuario?.perfil === 'ADMIN') carregar(); }, []);
  function carregar() { api.get('/usuarios').then((r) => setUsers(r.data)); }

  async function testarResumoSemanal() {
    await api.post('/notificacoes/testar-resumo');
    alert('Resumo semanal acionado manualmente. Verifique e-mail e notificações.');
  }

  if (usuario?.perfil !== 'ADMIN') {
    return <div className="card">Acesso restrito a administradores.</div>;
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Configurações</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>🔔 Notificações</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
          O resumo semanal é enviado automaticamente todo sábado às 08h00 (Brasília).
          Use o botão abaixo para testar o envio manualmente.
        </div>
        <button className="btn" onClick={testarResumoSemanal}>📧 Disparar resumo agora</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>👥 Usuários do sistema</div>
          <button className="btn primary sm" onClick={() => setShowForm(true)}>+ Novo usuário</button>
        </div>
        <table className="table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.nome}</td>
                <td>{u.email}</td>
                <td><span className="pill blue">{u.perfil}</span></td>
                <td><span className={`pill ${u.ativo ? 'green' : 'red'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <FormUsuario onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); carregar(); }} />}
    </div>
  );
}

function FormUsuario({ onClose, onSave }: any) {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', perfil: 'OPERADOR' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try { await api.post('/usuarios', form); onSave(); }
    catch (e: any) { setErro(e.response?.data?.message || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={salvar}>
        <strong>Novo usuário</strong>
        <label className="label" style={{ marginTop: 14 }}>Nome *</label>
        <input className="input" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <label className="label" style={{ marginTop: 10 }}>E-mail *</label>
        <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label className="label" style={{ marginTop: 10 }}>Senha *</label>
        <input className="input" type="password" required minLength={6} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
        <label className="label" style={{ marginTop: 10 }}>Perfil</label>
        <select className="input" value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value as any })} style={{ marginBottom: 14 }}>
          {PERFIS.map((p) => <option key={p}>{p}</option>)}
        </select>
        {erro && <div style={{ color: 'var(--r600)', fontSize: 12, marginBottom: 10 }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn primary" disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>
            {salvando ? 'Salvando...' : 'Criar'}
          </button>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
