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
  const [acaoAtiva, setAcaoAtiva] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ titulo: string; mensagem: string; tipo: 'sucesso' | 'aviso' | 'erro' } | null>(null);
  const [diagnostico, setDiagnostico] = useState<any>(null);

  async function executar(acao: string, fn: () => Promise<any>) {
    setAcaoAtiva(acao);
    setResultado(null);
    try {
      const data = await fn();
      return data;
    } catch (e: any) {
      setResultado({
        titulo: 'Falha na operação',
        mensagem: e.response?.data?.message || e.message || 'Erro desconhecido',
        tipo: 'erro',
      });
    } finally {
      setAcaoAtiva(null);
    }
  }

  async function verificarAgora() {
    const data = await executar('verificar', () =>
      api.post('/notificacoes/verificar-agora').then(r => r.data),
    );
    if (data) {
      setResultado({
        titulo: 'Verificação concluída',
        mensagem: `Foram analisados ${data.itensVerificados} itens. Criadas ${data.notificacoesCriadas} novas notificações (sem contar as que já existiam).`,
        tipo: data.notificacoesCriadas > 0 ? 'sucesso' : 'aviso',
      });
    }
  }

  async function dispararResumo() {
    await executar('resumo', () => api.post('/notificacoes/testar-resumo'));
    setResultado({
      titulo: 'Resumo semanal disparado',
      mensagem: 'Uma notificação foi criada com o resumo completo. Se o e-mail estiver configurado, também foi enviado.',
      tipo: 'sucesso',
    });
  }

  async function verDiagnostico() {
    const data = await executar('diag', () =>
      api.get('/notificacoes/diagnostico-email').then(r => r.data),
    );
    if (data) setDiagnostico(data);
  }

  async function testarEmail() {
    const data = await executar('email', () =>
      api.post('/notificacoes/testar-email').then(r => r.data),
    );
    if (data) {
      setResultado({
        titulo: data.sucesso ? 'E-mail enviado' : 'Falha ao enviar e-mail',
        mensagem: data.sucesso ? data.mensagem : (data.motivo || 'Verifique o diagnóstico abaixo'),
        tipo: data.sucesso ? 'sucesso' : 'erro',
      });
      if (data.diagnostico) setDiagnostico(data.diagnostico);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Notificações in-app */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="bell" size={16} color="var(--primary-dk)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Notificações no sistema</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.5 }}>
          O sistema cria notificações automaticamente quando itens ficam abaixo do mínimo,
          quando há produtos próximos do vencimento ou que precisam de descarte. Elas aparecem
          no sino do canto superior direito.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={verificarAgora} disabled={!!acaoAtiva}>
            {acaoAtiva === 'verificar'
              ? <><span className="spinner" /> Verificando…</>
              : <><Icon name="refresh" size={14} /> Verificar agora</>}
          </button>
          <button className="btn" onClick={dispararResumo} disabled={!!acaoAtiva}>
            {acaoAtiva === 'resumo'
              ? <><span className="spinner" /> Gerando…</>
              : <><Icon name="file-text" size={14} /> Gerar resumo semanal agora</>}
          </button>
        </div>
        <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 6, background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
          <strong>Verificação automática:</strong> todo dia às 08h e todo sábado às 08h (horário de Brasília).
        </div>
      </div>

      {/* E-mail */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="mail" size={16} color="var(--primary-dk)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>E-mail (resumo semanal)</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.5 }}>
          Além das notificações no sistema, o resumo de sábado também pode ser enviado por e-mail.
          Para isso, configure no Render as variáveis <code>RESEND_API_KEY</code>, <code>EMAIL_FROM</code> (opcional) e <code>EMAIL_NOTIFICACOES</code>.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={verDiagnostico} disabled={!!acaoAtiva}>
            {acaoAtiva === 'diag'
              ? <><span className="spinner" /> Carregando…</>
              : <><Icon name="info" size={14} /> Ver configuração</>}
          </button>
          <button className="btn" onClick={testarEmail} disabled={!!acaoAtiva}>
            {acaoAtiva === 'email'
              ? <><span className="spinner" /> Enviando…</>
              : <><Icon name="mail" size={14} /> Enviar e-mail de teste</>}
          </button>
        </div>

        {diagnostico && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 6,
            background: diagnostico.configurado ? 'var(--green-bg)' : 'var(--a-50)',
            border: `1px solid ${diagnostico.configurado ? 'var(--green)' : 'var(--a-200)'}`,
            fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6,
              color: diagnostico.configurado ? 'var(--green)' : 'var(--a-600)' }}>
              {diagnostico.configurado ? 'Configuração OK' : 'Configuração incompleta'}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.8, color: 'var(--text-2)' }}>
              <div><strong>RESEND_API_KEY:</strong> {diagnostico.detalhes.RESEND_API_KEY}</div>
              <div><strong>EMAIL_FROM:</strong> {diagnostico.detalhes.EMAIL_FROM}</div>
              <div><strong>EMAIL_NOTIFICACOES:</strong> {diagnostico.detalhes.EMAIL_NOTIFICACOES}</div>
            </div>
            {diagnostico.observacao && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--a-600)', lineHeight: 1.5 }}>
                ⚠ {diagnostico.observacao}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feedback de operação */}
      {resultado && (
        <div className="card" style={{
          background: resultado.tipo === 'sucesso' ? 'var(--green-bg)'
            : resultado.tipo === 'erro' ? 'var(--r-50)' : 'var(--a-50)',
          borderColor: resultado.tipo === 'sucesso' ? 'var(--green)'
            : resultado.tipo === 'erro' ? 'var(--r-600)' : 'var(--a-200)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon
              name={resultado.tipo === 'sucesso' ? 'check' : resultado.tipo === 'erro' ? 'alert-circle' : 'info'}
              size={16}
              color={resultado.tipo === 'sucesso' ? 'var(--green)' : resultado.tipo === 'erro' ? 'var(--r-600)' : 'var(--a-600)'}
              style={{ marginTop: 1 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4,
                color: resultado.tipo === 'sucesso' ? 'var(--green)' : resultado.tipo === 'erro' ? 'var(--r-600)' : 'var(--a-600)' }}>
                {resultado.titulo}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{resultado.mensagem}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
