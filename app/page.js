"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  getEntradas, 
  getSalidas, 
  getInventario 
} from "@/lib/dbService";
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  PlusCircle, 
  FileText, 
  ChevronRight, 
  Calendar,
  Users,
  Activity
} from "lucide-react";
import BullLogo from "@/components/BullLogo";

export default function Dashboard() {
  const [entradas, setEntradas] = useState([]);
  const [salidas, setSalidas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const entList = await getEntradas();
      const salList = await getSalidas();
      const invList = await getInventario();

      setEntradas(entList);
      setSalidas(salList);
      setInventario(invList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const totalCobrar = salidas.reduce((sum, s) => sum + (s.saldoAdeudado || 0), 0);
  const totalPagar = entradas.reduce((sum, e) => sum + (e.saldoAdeudado || 0), 0);
  const totalVentas = salidas.reduce((sum, s) => sum + (s.totalFactura || 0), 0);
  const totalCompras = entradas.reduce((sum, e) => sum + (e.totalFactura || 0), 0);
  const totalProductos = inventario.length;

  // Recent transactions (newest first)
  const recentEntradas = [...entradas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 3);
  const recentSalidas = [...salidas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 3);

  if (loading) {
    return <p style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>Cargando panel...</p>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <BullLogo size={36} />
            Panel de Control
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Resumen general del estado de tu inventario, ventas y saldos pendientes
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-icon-box success">
            <DollarSign size={24} />
          </div>
          <div className="metric-content">
            <h3>Cuentas por Cobrar</h3>
            <div className="value" style={{ color: "var(--success)" }}>
              ${totalCobrar.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon-box danger">
            <DollarSign size={24} />
          </div>
          <div className="metric-content">
            <h3>Cuentas por Pagar</h3>
            <div className="value" style={{ color: "var(--danger)" }}>
              ${totalPagar.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon-box accent">
            <TrendingUp size={24} />
          </div>
          <div className="metric-content">
            <h3>Total de Ventas</h3>
            <div className="value">${totalVentas.toFixed(2)}</div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon-box warning">
            <Package size={24} />
          </div>
          <div className="metric-content">
            <h3>Stock Productos</h3>
            <div className="value">
              {totalProductos} <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 400 }}>ítems</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action shortcuts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(17, 25, 40, 0.75) 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <TrendingDown style={{ color: "var(--accent-light)" }} />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Entrada de Mercancía</h2>
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Registra una nueva factura de compra, ingresa productos al stock y gestiona la deuda con tu proveedor.
          </p>
          <Link href="/entradas" className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: "auto" }}>
            <span>Ir a Entradas</span>
            <ChevronRight size={16} />
          </Link>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(17, 25, 40, 0.75) 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <TrendingUp style={{ color: "var(--success)" }} />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Despacho / Salida</h2>
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Registra un despacho de venta para tus clientes, deduce productos del stock y asigna la venta a un vendedor.
          </p>
          <Link href="/salidas" className="btn btn-success" style={{ alignSelf: "flex-start", marginTop: "auto" }}>
            <span>Ir a Salidas</span>
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {/* Recent Activity lists */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {/* Recent purchases */}
        <div className="card">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Activity size={16} style={{ color: "var(--accent-light)" }} />
            Últimas Entradas (Compras)
          </h2>
          {recentEntradas.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem 0" }}>No hay registros de compras recientes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {recentEntradas.map((ent, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--card-border)" }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>Factura {ent.numeroFactura}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={12} /> {ent.fecha}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>${ent.totalFactura.toFixed(2)}</p>
                    {ent.saldoAdeudado > 0 ? (
                      <span className="badge danger" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>Debe: ${ent.saldoAdeudado.toFixed(2)}</span>
                    ) : (
                      <span className="badge success" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>Saldado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent sales */}
        <div className="card">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Activity size={16} style={{ color: "var(--success)" }} />
            Últimos Despachos (Ventas)
          </h2>
          {recentSalidas.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem 0" }}>No hay registros de despachos recientes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {recentSalidas.map((sal, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--card-border)" }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>{sal.clienteName}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={12} /> {sal.fecha}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>${sal.totalFactura.toFixed(2)}</p>
                    {sal.saldoAdeudado > 0 ? (
                      <span className="badge danger" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>Debe: ${sal.saldoAdeudado.toFixed(2)}</span>
                    ) : (
                      <span className="badge success" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>Saldado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
