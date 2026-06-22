import { createContext, useContext, useState, ReactNode } from 'react';
import api from '../api/client';

interface Usuario { id: string; nome: string; email: string; perfil: string }

interface AuthCtx {
  usuario: Usuario | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  podeFazer: (acao: string) => boolean;
}

const Ctx = createContext<AuthCtx>(null!);

// ─────────────────────────────────────────────────────────────────────────────
// MATRIZ DE PERMISSÕES — espelha a tabela de roles (5 níveis)
//
//  MASTER    — dono do sistema. Tudo + logs + diagnóstico + reset.
//  ADMIN     — diretoria. Tudo do dia-a-dia + gestão de usuários.
//  ALMOXARIFE— operação. Entradas, saídas, descartes, eventos, itens.
//  GESTOR    — auditoria/leitura. Ver itens, doadores (só ver), relatórios.
//  OPERADOR  — auxiliar. Apenas saídas e baixa de eventos.
// ─────────────────────────────────────────────────────────────────────────────
const PERMISSOES: Record<string, string[]> = {
  // Dashboard — todos
  'dashboard.ver':        ['MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR', 'OPERADOR'],

  // Itens
  'itens.ver':            ['MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR', 'OPERADOR'],
  'itens.criar':          ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'itens.editar':         ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'itens.excluir':        ['MASTER', 'ADMIN'],

  // Movimentações
  'mov.entrada':          ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'mov.saida':            ['MASTER', 'ADMIN', 'ALMOXARIFE', 'OPERADOR'],
  'mov.descarte':         ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'mov.estorno':          ['MASTER', 'ADMIN'],

  // Validade / descarte
  'validade.ver':         ['MASTER', 'ADMIN', 'ALMOXARIFE'],

  // Eventos
  'eventos.ver':          ['MASTER', 'ADMIN', 'ALMOXARIFE', 'OPERADOR'],
  'eventos.criar':        ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'eventos.editar':       ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'eventos.excluir':      ['MASTER', 'ADMIN'],
  'eventos.cancelar':     ['MASTER', 'ADMIN'],
  'eventos.iniciar':      ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'eventos.finalizar':    ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'eventos.reservar':     ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'eventos.baixar':       ['MASTER', 'ADMIN', 'ALMOXARIFE', 'OPERADOR'],

  // Setores — GESTOR e OPERADOR não gerenciam
  'setores.gerenciar':    ['MASTER', 'ADMIN'],
  'setores.ver':          ['MASTER', 'ADMIN', 'ALMOXARIFE'],

  // Doadores — GESTOR só vê, OPERADOR não acessa
  'doadores.ver':         ['MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR'],
  'doadores.criar':       ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'doadores.editar':      ['MASTER', 'ADMIN', 'ALMOXARIFE'],
  'doadores.excluir':     ['MASTER', 'ADMIN'],

  // Relatórios — MASTER, ADMIN, ALMOXARIFE, GESTOR (não OPERADOR)
  'relatorios.ver':       ['MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR'],

  // Auditoria / logs — apenas MASTER
  'auditoria.ver':        ['MASTER'],
  'auditoria.exportar':   ['MASTER'],

  // Configurações
  'configuracoes':        ['MASTER', 'ADMIN'],          // acessa a página
  'config.geral':         ['MASTER', 'ADMIN'],          // abas Usuários, Categorias, Notificações
  'config.sistema':       ['MASTER'],                   // aba Sistema (reset, limpar)
  'config.email-teste':   ['MASTER'],                   // Testar e-mail / diagnóstico Resend
  'usuarios.gerenciar':   ['MASTER', 'ADMIN'],
  'usuarios.master':      ['MASTER'],                   // só MASTER cria/edita outro MASTER
  'categorias.gerenciar': ['MASTER', 'ADMIN'],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email: string, senha: string) {
    const { data } = await api.post('/auth/login', { email: email.trim().toLowerCase(), senha });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  function podeFazer(acao: string): boolean {
    if (!usuario) return false;
    const perfisPermitidos = PERMISSOES[acao];
    if (!perfisPermitidos) return false;
    return perfisPermitidos.includes(usuario.perfil);
  }

  return <Ctx.Provider value={{ usuario, login, logout, podeFazer }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
