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

// Matriz de permissoes — deve espelhar o backend (PerfilGuard + @Perfis)
const PERMISSOES: Record<string, string[]> = {
  // Itens
  'itens.criar':        ['ADMIN', 'ALMOXARIFE'],
  'itens.editar':       ['ADMIN', 'ALMOXARIFE'],
  'itens.excluir':      ['ADMIN'],
  // Movimentacoes
  'mov.entrada':        ['ADMIN', 'ALMOXARIFE'],
  'mov.saida':          ['ADMIN', 'ALMOXARIFE'],
  'mov.descarte':       ['ADMIN', 'ALMOXARIFE'],
  'mov.estorno':        ['ADMIN'],
  // Cadastros
  'doadores.criar':     ['ADMIN', 'ALMOXARIFE', 'OPERADOR'],
  'doadores.editar':    ['ADMIN', 'ALMOXARIFE', 'OPERADOR'],
  'doadores.excluir':   ['ADMIN'],
  'benef.criar':        ['ADMIN', 'ALMOXARIFE', 'OPERADOR'],
  'benef.editar':       ['ADMIN', 'ALMOXARIFE', 'OPERADOR'],
  'benef.excluir':      ['ADMIN'],
  // Estrutura
  'setores.gerenciar':  ['ADMIN'],
  'categorias.gerenciar':['ADMIN'],
  'usuarios.gerenciar': ['ADMIN'],
  'eventos.criar':      ['ADMIN', 'ALMOXARIFE', 'GESTOR'],
  // Visao
  'relatorios.ver':     ['ADMIN', 'ALMOXARIFE', 'GESTOR'],
  'auditoria.ver':      ['ADMIN'],
  'configuracoes':      ['ADMIN'],
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
