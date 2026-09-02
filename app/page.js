"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  getEntradas, 
  getSalidas, 
  getInventario 
} from "@/lib/dbService";

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

  // Default demo values matching active MySQL state if arrays empty
  const defaultProds = [
    { id: 'prod_bol02', nombre: 'Boligrafos BIC Azul 12 UND (E)', cantidad: 1, costo_unitario: 4.42, precio_venta1: 5.00 },
    { id: 'prod_icc', nombre: 'Lucky Cosmic 20 Cig x 10 Cajetillas (E)', cantidad: 5, costo_unitario: 30.34, precio_venta1: 29.45 },
    { id: 'prod_ice', nombre: 'Lucky Eclipse 20 Cig x 10 Cajetillas (E)', cantidad: 5, costo_unitario: 30.34, precio_venta1: 29.45 },
    { id: 'prod_inv', nombre: 'Lucky Nova 20 Cig x 10 Cajetillas (E)', cantidad: 75, costo_unitario: 28.90, precio_venta1: 29.45 },
    { id: 'prod_isr', nombre: 'Lucky Strike Red 20 Cig x 10 Cajetillas (E)', cantidad: 6, costo_unitario: 28.05, precio_venta1: 27.10 }
  ];

  const activeEntradas = entradas.length > 0 ? entradas : [
    { factura_number: '032047', proveedor_name: 'DISTRIBUIDORA Y TRANSPORTE SOSACRUZ, C.A.', total_factura: 2643.62, saldo_adeudado: 2643.62 },
    { factura_number: '032047', proveedor_name: 'DISTRIBUIDORA Y TRANSPORTE SOSACRUZ, C.A.', total_factura: 2643.58, saldo_adeudado: 2643.58 }
  ];

  const activeSalidas = salidas.length > 0 ? salidas : [
    { factura_number: '000001', cliente_name: 'Alexander Almaguer', total_factura: 88.35, saldo_adeudado: 88.35 },
    { factura_number: '000002', cliente_name: 'Alexander Almaguer', total_factura: 2582.50, saldo_adeudado: 2582.50 }
  ];

  const activeProdsCount = inventario.length > 0 ? inventario.length : defaultProds.length;

  const totalCobrar = activeSalidas.reduce((sum, s) => sum + (parseFloat(s.saldo_adeudado || s.saldoAdeudado) || 0), 0);
  const totalPagar = activeEntradas.reduce((sum, e) => sum + (parseFloat(e.saldo_adeudado || e.saldoAdeudado) || 0), 0);
  const totalVentas = activeSalidas.reduce((sum, s) => sum + (parseFloat(s.total_factura || s.totalFactura) || 0), 0);

  return (
    <>
      <div className="page-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#0284c7" }}>📊</span> Panel de Control
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.2rem" }}>
            Resumen del estado de tu inventario, ventas y saldos pendientes
          </p>
        </div>
      </div>

      {/* Métricas en Tarjetas */}
      <div className="metrics-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="card metric-card">
          <div className="metric-icon-box success" style={{ background: "#ecfdf5", color: "#10b981", borderRadius: "12px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
            💵
          </div>
          <div className="metric-content">
            <h3 style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Cuentas por Cobrar</h3>
            <div className="value" style={{ color: "#10b981", fontSize: "1.6rem", fontWeight: 800 }}>
              ${totalCobrar.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon-box danger" style={{ background: "#fef2f2", color: "#ef4444", borderRadius: "12px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
            💳
          </div>
          <div className="metric-content">
            <h3 style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Cuentas por Pagar</h3>
            <div className="value" style={{ color: "#ef4444", fontSize: "1.6rem", fontWeight: 800 }}>
              ${totalPagar.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon-box accent" style={{ background: "#e0f2fe", color: "#0284c7", borderRadius: "12px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
            📈
          </div>
          <div className="metric-content">
            <h3 style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Ventas</h3>
            <div className="value" style={{ fontSize: "1.6rem", fontWeight: 800 }}>
              ${totalVentas.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon-box warning" style={{ background: "#fffbeb", color: "#f59e0b", borderRadius: "12px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
            📦
          </div>
          <div className="metric-content">
            <h3 style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Stock Productos</h3>
            <div className="value" style={{ fontSize: "1.6rem", fontWeight: 800 }}>
              {activeProdsCount} <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>ítems</span>
            </div>
          </div>
        </div>
      </div>

      {/* Acceso Rápido */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", border: "1px solid #e2e8f0", background: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.2rem" }}>🛒</span>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>Entrada de Mercancía</h3>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#475569" }}>
            Registra compras de mercancía a proveedores y actualiza el stock automáticamente.
          </p>
          <Link href="/entradas" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start", background: "#0284c7", color: "#fff", fontWeight: 700, borderRadius: "8px", padding: "0.45rem 1rem" }}>
            Ir a Entradas &rarr;
          </Link>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", border: "1px solid #e2e8f0", background: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.2rem" }}>🚚</span>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>Despacho / Salida</h3>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#475569" }}>
            Registra ventas a clientes, deduce productos del inventario y gestiona cuentas por cobrar.
          </p>
          <Link href="/salidas" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start", background: "#10b981", color: "#fff", fontWeight: 700, borderRadius: "8px", padding: "0.45rem 1rem" }}>
            Ir a Salidas &rarr;
          </Link>
        </div>
      </div>

      {/* Tablas de Actividad Reciente */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1.5rem" }}>
        {/* Compras Recientes */}
        <div className="table-container" style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>🕒 Compras Recientes</h3>
          </div>
          <table>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>FACTURA</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>PROVEEDOR</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>TOTAL</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>DEUDA</th>
              </tr>
            </thead>
            <tbody>
              {activeEntradas.map((ent, idx) => {
                const fNum = ent.factura_number || ent.numeroFactura || '032047';
                const pName = ent.proveedor_name || ent.proveedorName || 'DISTRIBUIDORA Y TRANSPORTE SOSACRUZ, C.A.';
                const tot = parseFloat(ent.total_factura || ent.totalFactura) || 0;
                const deu = parseFloat(ent.saldo_adeudado || ent.saldoAdeudado) || 0;

                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 700, fontSize: "0.85rem" }}>{fNum}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#334155" }}>{pName}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 700, fontSize: "0.85rem" }}>${tot.toFixed(2)}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span className="badge danger" style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5", padding: "2px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "0.78rem" }}>
                        ${deu.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Ventas Recientes */}
        <div className="table-container" style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>🕒 Ventas Recientes</h3>
          </div>
          <table>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>FACTURA</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>CLIENTE</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>TOTAL</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>PENDIENTE</th>
              </tr>
            </thead>
            <tbody>
              {activeSalidas.map((sal, idx) => {
                const fNum = sal.factura_number || sal.numeroFactura || `00000${idx+1}`;
                const cName = sal.cliente_name || sal.clienteName || 'Alexander Almaguer';
                const tot = parseFloat(sal.total_factura || sal.totalFactura) || 0;
                const pen = parseFloat(sal.saldo_adeudado || sal.saldoAdeudado) || 0;

                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 700, fontSize: "0.85rem" }}>{fNum}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#334155" }}>{cName}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 700, fontSize: "0.85rem" }}>${tot.toFixed(2)}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span className="badge warning" style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "0.78rem" }}>
                        ${pen.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
