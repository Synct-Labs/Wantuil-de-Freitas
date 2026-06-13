import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { excluirComConfirmacao } from '../utils/confirm';
import Icon from '../components/Icon';

const PERFIS = ['ADMIN', 'ALMOXARIFE', 'GESTOR', 'OPERADOR'];

export default function Configuracoes() {
  const { podeFazer } = useAuth();
  const [tab, setTab] = useState<'usuarios' | 'categorias' | 'notificacoes'>('usuarios');

  if (!podeFazer('configuracoes')) {
    return (
      <div className="card">
        <div className="empty-state">
          <Icon name="lock" size={32} color="var(--text-3)" style={{ margin: '0 auto 10px' }} />
          <div className="empty-state-title">Acesso restrito</div>
          <div style={{ fontSize: 12 }}>Apenas administradores podem acessar esta página.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }} className="desktop-only">Configurações</h2>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 18, overflowX: 'auto' }}>
        {[
          { id: 'usuarios', label: 'Usuários', icon: 'users' as const },
          { id: 'categorias', label: 'Categorias', icon: 'tag' as const },
          { id: 'notificacoes', label: 'Notificações', icon: 'bell' as const },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{
              padding: '10px 16px', fontSize: 13,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--primary-dk)' : 'var(--text-2)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--primary)' : 'transparent'}`,
              fontWeight: tab === t.id ? 600 : 500, marginBottom: -1,
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
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
    if (u.id === usuario?.id) return alert('Você não pode desativar a si mesmo.');
    try {
      await api.patch(`/usuarios/${u.id}`, { ativo: !u.ativo });
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro');
    }
  }

  async function excluir(u: any) {
    if (u.id === usuario?.id) return alert('Você não pode excluir a si mesmo.');
    const ok = await excluirComConfirmacao({
      url: `/usuarios/${u.id}`,
      pergunta: `Excluir o usuário "${u.nome}"?\n\nObservação: se já tiver movimentações, será desativado.`,
    });
    if (ok) carregar();
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Usuários do sistema</span>
        <button className="btn primary sm" onClick={() => { setEditando(null); setShowForm(true); }}>
          <Icon name="plus" size={13} />Novo usuário
        </button>
      </div>
      <table className="table table-responsive">
        <thead>
          <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td data-label="Nome" style={{ fontWeight: 600 }}>
                {u.nome}{u.id === usuario?.id ? ' (você)' : ''}
              </td>
              <td data-label="E-mail">{u.email}</td>
              <td data-label="Perfil"><span className="pill blue">{u.perfil}</span></td>
              <td data-label="Status"><span className={`pill ${u.ativo ? 'green' : 'red'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td data-actions style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', gap: 4 }}>
                  <button className="btn icon sm" onClick={() => { setEditando(u); setShowForm(true); }} title="Editar">
                    <Icon name="pencil" size={13} />
                  </button>
                  {u.id !== usuario?.id && (
                    <>
                      <button className="btn icon sm" onClick={() => alternarStatus(u)} title={u.ativo ? 'Desativar' : 'Reativar'}>
                        <Icon name={u.ativo ? 'eye-off' : 'eye'} size={13} />
                      </button>
                      <button className="btn icon sm" onClick={() => excluir(u)} title="Excluir"
                        style={{ color: 'var(--r-600)' }}>
                        <Icon name="trash" size={13} />
                      </button>
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
  const [mostrarSenha, setMostrarSenha] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      if (usuario) {
        const payload: any = { nome: form.nome, email: form.email, perfil: form.perfil };
        if (form.senha) payload.senha = form.senha;
        await api.patch(`/usuarios/${usuario.id}`, payload);
      } else {
        if (!form.senha || form.senha.length < 6) throw new Error('Senha precisa ter ao menos 6 caracteres');
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
        <div className="modal-header">
          <span className="modal-title">{usuario ? 'Editar usuário' : 'Novo usuário'}</span>
          <button type="button" className="btn icon sm ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <label className="label">Nome *</label>
        <input className="input" required value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })} style={{ marginBottom: 12 }} />
        <label className="label">E-mail *</label>
        <input className="input" type="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ marginBottom: 12 }} />
        <label className="label">{usuario ? 'Nova senha (deixe vazio para manter)' : 'Senha *'}</label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input className="input" type={mostrarSenha ? 'text' : 'password'} minLength={6}
            required={!usuario} value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            placeholder={usuario ? 'Deixe vazio para manter' : 'Mínimo 6 caracteres'}
            style={{ paddingRight: 38 }} />
          <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', padding: 6, color: 'var(--text-3)' }}>
            <Icon name={mostrarSenha ? 'eye-off' : 'eye'} size={14} />
          </button>
        </div>
        <label className="label">Perfil</label>
        <select className="select" value={form.perfil}
          onChange={(e) => setForm({ ...form, perfil: e.target.value })} style={{ marginBottom: 14 }}>
          {PERFIS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <div style={{
          fontSize: 11, color: 'var(--text-2)', background: 'var(--surface-2)',
          padding: 10, borderRadius: 6, marginBottom: 14, lineHeight: 1.5,
        }}>
          <strong>ADMIN:</strong> acesso total. &nbsp;
          <strong>ALMOXARIFE:</strong> movimentações e cadastros. <br/>
          <strong>GESTOR:</strong> apenas relatórios. &nbsp;
          <strong>OPERADOR:</strong> apenas doadores/beneficiários.
        </div>
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
      url: `/categorias/${c.id}`, pergunta: `Excluir a categoria "${c.nome}"?`,
    });
    if (ok) carregar();
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Categorias de itens</span>
      </div>
      <div style={{ padding: 18 }}>
        <form onSubmit={criar} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="input" placeholder="Nome da nova categoria"
            value={novo} onChange={(e) => setNovo(e.target.value)} style={{ maxWidth: 280 }} />
          <button className="btn primary sm" type="submit"><Icon name="plus" size={13} />Adicionar</button>
        </form>
        <table className="table table-responsive">
          <thead>
            <tr><th>Nome</th><th>Itens vinculados</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td data-label="Nome" style={{ fontWeight: 600 }}>{c.nome}</td>
                <td data-label="Itens" style={{ color: 'var(--text-2)' }}>{c._count?.itens || 0}</td>
                <td data-actions style={{ textAlign: 'right' }}>
                  <button className="btn icon sm" onClick={() => excluir(c)} title="Excluir"
                    style={{ color: 'var(--r-600)' }}>
                    <Icon name="trash" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Notificacoes() {
  const [enviando, setEnviando] = useState(false);

  async function testar() {
    setEnviando(true);
    try {
      await api.post('/notificacoes/testar-resumo');
      alert('Resumo semanal disparado com sucesso.\nVerifique o e-mail configurado.');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao disparar');
    } finally { setEnviando(false); }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icon name="bell" size={16} color="var(--primary-dk)" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Notificações automáticas</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.5 }}>
        O resumo semanal é enviado automaticamente todo sábado às 08h00 (horário de Brasília)
        para os administradores cadastrados, contendo: itens próximos ao vencimento, em período adicional,
        para descarte, e abaixo do estoque mínimo.
      </div>
      <button className="btn" onClick={testar} disabled={enviando}>
        {enviando ? <><span className="spinner" /> Enviando...</> : <><Icon name="mail" size={14} /> Disparar resumo agora</>}
      </button>
    </div>
  );
}
