// components/AppShell.jsx — Estructura persistente con protección de rutas y optimización móvil
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
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Bloquear scroll de fondo cuando el menú lateral móvil esté abierto
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Check authentication status
  useEffect(() => {
    // Si estamos en la página de login, no bloquear renderizado
    if (pathname === '/login' || pathname?.startsWith('/login')) {
      setCheckingAuth(false);
      return;
    }

    // Comprobación rápida del cookie en cliente
    const hasUserCookie = typeof document !== 'undefined' && document.cookie.includes('invg_user');
    if (hasUserCookie) {
      setAuthenticated(true);
      setCheckingAuth(false);
    }

    // Validación formal con el servidor
    fetch('/api/auth?action=check')
      .then(r => r.json())
      .then(d => {
        if (d.authenticated) {
          setAuthenticated(true);
          setCheckingAuth(false);
        } else {
          setAuthenticated(false);
          setCheckingAuth(false);
          router.replace('/login');
        }
      })
      .catch(() => {
        if (!hasUserCookie) {
          setAuthenticated(false);
          setCheckingAuth(false);
          router.replace('/login');
        }
      });
  }, [pathname, router]);

  // Fetch BCV rate once when shell mounts
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

  // Determine active route
  const route = pathname === '/' ? 'dashboard' :
    pathname?.startsWith('/inventario') ? 'inventario' :
    pathname?.startsWith('/entradas') ? 'entradas' :
    pathname?.startsWith('/salidas') ? 'salidas' :
    pathname?.startsWith('/reportes') ? 'reportes' : 'dashboard';

  const handleLogout = async () => {
    await fetch('/api/auth?action=logout');
    setAuthenticated(false);
    router.replace('/login');
  };

  const navItems = [
    { key: 'dashboard', href: '/', icon: 'fa-chart-pie', label: 'Panel Principal' },
    { key: 'inventario', href: '/inventario', icon: 'fa-box', label: 'Inventario' },
    { key: 'entradas', href: '/entradas', icon: 'fa-truck-loading', label: 'Entradas / Compras' },
    { key: 'salidas', href: '/salidas', icon: 'fa-receipt', label: 'Salidas / Ventas' },
    { key: 'reportes', href: '/reportes', icon: 'fa-file-invoice-dollar', label: 'Reportes' },
  ];

  // If on login page, render children directly without sidebar shell
  if (pathname === '/login' || pathname?.startsWith('/login')) {
    return <>{children}</>;
  }

  // If unauthenticated on protected page, redirect to login
  if (!checkingAuth && !authenticated) {
    return null;
  }

  return (
    <div className="app-container">
      {/* Mobile top bar */}
      <div className="mobile-top-bar">
        <div className="mobile-brand">
          <img src="/logo.png" alt="Logo Besteda 2" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
            Besteda <span style={{ color: '#0284c7' }}>2</span> <small style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>C.A.</small>
          </span>
        </div>
        <button className="mobile-nav-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir Menú">
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
        <div className="sidebar-header-area">
          <div className="sidebar-brand">
            <img src="/logo.png" alt="Logo Besteda 2" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', boxShadow: '0 4px 12px rgba(2,132,199,0.35)' }} />
            <div className="brand-title">
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a', lineHeight: 1.1 }}>
                Besteda <span style={{ color: '#0284c7' }}>2</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: 2 }}>C.A. · Control de Inventario</div>
            </div>
          </div>
          {/* Botón cerrar en móvil */}
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Cerrar Menú">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Contenedor scrolleable del menú */}
        <div className="sidebar-scrollable-content">
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
          <div id="bcvWidgetSidebar" className="bcv-sidebar-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.82rem' }}>ve Tasa BCV</span>
              <a href="https://www.bcv.org.ve" target="_blank" rel="noopener" style={{ color: '#0284c7', fontSize: '0.75rem' }}>
                <i className="fa-solid fa-arrow-up-right-from-square" />
              </a>
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>
              Bs. {Number(bcvTasa).toLocaleString('es-VE', { minimumFractionDigits: 2 })} <span style={{ fontWeight: 500, fontSize: '0.75rem', color: '#64748b' }}>/ USD</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Fuente: {bcvFuente}</div>
          </div>
        </div>

        {/* Footer fijo del menú */}
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn btn-secondary btn-logout-sidebar">
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
