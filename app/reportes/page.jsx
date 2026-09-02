// app/reportes/page.jsx — Panel Financiero (idéntico a views/reportes.php + assets/js/reportes.js)
'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

function fmt(n) { return '$' + Number(n||0).toFixed(2); }
function fmtBs(n, t) { return 'Bs. ' + Number((n||0)*(t||1)).toLocaleString('es-VE', {minimumFractionDigits:2}); }

export default function ReportesPage() {
  const [metrics, setMetrics] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/reportes').then(r=>r.json()),
      fetch('/api/salidas?action=clientes').then(r=>r.json()),
    ]).then(([rep, cli]) => {
      if (rep.success) setMetrics(rep.metrics);
      if (cli.success) setClientes(cli.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleExportCSV = () => {
    if (!metrics) return;
    const rows = [
      ['Métrica', 'USD', 'Bs.'],
      ['Utilidad / Ganancia Real', metrics.gananciaBruta, metrics.gananciaBrutaVES],
      ['Margen de Ganancia (%)', metrics.margenGanancia + '%', ''],
      ['Ventas Totales', metrics.totalVentas, metrics.totalVentasVES],
      ['Costo de lo Vendido', metrics.totalCostosVendidos, metrics.totalCostosVendidosVES],
      ['Cuentas por Cobrar', metrics.totalCobrar, metrics.totalCobrarVES],
      ['Cuentas por Pagar', metrics.totalPagar, metrics.totalPagarVES],
    ];
    const csv = rows.map(r=>r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `reporte_financiero_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const t = metrics?.tasaBCV || 798.33;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="fa-solid fa-chart-line" style={{color:'var(--primary)'}}></i> Panel Financiero · Ganancias y Pérdidas</h1>
          <p className="page-subtitle">Balance de utilidad real, margen de ganancias, ingresos por ventas y cuentas por cobrar/pagar</p>
        </div>
        <button className="btn btn-primary" onClick={handleExportCSV} style={{background:'#0284c7', border:'none', fontWeight:700}}>
          <i className="fa-solid fa-file-excel"></i> Exportar Informe Financiero
        </button>
      </div>

      {loading && <div style={{textAlign:'center', padding:'3rem', color:'var(--text-muted)'}}>Cargando reporte financiero...</div>}

      {!loading && metrics && (
        <>
          <div className="metrics-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'1.25rem', marginBottom:'1.5rem'}}>
            {/* Ganancia Bruta */}
            <div className="card metric-card" style={{borderLeft:'5px solid #16a34a', background:'linear-gradient(135deg,#fff 0%,#f0fdf4 100%)'}}>
              <div className="metric-icon-box success" style={{background:'#dcfce7', color:'#15803d'}}><i className="fa-solid fa-hand-holding-dollar"></i></div>
              <div className="metric-info">
                <h3 style={{color:'#166534', fontWeight:800, fontSize:'0.85rem', textTransform:'uppercase'}}>Utilidad / Ganancia Real</h3>
                <div className="value" style={{color:'#15803d', fontSize:'1.5rem', fontWeight:800}}>{fmt(metrics.gananciaBruta)}</div>
                <div style={{fontSize:'0.75rem', fontWeight:700, color:'#166534'}}>Bs. {Number(metrics.gananciaBrutaVES).toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
              </div>
            </div>
            {/* Margen */}
            <div className="card metric-card" style={{borderLeft:'5px solid #0284c7', background:'linear-gradient(135deg,#fff 0%,#f0f9ff 100%)'}}>
              <div className="metric-icon-box primary" style={{background:'#e0f2fe', color:'#0369a1'}}><i className="fa-solid fa-percent"></i></div>
              <div className="metric-info">
                <h3 style={{color:'#0369a1', fontWeight:800, fontSize:'0.85rem', textTransform:'uppercase'}}>Margen de Ganancia</h3>
                <div className="value" style={{color:'#0284c7', fontSize:'1.5rem', fontWeight:800}}>{Number(metrics.margenGanancia).toFixed(2)}%</div>
                <div style={{fontSize:'0.75rem', color:'#64748b'}}>Rendimiento s/Ventas</div>
              </div>
            </div>
            {/* Ventas */}
            <div className="card metric-card" style={{borderLeft:'5px solid #6366f1'}}>
              <div className="metric-icon-box primary" style={{background:'#e0e7ff', color:'#4338ca'}}><i className="fa-solid fa-cash-register"></i></div>
              <div className="metric-info">
                <h3 style={{fontSize:'0.85rem', textTransform:'uppercase'}}>Ventas Totales</h3>
                <div className="value" style={{color:'#4338ca', fontSize:'1.4rem', fontWeight:800}}>{fmt(metrics.totalVentas)}</div>
                <div style={{fontSize:'0.75rem', color:'#64748b'}}>Bs. {Number(metrics.totalVentasVES).toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
              </div>
            </div>
            {/* Costos */}
            <div className="card metric-card" style={{borderLeft:'5px solid #f59e0b'}}>
              <div className="metric-icon-box warning" style={{background:'#fef3c7', color:'#b45309'}}><i className="fa-solid fa-boxes-packing"></i></div>
              <div className="metric-info">
                <h3 style={{fontSize:'0.85rem', textTransform:'uppercase'}}>Costo de lo Vendido</h3>
                <div className="value" style={{color:'#b45309', fontSize:'1.4rem', fontWeight:800}}>{fmt(metrics.totalCostosVendidos)}</div>
                <div style={{fontSize:'0.75rem', color:'#64748b'}}>Bs. {Number(metrics.totalCostosVendidosVES).toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
              </div>
            </div>
            {/* Por Cobrar */}
            <div className="card metric-card" style={{borderLeft:'5px solid #dc2626'}}>
              <div className="metric-icon-box danger" style={{background:'#fee2e2', color:'#b91c1c'}}><i className="fa-solid fa-users-rectangle"></i></div>
              <div className="metric-info">
                <h3 style={{fontSize:'0.85rem', textTransform:'uppercase'}}>Cuentas por Cobrar</h3>
                <div className="value" style={{color:'#dc2626', fontSize:'1.4rem', fontWeight:800}}>{fmt(metrics.totalCobrar)}</div>
                <div style={{fontSize:'0.75rem', color:'#64748b'}}>Bs. {Number(metrics.totalCobrarVES).toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
              </div>
            </div>
            {/* Por Pagar */}
            <div className="card metric-card" style={{borderLeft:'5px solid #8b5cf6'}}>
              <div className="metric-icon-box danger" style={{background:'#f3e8ff', color:'#6d28d9'}}><i className="fa-solid fa-truck-ramp-box"></i></div>
              <div className="metric-info">
                <h3 style={{fontSize:'0.85rem', textTransform:'uppercase'}}>Cuentas por Pagar</h3>
                <div className="value" style={{color:'#6d28d9', fontSize:'1.4rem', fontWeight:800}}>{fmt(metrics.totalPagar)}</div>
                <div style={{fontSize:'0.75rem', color:'#64748b'}}>Bs. {Number(metrics.totalPagarVES).toLocaleString('es-VE', {minimumFractionDigits:2})}</div>
              </div>
            </div>
          </div>

          {/* Tabla clientes deudores */}
          <div className="table-container" style={{marginTop:'1.5rem', background:'#fff', borderRadius:8, border:'1px solid var(--border-color)'}}>
            <div style={{padding:'1rem 1.25rem', background:'#f8fafc', borderBottom:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.5rem'}}>
              <h3 style={{fontSize:'1rem', fontWeight:800, color:'#0f172a'}}><i className="fa-solid fa-users-rectangle" style={{color:'#0284c7'}}></i> Histórico de Cuentas por Cobrar a Clientes</h3>
              <span style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>Métricas acumuladas e información de deudas activas</span>
            </div>
            <table>
              <thead>
                <tr style={{background:'#f1f5f9', fontSize:'0.8rem', textTransform:'uppercase'}}>
                  <th>Cliente</th><th>C.I. / RIF</th><th>Teléfono</th><th>Notas</th>
                  <th>Total Compras ($)</th><th>Saldo Deudor ($)</th><th>Saldo Deudor (Bs.)</th>
                </tr>
              </thead>
              <tbody>
                {clientes.length === 0 ? (
                  <tr><td colSpan={7} style={{textAlign:'center', padding:'2rem', color:'var(--text-muted)'}}>Sin datos de clientes</td></tr>
                ) : clientes.map((c,i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{c.cliente_name}</td>
                    <td>{c.cedula_rif || '—'}</td>
                    <td>{c.telefono || '—'}</td>
                    <td><span className="badge badge-primary">{c.total_notas}</span></td>
                    <td>${Number(c.total_compras_usd||0).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${Number(c.saldo_pendiente_usd)>0?'badge-danger':'badge-success'}`}>
                        ${Number(c.saldo_pendiente_usd||0).toFixed(2)}
                      </span>
                    </td>
                    <td>Bs. {Number((c.saldo_pendiente_usd||0)*t).toLocaleString('es-VE', {minimumFractionDigits:2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
