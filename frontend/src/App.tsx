import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Itens from './pages/Itens';
import Entradas from './pages/Entradas';
import Saidas from './pages/Saidas';
import Validade from './pages/Validade';
import Setores from './pages/Setores';
import Doadores from './pages/Doadores';
import Beneficiarios from './pages/Beneficiarios';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';

function Privado({ children }: { children: JSX.Element }) {
  const { usuario } = useAuth();
  return usuario ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Privado><Layout /></Privado>}>
          <Route index element={<Dashboard />} />
          <Route path="itens" element={<Itens />} />
          <Route path="entradas" element={<Entradas />} />
          <Route path="saidas" element={<Saidas />} />
          <Route path="validade" element={<Validade />} />
          <Route path="setores" element={<Setores />} />
          <Route path="doadores" element={<Doadores />} />
          <Route path="beneficiarios" element={<Beneficiarios />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
