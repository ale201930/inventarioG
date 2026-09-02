// app/page.jsx — Panel Principal (idéntico a views/dashboard.php)
'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';

function fmt(n) { return '$' + Number(n||0).toFixed(2); }

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [recentE, setRecentE] = useState([]);
  const [recentS, setRecentS] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/reportes')
      .then(r=>r.json())
      .then(d => {
        if (d.success) {
          setMetrics(d.metrics);
          setRecentE(d.recentEntradas || []);
          setRecentS(d.recentSalidas || []);
        }
      })
      .catch(()=>{})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="fa-solid fa-chart-pie" style={{color:'var(--primary)'}}></i> Panel de Control</h1>
          <p className="page-subtitle">Resumen del estado de tu inventario, ventas y saldos pendientes</p>
        </div>
      </div>

      {/* Métricas */}
      <div className="metrics-grid" id="metricsContainer">
        <div className="card metric-card">
          <div className="metric-icon-box success"><i className="fa-solid fa-hand-holding-dollar"></i></div>
          <div className="metric-info">
            <h3>Cuentas por Cobrar</h3>
            <div className="value" style={{color:'var(--success)'}}>{metrics ? fmt(metrics.totalCobrar) : '$0.00'}</div>
          </div>
        </div>
        <div className="card metric-card">
          <div className="metric-icon-box danger"><i className="fa-solid fa-money-bill-transfer"></i></div>
          <div className="metric-info">
            <h3>Cuentas por Pagar</h3>
            <div className="value" style={{color:'var(--danger)'}}>{metrics ? fmt(metrics.totalPagar) : '$0.00'}</div>
          </div>
        </div>
        <div className="card metric-card">
          <div className="metric-icon-box primary"><i className="fa-solid fa-chart-line"></i></div>
          <div className="metric-info">
            <h3>Total Ventas</h3>
            <div className="value">{metrics ? fmt(metrics.totalVentas) : '$0.00'}</div>
          </div>
        </div>
        <div className="card metric-card">
          <div className="metric-icon-box warning"><i className="fa-solid fa-boxes-stacked"></i></div>
          <div className="metric-info">
            <h3>Stock Productos</h3>
            <div className="value">{metrics ? `${metrics.totalItems} ítems` : '0 ítems'}</div>
          </div>
        </div>
      </div>

      {/* Acceso Rápido */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'1.5rem', marginBottom:'2rem'}}>
        <div className="card">
          <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem'}}>
            <i className="fa-solid fa-cart-plus" style={{color:'var(--primary)', fontSize:'1.25rem'}}></i>
            <h3 style={{fontSize:'1.1rem', fontWeight:600}}>Entrada de Mercancía</h3>
          </div>
          <p style={{fontSize:'0.88rem', color:'var(--text-secondary)', marginBottom:'1rem'}}>
            Registra compras de mercancía a proveedores y actualiza el stock automáticamente.
          </p>
          <Link href="/entradas" className="btn btn-primary btn-sm">Ir a Entradas <i className="fa-solid fa-arrow-right"></i></Link>
        </div>
        <div className="card">
          <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem'}}>
            <i className="fa-solid fa-truck-dispatch" style={{color:'var(--success)', fontSize:'1.25rem'}}></i>
            <h3 style={{fontSize:'1.1rem', fontWeight:600}}>Despacho / Salida</h3>
          </div>
          <p style={{fontSize:'0.88rem', color:'var(--text-secondary)', marginBottom:'1rem'}}>
            Registra ventas a clientes, deduce productos del inventario y gestiona cuentas por cobrar.
          </p>
          <Link href="/salidas" className="btn btn-primary btn-sm" style={{backgroundColor:'var(--success)'}}>Ir a Salidas <i className="fa-solid fa-arrow-right"></i></Link>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:'1.5rem'}}>
        <div className="table-container">
          <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid var(--border-color)', backgroundColor:'#fff'}}>
            <h3 style={{fontSize:'1rem', fontWeight:600}}><i className="fa-solid fa-clock-rotate-left"></i> Compras Recientes</h3>
          </div>
          <table>
            <thead><tr><th>Factura</th><th>Proveedor</th><th>Total</th><th>Deuda</th></tr></thead>
            <tbody>
              {recentE.length === 0 ? (
                <tr><td colSpan={4} style={{textAlign:'center', padding:'1.5rem', color:'var(--text-muted)'}}>Sin compras registradas</td></tr>
              ) : recentE.map(e => (
                <tr key={e.id}>
                  <td><span className="badge badge-primary">Nº {e.factura_number}</span></td>
                  <td style={{fontSize:'0.85rem'}}>{e.proveedor_name}</td>
                  <td>${Number(e.total_factura).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${Number(e.saldo_adeudado)>0?'badge-danger':'badge-success'}`}>
                      ${Number(e.saldo_adeudado).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-container">
          <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid var(--border-color)', backgroundColor:'#fff'}}>
            <h3 style={{fontSize:'1rem', fontWeight:600}}><i className="fa-solid fa-clock-rotate-left"></i> Ventas Recientes</h3>
          </div>
          <table>
            <thead><tr><th>Factura</th><th>Cliente</th><th>Total</th><th>Pendiente</th></tr></thead>
            <tbody>
              {recentS.length === 0 ? (
                <tr><td colSpan={4} style={{textAlign:'center', padding:'1.5rem', color:'var(--text-muted)'}}>Sin ventas registradas</td></tr>
              ) : recentS.map(s => (
                <tr key={s.id}>
                  <td><span className="badge badge-primary">Nº {s.factura_number}</span></td>
                  <td style={{fontSize:'0.85rem'}}>{s.cliente_name}</td>
                  <td>${Number(s.total_factura).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${Number(s.saldo_adeudado)>0?'badge-danger':'badge-success'}`}>
                      ${Number(s.saldo_adeudado).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
