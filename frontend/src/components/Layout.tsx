import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { grupo: 'Principal', links: [
    { to: '/', label: 'Dashboard', icon: '🏠' },
    { to: '/itens', label: 'Itens', icon: '📦' },
    { to: '/entradas', label: 'Entradas', icon: '↓' },
    { to: '/saidas', label: 'Saídas', icon: '↑' },
  ]},
  { grupo: 'Controle', links: [
    { to: '/validade', label: 'Validade', icon: '⏰' },
    { to: '/setores', label: 'Setores', icon: '🏢' },
  ]},
  { grupo: 'Cadastros', links: [
    { to: '/doadores', label: 'Doadores', icon: '❤️' },
    { to: '/beneficiarios', label: 'Beneficiários', icon: '👥' },
  ]},
  { grupo: 'Análise', links: [
    { to: '/relatorios', label: 'Relatórios', icon: '📊' },
  ]},
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const loc = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 200, background: 'var(--g900)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 14px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: 32, height: 32, background: 'var(--g400)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 8 }}>🏪</div>
          <div style={{ color: '#fff', fontWeight: 500, fontSize: 13 }}>Wantuil de Freitas</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Gestão de Almoxarifado</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {NAV.map((g) => (
            <div key={g.grupo}>
              <div style={{ padding: '10px 0 4px 14px', fontSize: 10, fontWeight: 500,
                color: 'rgba(255,255,255,0.3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{g.grupo}</div>
              {g.links.map((l) => {
                const ativo = loc.pathname === l.to;
                return (
                  <NavLink key={l.to} to={l.to} style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px',
                    fontSize: 13, textDecoration: 'none',
                    color: ativo ? '#fff' : 'rgba(255,255,255,0.6)',
                    background: ativo ? 'rgba(255,255,255,0.1)' : 'transparent',
                    borderLeft: `3px solid ${ativo ? 'var(--g200)' : 'transparent'}`,
                  }}>
                    <span style={{ fontSize: 15 }}>{l.icon}</span>{l.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 0', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
          <NavLink to="/configuracoes" style={{ display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 14px', fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
            ⚙️ Configurações
          </NavLink>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%',
            padding: '8px 14px', fontSize: 13, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none' }}>
            🚪 Sair ({usuario?.nome?.split(' ')[0]})
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, padding: 20, overflowY: 'auto', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
