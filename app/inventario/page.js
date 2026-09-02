"use client";
import React, { useState, useEffect } from "react";
import { getInventario } from "@/lib/dbService";
import { 
  Package, 
  Search, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  AlertTriangle,
  Layers,
  CheckCircle
} from "lucide-react";

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

  // Filter products by name
  const filteredStock = inventario.filter(prod => 
    prod.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Statistics
  const totalProducts = inventario.length;
  const lowStockCount = inventario.filter(p => p.stockBultos <= 0 && p.stockKg <= 0).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Existencias en Inventario</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Control de stock en tiempo real contrastando entradas vs salidas
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadData}>
          Actualizar Vista
        </button>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-icon-box accent">
            <Package size={24} />
          </div>
          <div className="metric-content">
            <h3>Productos Registrados</h3>
            <div className="value">{totalProducts}</div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon-box warning">
            <AlertTriangle size={24} />
          </div>
          <div className="metric-content">
            <h3>Sin Stock (Bultos y Kg)</h3>
            <div className="value" style={{ color: lowStockCount > 0 ? "var(--warning)" : "var(--text-primary)" }}>
              {lowStockCount}
            </div>
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="card">
        <div className="card-header-flex">
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Nivel de Existencias</h2>
          <div style={{ position: "relative", width: "100%", maxWidth: "300px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input 
              type="text" 
              placeholder="Buscar producto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", fontSize: "0.85rem" }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>Cargando stock...</p>
        ) : filteredStock.length === 0 ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No se encontraron productos en el inventario.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Producto</th>
                  <th style={{ width: "20%" }}>Entradas Totales</th>
                  <th style={{ width: "20%" }}>Salidas Totales</th>
                  <th style={{ width: "30%" }}>Stock Actual disponible</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map((prod, idx) => {
                  const noStockBultos = prod.stockBultos <= 0;
                  const noStockKg = prod.stockKg <= 0;

                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, fontSize: "1rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <Layers size={18} style={{ color: "var(--accent-light)" }} />
                          {prod.nombre}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.85rem" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <ArrowDownCircle size={12} style={{ color: "var(--success)" }} />
                            <strong>{prod.entradasBultos}</strong> bultos
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <ArrowDownCircle size={12} style={{ color: "var(--success)" }} />
                            <strong>{prod.entradasKg.toFixed(2)}</strong> kg
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.85rem" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <ArrowUpCircle size={12} style={{ color: "var(--danger)" }} />
                            <strong>{prod.salidasBultos}</strong> bultos
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <ArrowUpCircle size={12} style={{ color: "var(--danger)" }} />
                            <strong>{prod.salidasKg.toFixed(2)}</strong> kg
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Bultos:</span>
                            <span className={`badge ${noStockBultos ? "danger" : "success"}`} style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                              {prod.stockBultos} bultos
                            </span>
                          </div>
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Kilogramos:</span>
                            <span className={`badge ${noStockKg ? "danger" : "success"}`} style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                              {prod.stockKg.toFixed(2)} kg
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
