import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon, { IconName } from './Icon';
import Logo from './Logo';
import NotificacoesBell from './NotificacoesBell';

interface NavLinkDef { to: string; label: string; icon: IconName; requer?: string }

const NAV: { grupo: string; links: NavLinkDef[] }[] = [
  { grupo: 'Principal', links: [
    { to: '/', label: 'Painel', icon: 'home' },
    { to: '/itens', label: 'Itens', icon: 'package' },
    { to: '/entradas', label: 'Entradas', icon: 'arrow-down', requer: 'mov.entrada' },
    { to: '/saidas', label: 'Saídas', icon: 'arrow-up', requer: 'mov.saida' },
  ]},
  { grupo: 'Controle', links: [
    { to: '/validade', label: 'Validade', icon: 'clock' },
    { to: '/setores', label: 'Setores', icon: 'building' },
    { to: '/eventos', label: 'Eventos', icon: 'calendar' },
  ]},
  { grupo: 'Cadastros', links: [
    { to: '/doadores', label: 'Doadores', icon: 'heart' },
    { to: '/beneficiarios', label: 'Beneficiários', icon: 'users' },
  ]},
  { grupo: 'Análise', links: [
    { to: '/relatorios', label: 'Relatórios', icon: 'chart-bar', requer: 'relatorios.ver' },
  ]},
];

export default function Layout() {
  const { usuario, logout, podeFazer } = useAuth();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navFiltrado = NAV
    .map(g => ({ ...g, links: g.links.filter(l => !l.requer || podeFazer(l.requer)) }))
    .filter(g => g.links.length > 0);

  const pageTitle = navFiltrado
    .flatMap(g => g.links)
    .concat([
      { to: '/configuracoes', label: 'Configurações', icon: 'settings' as IconName }
    ])
    .find(l => l.to === loc.pathname)?.label || 'Painel';

  return (
    <div className="app-shell">
      {/* Backdrop mobile */}
      {menuOpen && <div className="sidebar-backdrop mobile-only" onClick={() => setMenuOpen(false)} />}

      {/* Sidebar */}
      <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}><Logo /></div>
            <div className="desktop-only"><NotificacoesBell /></div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '.04em' }}>
            Sistema de Almoxarifado
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {navFiltrado.map(g => (
            <div key={g.grupo} style={{ marginBottom: 4 }}>
              <div style={{ padding: '12px 18px 4px', fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,0.4)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                {g.grupo}
              </div>
              {g.links.map(l => {
                const ativo = loc.pathname === l.to;
                return (
                  <NavLink key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '9px 18px',
                      fontSize: 13, textDecoration: 'none',
                      color: ativo ? '#fff' : 'rgba(255,255,255,0.72)',
                      background: ativo ? 'var(--nav-active)' : 'transparent',
                      borderLeft: `3px solid ${ativo ? 'var(--wf-amarelo)' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}>
                    <Icon name={l.icon} size={17} />
                    <span style={{ fontWeight: ativo ? 500 : 400 }}>{l.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ padding: '4px 4px 10px' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{usuario?.nome}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
              letterSpacing: '.06em', marginTop: 2 }}>{usuario?.perfil}</div>
          </div>
          {podeFazer('configuracoes') && (
            <NavLink to="/configuracoes" onClick={() => setMenuOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 4px', fontSize: 13,
                color: loc.pathname === '/configuracoes' ? '#fff' : 'rgba(255,255,255,0.6)',
                textDecoration: 'none', borderRadius: 4,
              }}>
              <Icon name="settings" size={15} />Configurações
            </NavLink>
          )}
          <button onClick={logout} style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
            padding: '8px 4px', fontSize: 13, color: 'rgba(255,255,255,0.6)',
            background: 'none', border: 'none', textAlign: 'left',
          }}>
            <Icon name="log-out" size={15} />Sair
          </button>
        </div>
      </nav>

      {/* Área principal */}
      <div className="main-area">
        {/* Top bar mobile */}
        <div className="topbar">
          <button className="topbar-toggle" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
            <Icon name="menu" size={22} />
          </button>
          <div className="topbar-title" style={{ flex: 1 }}>{pageTitle}</div>
          <div style={{ color: 'var(--text)' }}><NotificacoesBell /></div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
