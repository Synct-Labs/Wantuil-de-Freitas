import { createContext, useContext, useState, ReactNode } from 'react';
import api from '../api/client';

interface Usuario { id: string; nome: string; email: string; perfil: string }

interface AuthCtx {
  usuario: Usuario | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email: string, senha: string) {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  return <Ctx.Provider value={{ usuario, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
