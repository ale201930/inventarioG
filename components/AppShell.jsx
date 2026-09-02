// components/AppShell.jsx — Estructura persistente con iconos Font Awesome Free
'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bcvTasa, setBcvTasa] = useState(798.33);
  const [bcvFuente, setBcvFuente] = useState('BCV');

  // Determine active route
  const route = pathname === '/' ? 'dashboard' :
    pathname?.startsWith('/inventario') ? 'inventario' :
    pathname?.startsWith('/entradas') ? 'entradas' :
    pathname?.startsWith('/salidas') ? 'salidas' :
    pathname?.startsWith('/reportes') ? 'reportes' : 'dashboard';

  // Fetch BCV rate once when shell mounts (ALL HOOKS CALLED UNCONDITIONALLY)
  useEffect(() => {
    fetch('/api/bcv')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.tasaHoy) {
          setBcvTasa(d.data.tasaHoy);
          setBcvFuente(d.data.fuente || 'BCV');
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth?action=logout');
    router.push('/login');
  };

  const navItems = [
    { key: 'dashboard', href: '/', icon: 'fa-chart-pie', label: 'Panel Principal' },
    { key: 'inventario', href: '/inventario', icon: 'fa-box', label: 'Inventario' },
    { key: 'entradas', href: '/entradas', icon: 'fa-truck-loading', label: 'Entradas / Compras' },
    { key: 'salidas', href: '/salidas', icon: 'fa-receipt', label: 'Salidas / Ventas' },
    { key: 'reportes', href: '/reportes', icon: 'fa-file-invoice-dollar', label: 'Reportes' },
  ];

  // If on login page, render children directly without sidebar shell (AFTER all hooks)
  if (pathname === '/login' || pathname?.startsWith('/login')) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      {/* Mobile top bar */}
      <div className="mobile-top-bar">
        <div className="mobile-brand">
          <img src="/logo.png" alt="Logo InvG" style={{ width: 28, height: 28, borderRadius: 6 }} />
          <span>Inv<span style={{ color: '#0284c7' }}>G</span> <small style={{ fontSize: '0.6rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>PRO</small></span>
        </div>
        <button className="mobile-nav-btn" onClick={() => setSidebarOpen(true)} aria-label="Menu">
          <i className="fa-solid fa-bars" />
        </button>
      </div>

      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem' }}>
          <img src="/logo.png" alt="Logo InvG" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', boxShadow: '0 2px 8px rgba(2,132,199,0.3)' }} />
          <div className="brand-title" style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            Inv<span style={{ color: '#0284c7' }}>G</span>{' '}
            <small style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 2 }}>PRO</small>
          </div>
        </div>

        <ul className="nav-menu">
          {navItems.map(item => (
            <li key={item.key} className={`nav-item ${route === item.key ? 'active' : ''}`}>
              <Link href={item.href} onClick={() => setSidebarOpen(false)}>
                <i className={`fa-solid ${item.icon}`} />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* BCV Widget */}
        <div id="bcvWidgetSidebar" style={{ margin: '1rem 0.75rem 0', padding: '0.75rem', background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd', fontSize: '0.82rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, color: '#0284c7' }}>ve Tasa BCV</span>
            <a href="https://www.bcv.org.ve" target="_blank" rel="noopener" style={{ color: '#0284c7', fontSize: '0.7rem' }}>
              <i className="fa-solid fa-arrow-up-right-from-square" />
            </a>
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0f172a' }}>
            Bs. {Number(bcvTasa).toLocaleString('es-VE', { minimumFractionDigits: 2 })} <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#64748b' }}>/ USD</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>Fuente: {bcvFuente}</div>
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
            <i className="fa-solid fa-right-from-bracket" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
