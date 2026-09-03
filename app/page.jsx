// app/page.jsx — Panel Principal
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function fmt(n) { return '$' + Number(n||0).toFixed(2); }

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/reportes')
      .then(r=>r.json())
      .then(d => {
        if (d.success) {
          setMetrics(d.metrics);
        }
      })
      .catch(()=>{})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header" style={{ marginBottom: '1.75rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
            <i className="fa-solid fa-chart-pie" style={{ color: '#0284c7' }}></i> Panel de Control
          </h1>
          <p className="page-subtitle" style={{ color: '#475569', fontSize: '0.92rem', fontWeight: 500, margin: 0 }}>
            Resumen en tiempo real del estado de tu inventario, ventas y saldos pendientes · Besteda 2, C.A.
          </p>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="metrics-grid" id="metricsContainer" style={{ marginBottom: '1.75rem' }}>
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

      {/* Acceso Rápido a Operaciones */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap:'1.5rem'}}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem'}}>
              <i className="fa-solid fa-cart-plus" style={{color:'var(--primary)', fontSize:'1.35rem'}}></i>
              <h3 style={{fontSize:'1.15rem', fontWeight:700, color:'#0f172a'}}>Entrada de Mercancía / Compras</h3>
            </div>
            <p style={{fontSize:'0.9rem', color:'var(--text-secondary)', marginBottom:'1.25rem', lineHeight: 1.5}}>
              Registra compras y facturas de proveedores con escaneo inteligente OCR y actualización inmediata del inventario.
            </p>
          </div>
          <Link href="/entradas" className="btn btn-primary btn-sm" style={{ width: 'fit-content' }}>
            Ir a Entradas <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem'}}>
              <i className="fa-solid fa-truck-dispatch" style={{color:'var(--success)', fontSize:'1.35rem'}}></i>
              <h3 style={{fontSize:'1.15rem', fontWeight:700, color:'#0f172a'}}>Facturación y Ventas (Salidas)</h3>
            </div>
            <p style={{fontSize:'0.9rem', color:'var(--text-secondary)', marginBottom:'1.25rem', lineHeight: 1.5}}>
              Genera facturas y tickets de venta para clientes, deduce el stock y gestiona saldos y cuentas por cobrar.
            </p>
          </div>
          <Link href="/salidas" className="btn btn-primary btn-sm" style={{backgroundColor:'var(--success)', width: 'fit-content'}}>
            Ir a Salidas <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>
      </div>
    </>
  );
}
