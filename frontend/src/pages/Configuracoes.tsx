import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { excluirComConfirmacao } from '../utils/confirm';
import Icon from '../components/Icon';

const PERFIS = ['MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR', 'OPERADOR'];

export default function Configuracoes() {
  const { podeFazer } = useAuth();
  const podeSistema = podeFazer('config.sistema');
  const [tab, setTab] = useState<'usuarios' | 'categorias' | 'produtos-base' | 'notificacoes' | 'sistema'>('usuarios');

  if (!podeFazer('config.geral')) {
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

  const abas = [
    { id: 'usuarios', label: 'Usuários', icon: 'users' as const, visivel: true },
    { id: 'categorias', label: 'Categorias', icon: 'tag' as const, visivel: true },
    { id: 'produtos-base', label: 'Produtos Base', icon: 'package' as const, visivel: true },
    { id: 'notificacoes', label: 'Notificações', icon: 'bell' as const, visivel: true },
    { id: 'sistema', label: 'Sistema', icon: 'settings' as const, visivel: podeSistema },
  ].filter(t => t.visivel);

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }} className="desktop-only">Configurações</h2>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 18, overflowX: 'auto' }}>
        {abas.map((t) => (
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
      {tab === 'produtos-base' && <ProdutosBase />}
      {tab === 'notificacoes' && <Notificacoes />}
      {tab === 'sistema' && podeSistema && <Sistema />}
    </div>
  );
}

function Sistema() {
  const [estatisticas, setEstatisticas] = useState<any>(null);
  const [resetando, setResetando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [limpando, setLimpando] = useState(false);
  const [resultadoLimpeza, setResultadoLimpeza] = useState<any>(null);

  useEffect(() => { api.get('/sistema/estatisticas').then((r) => setEstatisticas(r.data)); }, []);

  async function limparExemplos() {
    const ok = confirm(
      'Apagar categorias e setores de exemplo que ainda não foram usados?\n\n' +
      'Itens cadastrados em uma categoria, ou movimentações vinculadas a um setor, ' +
      'são preservados automaticamente.',
    );
    if (!ok) return;
    setLimpando(true);
    try {
      const { data } = await api.post('/sistema/limpar-exemplos');
      setResultadoLimpeza(data);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao limpar dados de exemplo');
    } finally { setLimpando(false); }
  }

  async function fazerReset() {
    const c1 = prompt(
      'ATENÇÃO: Esta operação vai APAGAR todas as movimentações, lotes existentes, ' +
      'logs e notificações, e ZERAR o saldo de todos os itens.\n\n' +
      'Cadastros (itens, categorias, setores, doadores, beneficiários) serão MANTIDOS.\n\n' +
      'Digite RESETAR para confirmar:',
    );
    if (c1 !== 'RESETAR') return;
    const c2 = confirm('Tem CERTEZA? Essa ação não pode ser desfeita.');
    if (!c2) return;

    setResetando(true);
    try {
      const { data } = await api.post('/sistema/reset-para-lotes');
      setResultado(data);
      const { data: novasEst } = await api.get('/sistema/estatisticas');
      setEstatisticas(novasEst);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao executar reset');
    } finally { setResetando(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="chart-bar" size={16} color="var(--primary-dk)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Estado atual do sistema</span>
        </div>
        {!estatisticas ? <span className="spinner" /> : (
          <div className="grid-4" style={{ marginTop: 12 }}>
            {[
              { label: 'Itens cadastrados', val: estatisticas.itens },
              { label: 'Lotes', val: estatisticas.lotesAtivos, sub: `de ${estatisticas.lotes} totais` },
              { label: 'Movimentações', val: estatisticas.movimentacoes },
              { label: 'Doadores', val: estatisticas.doadores },
              { label: 'Usuários', val: estatisticas.usuarios },
            ].map((kpi: any, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 8, background: 'var(--surface-2)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase' }}>{kpi.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary-dk)' }}>{kpi.val}</div>
                {kpi.sub && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{kpi.sub}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="sparkles" size={16} color="var(--primary-dk)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Manutenção</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>
          <strong>Limpar dados de exemplo.</strong> Remove as categorias e setores
          que vieram pré-cadastrados no sistema (Alimentos, Higiene, Limpeza, Vestuário,
          Medicamentos, Outros; Estoque Geral, Cozinha, Enfermaria, Abrigo)
          <strong> apenas se ainda não foram usados</strong>. Itens cadastrados em uma
          categoria, ou movimentações em um setor, preservam o registro automaticamente.
        </div>
        <button className="btn" onClick={limparExemplos} disabled={limpando}>
          {limpando
            ? <><span className="spinner" /> Limpando…</>
            : <><Icon name="sparkles" size={14} /> Limpar dados de exemplo</>}
        </button>

        {resultadoLimpeza && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8,
            background: 'var(--green-bg)', border: '1px solid var(--green)' }}>
            <div style={{ fontWeight: 600, color: 'var(--green)', fontSize: 13, marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="check-circle" size={14} /> {resultadoLimpeza.mensagem}
            </div>
            {(resultadoLimpeza.apagadas.categorias.length > 0 || resultadoLimpeza.apagadas.setores.length > 0) && (
              <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6 }}>
                <strong>Apagados:</strong>{' '}
                {[...resultadoLimpeza.apagadas.categorias, ...resultadoLimpeza.apagadas.setores].join(', ')}
              </div>
            )}
            {(resultadoLimpeza.mantidos.categorias.length > 0 || resultadoLimpeza.mantidos.setores.length > 0) && (
              <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 4 }}>
                <strong>Mantidos (em uso):</strong>{' '}
                {[...resultadoLimpeza.mantidos.categorias, ...resultadoLimpeza.mantidos.setores].join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ border: '1px solid var(--r-200)', background: 'var(--r-50)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="alert-triangle" size={16} color="var(--r-600)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--r-600)' }}>Zona de risco</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>
          <strong>Resetar para começar a usar lotes.</strong> Esta operação apaga toda
          movimentação, lotes e logs existentes, e zera os saldos. Os cadastros
          (itens, categorias, doadores, beneficiários, usuários, setores) são mantidos.
          <br /><br />
          Use isso <strong>uma única vez</strong> após migrar o sistema para o modelo
          de lotes, para começar com o estoque limpo.
        </div>
        <button className="btn danger" onClick={fazerReset} disabled={resetando}>
          {resetando
            ? <><span className="spinner" /> Resetando…</>
            : <><Icon name="trash" size={14} /> Resetar para começar a usar lotes</>}
        </button>

        {resultado && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8,
            background: 'var(--green-bg)', border: '1px solid var(--green)' }}>
            <div style={{ fontWeight: 600, color: 'var(--green)', fontSize: 13, marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="check-circle" size={14} /> {resultado.mensagem}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6 }}>
              {resultado.contagens.movimentacoes} movimentações,&nbsp;
              {resultado.contagens.lotes} lotes,&nbsp;
              {resultado.contagens.movimentacaoItens} itens de movimentação,&nbsp;
              {resultado.contagens.logs} logs e&nbsp;
              {resultado.contagens.notificacoes} notificações apagados.&nbsp;
              {resultado.contagens.itensZerados} itens com saldo zerado.
            </div>
          </div>
        )}
      </div>
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
          <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th title="Recebe notificações por e-mail">Notif.</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
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
              <td data-label="Notif." style={{ textAlign: 'center' }}>
                {u.receberEmail
                  ? <Icon name="check" size={14} color="var(--green)" />
                  : <span style={{ color: 'var(--text-3)', fontSize: 14 }}>—</span>}
              </td>
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
  const { podeFazer } = useAuth();
  const podeCriarMaster = podeFazer('usuarios.master');
  // Lista de perfis que o usuario logado pode atribuir
  const perfisDisponiveis = podeCriarMaster ? PERFIS : PERFIS.filter(p => p !== 'MASTER');
  const editandoMaster = usuario?.perfil === 'MASTER';

  const [form, setForm] = useState({
    nome: usuario?.nome || '',
    email: usuario?.email || '',
    senha: '',
    perfil: usuario?.perfil || 'OPERADOR',
    receberEmail: usuario?.receberEmail ?? true,
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      if (usuario) {
        const payload: any = { nome: form.nome, email: form.email, perfil: form.perfil, receberEmail: form.receberEmail };
        if (form.senha) payload.senha = form.senha;
        await api.patch(`/usuarios/${usuario.id}`, payload);
        onSave();
      } else {
        // Senha agora e opcional na criacao. Se vazia, o backend envia convite por email.
        if (form.senha && form.senha.length < 6) {
          throw new Error('Se informar uma senha, ela precisa ter ao menos 6 caracteres');
        }
        const payload: any = { nome: form.nome, email: form.email, perfil: form.perfil, receberEmail: form.receberEmail };
        if (form.senha) payload.senha = form.senha;
        const { data } = await api.post('/usuarios', payload);
        // Mostra resultado do convite (se foi enviado ou nao)
        if (!form.senha) {
          if (data.conviteEnviado?.enviado) {
            alert(`Usuário criado! Um e-mail foi enviado para ${form.email} com o link para definir a senha (válido por 7 dias).`);
          } else {
            alert(`Usuário criado, mas houve falha ao enviar o convite por e-mail:\n\n${data.conviteEnviado?.motivo || 'erro desconhecido'}\n\nVocê pode pedir ao usuário para usar "Esqueci minha senha" na tela de login.`);
          }
        }
        onSave();
      }
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
        <label className="label">
          {usuario
            ? 'Nova senha (deixe vazio para manter)'
            : 'Senha (opcional)'}
        </label>
        <div style={{ position: 'relative', marginBottom: usuario ? 12 : 4 }}>
          <input className="input" type={mostrarSenha ? 'text' : 'password'} minLength={6}
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            placeholder={usuario
              ? 'Deixe vazio para manter'
              : 'Deixe vazio para enviar convite por e-mail'}
            style={{ paddingRight: 38 }} />
          <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', padding: 6, color: 'var(--text-3)' }}>
            <Icon name={mostrarSenha ? 'eye-off' : 'eye'} size={14} />
          </button>
        </div>
        {!usuario && !form.senha && (
          <div style={{
            fontSize: 11, color: 'var(--primary-dk)', marginBottom: 12,
            padding: '8px 10px', borderRadius: 6, background: 'var(--primary-bg)',
            display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.5,
          }}>
            <Icon name="mail" size={12} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>O usuário receberá um e-mail com link para definir a própria senha (válido por 7 dias).</span>
          </div>
        )}
        {!usuario && form.senha && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
            Você está definindo uma senha agora. Nenhum e-mail será enviado.
          </div>
        )}
        <label className="label">Perfil</label>
        <select className="select" value={form.perfil}
          disabled={editandoMaster && !podeCriarMaster}
          onChange={(e) => setForm({ ...form, perfil: e.target.value })} style={{ marginBottom: 14 }}>
          {perfisDisponiveis.map((p) => <option key={p}>{p}</option>)}
          {/* Mostra MASTER como opcao "presa" se o usuario sendo editado for MASTER mas o ator nao puder editar */}
          {editandoMaster && !podeCriarMaster && <option key="MASTER">MASTER</option>}
        </select>
        {editandoMaster && !podeCriarMaster && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: -10, marginBottom: 12 }}>
            Apenas usuários MASTER podem alterar contas MASTER.
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.receberEmail}
            onChange={(e) => setForm({ ...form, receberEmail: e.target.checked })}
            style={{ marginTop: 3 }} />
          <span style={{ fontSize: 13, lineHeight: 1.4 }}>
            <strong>Receber notificações por e-mail</strong>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
              Inclui alertas semanais de validade, estoque abaixo do mínimo e itens esgotados.
            </div>
          </span>
        </label>
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
  const { podeFazer } = useAuth();
  const podeEmailTeste = podeFazer('config.email-teste');
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
          <strong>Resumo semanal:</strong> enviado todo sábado às 7h da manhã.
        </div>
      </div>

      {/* E-mail (apenas MASTER — testes e diagnostico do Resend) */}
      {podeEmailTeste && (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="mail" size={16} color="var(--primary-dk)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>E-mail (resumo semanal)</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.5 }}>
          Além das notificações no sistema, alertas e o resumo de sábado são enviados por e-mail
          para <strong>todos os usuários cadastrados</strong> que tiverem a opção
          <em> "Receber notificações por e-mail"</em> marcada (gerenciado na aba <strong>Usuários</strong>).
          A configuração técnica do servidor (variáveis <code>RESEND_API_KEY</code> e <code>EMAIL_FROM</code>)
          é feita no <code>.env</code> da VPS.
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
              {Object.entries(diagnostico.detalhes).map(([k, v]) => (
                <div key={k}><strong>{k}:</strong> {String(v)}</div>
              ))}
            </div>
            {diagnostico.observacao && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--a-600)', lineHeight: 1.5 }}>
                ⚠ {diagnostico.observacao}
              </div>
            )}
          </div>
        )}
      </div>
      )}

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

// ═══════════════════════════════════════════════════════════════════════
// Aba: Produtos Base
// Agrega marcas/variacoes do mesmo produto (ex: "Arroz 5kg" agrupa Tio
// Joao + Camil). Estoque minimo passa a ser definido aqui, nao no item.
// ═══════════════════════════════════════════════════════════════════════
function ProdutosBase() {
  const [lista, setLista] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [busca, setBusca] = useState('');

  function carregar() {
    api.get('/produtos-base', { params: { busca } }).then((r) => setLista(r.data));
  }
  useEffect(carregar, [busca]);

  async function excluir(pb: any) {
    if (!confirm(`Excluir "${pb.nome}"?\n\nSe houver itens vinculados, sera desativado em vez de excluido.`)) return;
    try {
      await api.delete(`/produtos-base/${pb.id}`);
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao excluir');
    }
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Icon name="package" size={16} color="var(--primary-dk)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Produtos Base</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· agregam várias marcas do mesmo produto</span>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14,
          padding: 10, borderRadius: 6, background: 'var(--primary-bg)' }}>
          Um <strong>produto base</strong> agrupa itens de marcas diferentes (ex: o produto base
          "Arroz 5kg" agrupa "Arroz Tio João 5kg" e "Arroz Camil 5kg"). O <strong>estoque mínimo</strong> é
          definido aqui e os alertas comparam a soma de saldos de todas as marcas.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Buscar produto base..." style={{ flex: '1 1 200px' }}
            value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button className="btn primary" onClick={() => { setEditando(null); setShowForm(true); }}>
            <Icon name="plus" size={14} /> Novo produto base
          </button>
        </div>

        {lista.length === 0 ? (
          <div className="empty-state">
            <Icon name="package" size={28} color="var(--text-3)" style={{ margin: '0 auto 8px' }} />
            <div className="empty-state-title">Nenhum produto base cadastrado</div>
            <div style={{ fontSize: 11 }}>Cadastre produtos base para agrupar marcas em alertas e relatórios.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead><tr>
                <th>Nome</th><th>Unidade</th><th>Estoque mínimo</th><th>Saldo total</th><th>Marcas</th><th></th>
              </tr></thead>
              <tbody>
                {lista.map((pb) => {
                  const baixo = pb.estoqueMinimo > 0 && pb.saldoTotal <= Number(pb.estoqueMinimo);
                  return (
                    <tr key={pb.id}>
                      <td data-label="Nome"><strong>{pb.nome}</strong>{!pb.ativo && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-3)' }}>(inativo)</span>}</td>
                      <td data-label="Unidade" style={{ fontSize: 12 }}>{pb.unidadeMedida}</td>
                      <td data-label="Mínimo">{pb.estoqueMinimo}</td>
                      <td data-label="Saldo">
                        <span style={{ color: baixo ? 'var(--r-600)' : 'inherit', fontWeight: baixo ? 600 : 400 }}>
                          {pb.saldoTotal}
                        </span>
                      </td>
                      <td data-label="Marcas" style={{ fontSize: 12, color: 'var(--text-2)' }}>{pb.qtdMarcas}</td>
                      <td data-actions>
                        <button className="btn icon sm ghost" title="Editar"
                          onClick={() => { setEditando(pb); setShowForm(true); }}>
                          <Icon name="pencil" size={14} />
                        </button>
                        <button className="btn icon sm ghost" title="Excluir"
                          onClick={() => excluir(pb)}>
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <FormProdutoBase pb={editando}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); carregar(); }} />
      )}
    </div>
  );
}

function FormProdutoBase({ pb, onClose, onSave }: any) {
  const [form, setForm] = useState({
    nome: pb?.nome || '',
    unidadeMedida: pb?.unidadeMedida || 'un',
    estoqueMinimo: pb?.estoqueMinimo ?? 0,
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setSalvando(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        unidadeMedida: form.unidadeMedida.trim() || 'un',
        estoqueMinimo: Number(form.estoqueMinimo) || 0,
      };
      if (pb) await api.patch(`/produtos-base/${pb.id}`, payload);
      else await api.post('/produtos-base', payload);
      onSave();
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={salvar} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title">{pb ? 'Editar produto base' : 'Novo produto base'}</span>
          <button type="button" className="btn icon sm ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <label className="label">Nome *</label>
        <input className="input" required value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder='Ex: "Arroz 5kg", "Sabão em pó 800g"' style={{ marginBottom: 12 }} />

        <label className="label">Unidade de medida</label>
        <input className="input" value={form.unidadeMedida}
          onChange={(e) => setForm({ ...form, unidadeMedida: e.target.value })}
          placeholder="un, kg, L, pct..." style={{ marginBottom: 12 }} />

        <label className="label">Estoque mínimo</label>
        <input className="input" type="number" min="0" step="1" value={form.estoqueMinimo}
          onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })} style={{ marginBottom: 14 }} />

        {erro && <div style={{ padding: 8, borderRadius: 6, background: 'var(--r-50)', color: 'var(--r-600)', fontSize: 12, marginBottom: 12 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
