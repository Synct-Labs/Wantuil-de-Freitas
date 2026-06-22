import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Icon from './components/Icon';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Itens from './pages/Itens';
import Entradas from './pages/Entradas';
import Saidas from './pages/Saidas';
import Validade from './pages/Validade';
import Setores from './pages/Setores';
import Eventos from './pages/Eventos';
import Doadores from './pages/Doadores';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';

function Privado({ children }: { children: JSX.Element }) {
  const { usuario } = useAuth();
  return usuario ? children : <Navigate to="/login" replace />;
}

function RequerPermissao({ acao, children }: { acao: string; children: JSX.Element }) {
  const { podeFazer } = useAuth();
  if (!podeFazer(acao)) {
    return (
      <div className="card" style={{ maxWidth: 500, margin: '40px auto' }}>
        <div className="empty-state">
          <Icon name="lock" size={40} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
          <div className="empty-state-title" style={{ fontSize: 15 }}>Acesso negado</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
            Seu perfil não tem permissão para acessar esta página. Fale com um administrador.
          </div>
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Privado><Layout /></Privado>}>
          <Route index element={<Dashboard />} />
          <Route path="itens" element={<Itens />} />
          <Route path="entradas" element={<RequerPermissao acao="mov.entrada"><Entradas /></RequerPermissao>} />
          <Route path="saidas" element={<RequerPermissao acao="mov.saida"><Saidas /></RequerPermissao>} />
          <Route path="validade" element={<RequerPermissao acao="validade.ver"><Validade /></RequerPermissao>} />
          <Route path="setores" element={<RequerPermissao acao="setores.ver"><Setores /></RequerPermissao>} />
          <Route path="eventos" element={<RequerPermissao acao="eventos.ver"><Eventos /></RequerPermissao>} />
          <Route path="doadores" element={<RequerPermissao acao="doadores.ver"><Doadores /></RequerPermissao>} />
          <Route path="relatorios" element={<RequerPermissao acao="relatorios.ver"><Relatorios /></RequerPermissao>} />
          <Route path="configuracoes" element={<RequerPermissao acao="configuracoes"><Configuracoes /></RequerPermissao>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
