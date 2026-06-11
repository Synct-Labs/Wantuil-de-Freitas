import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setLoading(true);
    try {
      await login(email, senha);
      nav('/');
    } catch {
      setErro('E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--g900)' }}>
      <form onSubmit={entrar} className="card" style={{ width: 360, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, background: 'var(--g400)', borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, marginBottom: 10 }}>🏪</div>
          <h1 style={{ fontSize: 17, fontWeight: 600 }}>Wantuil de Freitas</h1>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Gestão de Almoxarifado</div>
        </div>
        <label className="label">E-mail</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ marginBottom: 12 }} required />
        <label className="label">Senha</label>
        <input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
          style={{ marginBottom: 16 }} required />
        {erro && <div style={{ color: 'var(--r600)', fontSize: 12, marginBottom: 12 }}>{erro}</div>}
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
