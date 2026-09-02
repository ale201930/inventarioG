"use client";
import React, { useState, useEffect } from "react";
import { getInventario } from "@/lib/dbService";

export default function InventarioPage() {
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const stockList = await getInventario();
      setInventario(stockList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const defaultProds = [
    { id: 'prod_bol02', codigo_producto: 'bol-02', nombre: 'Boligrafos BIC Azul 12 UND (E)', cantidad: 1, costo_unitario: 4.42, precio_venta1: 5.00, precio_venta2: 5.20, precio_venta3: 5.40 },
    { id: 'prod_icc', codigo_producto: 'icc', nombre: 'Lucky Cosmic 20 Cig x 10 Cajetillas (E)', cantidad: 5, costo_unitario: 30.34, precio_venta1: 29.45, precio_venta2: 30.45, precio_venta3: 31.45 },
    { id: 'prod_ice', codigo_producto: 'ice', nombre: 'Lucky Eclipse 20 Cig x 10 Cajetillas (E)', cantidad: 5, costo_unitario: 30.34, precio_venta1: 29.45, precio_venta2: 30.45, precio_venta3: 31.45 },
    { id: 'prod_inv', codigo_producto: 'inv', nombre: 'Lucky Nova 20 Cig x 10 Cajetillas (E)', cantidad: 75, costo_unitario: 28.90, precio_venta1: 29.45, precio_venta2: 30.45, precio_venta3: 31.45 },
    { id: 'prod_isr', codigo_producto: 'isr', nombre: 'Lucky Strike Red 20 Cig x 10 Cajetillas (E)', cantidad: 6, costo_unitario: 28.05, precio_venta1: 27.10, precio_venta2: 28.15, precio_venta3: 29.15 }
  ];

  const activeStock = inventario.length > 0 ? inventario : defaultProds;

  const filteredStock = activeStock.filter(prod => 
    (prod.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (prod.codigo_producto || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="page-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#0284c7" }}>📦</span> Control de Inventario
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.2rem" }}>
            Gestión de stock en tiempo real y catálogo de 3 precios de venta por producto
          </p>
        </div>
        <button className="btn btn-primary" onClick={loadData} style={{ background: "#0284c7", fontWeight: 700 }}>
          🔄 Actualizar Lista
        </button>
      </div>

      <div className="card" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
        <div className="card-header-flex" style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>Catálogo de Productos y Precios</h2>
          <div style={{ position: "relative", width: "100%", maxWidth: "320px" }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar por nombre o código..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            />
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>CÓDIGO</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b" }}>DESCRIPCIÓN / PRODUCTO</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b", textAlign: "center" }}>CANT. DISPONIBLE</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#64748b", textAlign: "right" }}>COSTO ($)</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#0284c7", textAlign: "right" }}>PRECIO 1 ($)</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#0284c7", textAlign: "right" }}>PRECIO 2 ($)</th>
                <th style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#0284c7", textAlign: "right" }}>PRECIO 3 ($)</th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map((prod, idx) => {
                const code = prod.codigo_producto || prod.codigoProducto || (prod.id || '').toUpperCase();
                const name = prod.nombre;
                const cant = parseInt(prod.cantidad || prod.stockBultos) || 0;
                const costo = parseFloat(prod.costo_unitario || prod.costoUnitario) || 0;
                const p1 = parseFloat(prod.precio_venta1 || prod.precioVenta1 || prod.precio_unitario) || 0;
                const p2 = parseFloat(prod.precio_venta2 || prod.precioVenta2) || p1;
                const p3 = parseFloat(prod.precio_venta3 || prod.precioVenta3) || p1;

                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 800, fontSize: "0.85rem", color: "#0284c7" }}>
                      {code}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, fontSize: "0.9rem", color: "#0f172a" }}>
                      {name}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                      <span className={`badge ${cant <= 0 ? "danger" : "success"}`} style={{ background: cant <= 0 ? "#fef2f2" : "#ecfdf5", color: cant <= 0 ? "#ef4444" : "#10b981", border: "1px solid", padding: "3px 10px", borderRadius: "6px", fontWeight: 800, fontSize: "0.85rem" }}>
                        {cant} unds
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 700, fontSize: "0.9rem", color: "#475569" }}>
                      ${costo.toFixed(2)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 800, fontSize: "0.9rem", color: "#0284c7" }}>
                      ${p1.toFixed(2)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 800, fontSize: "0.9rem", color: "#0284c7" }}>
                      ${p2.toFixed(2)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 800, fontSize: "0.9rem", color: "#0284c7" }}>
                      ${p3.toFixed(2)}
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
