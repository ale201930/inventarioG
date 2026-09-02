"use client";
import React, { useState, useEffect } from "react";
import { getEntradas, getSalidas } from "@/lib/dbService";
import { 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  UserCheck, 
  Users, 
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  Inbox,
  AlertCircle,
  CheckCircle,
  Search,
  X
} from "lucide-react";

export default function ReportesPage() {
  const [entradas, setEntradas] = useState([]);
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("cobrar"); // cobrar, pagar, vendedores, ganancias
  const [expandedClients, setExpandedClients] = useState({});
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Clear search query and dates when tab changes
  useEffect(() => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  }, [activeTab]);

  const loadHtml2Pdf = () => {
    return new Promise((resolve, reject) => {
      if (typeof window !== "undefined" && window.html2pdf) {
        resolve(window.html2pdf);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => {
        if (window.html2pdf) {
          resolve(window.html2pdf);
        } else {
          reject(new Error("La librería de PDFs se cargó, pero no se inicializó correctamente (window.html2pdf no está definido)."));
        }
      };
      script.onerror = () => reject(new Error("No se pudo cargar la librería html2pdf.js desde el servidor CDN. Por favor, comprueba tu conexión a internet o si tienes un bloqueador de scripts activo."));
      document.body.appendChild(script);
    });
  };

  const handleExportPDF = async () => {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    try {
      const html2pdf = await loadHtml2Pdf();
      const element = document.getElementById("pdf-report-content");
      if (!element) {
        throw new Error("El elemento de contenido del reporte ('pdf-report-content') no se encontró en el DOM. Por favor, asegúrate de que los datos hayan terminado de cargar.");
      }
      
      const tabNames = {
        cobrar: "cuentas_por_cobrar",
        pagar: "cuentas_por_pagar",
        vendedores: "ventas_por_vendedor"
      };
      
      const fileName = `reporte_${tabNames[activeTab] || "reporte"}_${new Date().toISOString().slice(0, 10)}.pdf`;
      
      const opt = {
        margin: [12, 12, 12, 12],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: true, // Habilitado para depuración
          letterRendering: true,
          onclone: (clonedDoc) => {
            const el = clonedDoc.getElementById("pdf-report-content");
            if (el) {
              el.style.position = "static";
              el.style.left = "0px";
              el.style.top = "0px";
              el.style.display = "block";
              el.style.visibility = "visible";
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
      };
      
      await html2pdf().from(element).set(opt).save();
    } catch (error) {
      console.error("Error detallado al generar PDF:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Hubo un error al generar el PDF: ${errorMessage}`);
    } finally {
      setPdfGenerating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const entList = await getEntradas();
      const salList = await getSalidas();
      setEntradas(entList);
      setSalidas(salList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleClientExpand = (clientName) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientName]: !prev[clientName]
    }));
  };

  // --- DATA CALCULATIONS ---

  // 1. Cuentas por Cobrar (Client debts)
  const clientMap = {};
  salidas.forEach(s => {
    if (s.saldoAdeudado > 0) {
      const cName = s.clienteName.trim();
      if (!clientMap[cName]) {
        clientMap[cName] = { name: cName, totalDebt: 0, invoices: [] };
      }
      clientMap[cName].totalDebt += s.saldoAdeudado;
      clientMap[cName].invoices.push({
        id: s.id,
        invoiceNumber: s.numeroFactura,
        fecha: s.fecha,
        total: s.totalFactura,
        remaining: s.saldoAdeudado
      });
    }
  });
  // Sort client details by date
  Object.keys(clientMap).forEach(cName => {
    clientMap[cName].invoices.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  });

  // Filter clientDebts based on searchQuery
  const clientDebts = Object.values(clientMap)
    .map(client => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return client;
      
      const filteredInvoices = client.invoices.filter(inv => 
        inv.invoiceNumber.toLowerCase().includes(query) ||
        client.name.toLowerCase().includes(query)
      );
      
      const filteredDebt = filteredInvoices.reduce((sum, inv) => sum + inv.remaining, 0);
      return {
        ...client,
        invoices: filteredInvoices,
        totalDebt: filteredDebt
      };
    })
    .filter(client => client.invoices.length > 0)
    .sort((a, b) => b.totalDebt - a.totalDebt);

  const totalCobrar = clientDebts.reduce((sum, c) => sum + c.totalDebt, 0);

  // 2. Cuentas por Pagar (Supplier debts)
  const supplierDebts = entradas
    .filter(e => e.saldoAdeudado > 0)
    .filter(e => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        e.numeroFactura?.toLowerCase().includes(query) ||
        e.items?.some(i => i.producto?.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)); // Chronological order

  const totalPagar = supplierDebts.reduce((sum, e) => sum + e.saldoAdeudado, 0);

  // 3. Ventas por Vendedor (Sellers sales)
  const sellerMap = {};
  salidas.forEach(s => {
    const sName = s.vendedorName.trim();
    if (!sellerMap[sName]) {
      sellerMap[sName] = { name: sName, totalSales: 0, transactionsCount: 0 };
    }
    sellerMap[sName].totalSales += s.totalFactura;
    sellerMap[sName].transactionsCount += 1;
  });

  const sellerSales = Object.values(sellerMap)
    .filter(seller => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return seller.name.toLowerCase().includes(query);
    })
    .sort((a, b) => b.totalSales - a.totalSales);

  const totalVendido = sellerSales.reduce((sum, s) => sum + s.totalSales, 0);

  // 4. Ganancias y Pérdidas (Profit & Loss)
  // Calculate average cost for each (product, unit)
  const avgCostMap = {};
  entradas.forEach(ent => {
    if (ent.items) {
      ent.items.forEach(item => {
        if (!item.producto) return;
        const name = item.producto.trim().toLowerCase();
        const unit = item.unidad.trim().toLowerCase();
        const key = `${name}|${unit}`;
        if (!avgCostMap[key]) {
          avgCostMap[key] = { totalQty: 0, totalCost: 0 };
        }
        avgCostMap[key].totalQty += item.cantidad || 0;
        avgCostMap[key].totalCost += item.totalItem || 0;
      });
    }
  });

  const getAverageCost = (product, unit) => {
    if (!product) return 0;
    const name = product.trim().toLowerCase();
    const u = unit ? unit.trim().toLowerCase() : "";
    const key = `${name}|${u}`;
    const data = avgCostMap[key];
    if (data && data.totalQty > 0) {
      return data.totalCost / data.totalQty;
    }
    // Fallback: search for any unit of this product
    for (let k in avgCostMap) {
      if (k.startsWith(`${name}|`)) {
        const d = avgCostMap[k];
        if (d.totalQty > 0) {
          return d.totalCost / d.totalQty;
        }
      }
    }
    return 0;
  };

  const salesPL = salidas.map(sal => {
    let totalCost = 0;
    const itemsWithCost = (sal.items || []).map(item => {
      const avgCost = getAverageCost(item.producto, item.unidad);
      const costTotal = item.cantidad * avgCost;
      const profit = item.totalItem - costTotal;
      const margin = item.totalItem > 0 ? (profit / item.totalItem) * 100 : 0;
      totalCost += costTotal;
      return {
        ...item,
        avgCost,
        costTotal,
        profit,
        margin
      };
    });

    const totalRevenue = sal.totalFactura || 0;
    const netProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      ...sal,
      itemsWithCost,
      totalCost,
      netProfit,
      margin
    };
  });

  // Filter sales P&L by dates and search query
  const filteredSalesPL = salesPL.filter(s => {
    // Search query filter
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || 
      s.numeroFactura.toLowerCase().includes(query) ||
      s.clienteName.toLowerCase().includes(query) ||
      s.vendedorName.toLowerCase().includes(query) ||
      s.itemsWithCost.some(i => i.producto.toLowerCase().includes(query));

    // Date range filter
    const matchesStartDate = !startDate || s.fecha >= startDate;
    const matchesEndDate = !endDate || s.fecha <= endDate;

    return matchesQuery && matchesStartDate && matchesEndDate;
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // newest sales first

  const totalRevenuePL = filteredSalesPL.reduce((sum, s) => sum + s.totalFactura, 0);
  const totalCostPL = filteredSalesPL.reduce((sum, s) => sum + s.totalCost, 0);
  const totalProfitPL = totalRevenuePL - totalCostPL;
  const overallMarginPL = totalRevenuePL > 0 ? (totalProfitPL / totalRevenuePL) * 100 : 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Reportes y Balances</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Balances de deudas, cuentas por cobrar y rendimiento de ventas por vendedor
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }} className="no-print">
          <button className="btn btn-secondary" onClick={loadData}>
            Recargar Datos
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleExportPDF}
            disabled={pdfGenerating}
            style={{ 
              background: pdfGenerating ? "#4b5563" : "var(--accent-gradient)", 
              boxShadow: pdfGenerating ? "none" : "0 4px 15px rgba(99, 102, 241, 0.3)",
              cursor: pdfGenerating ? "not-allowed" : "pointer"
            }}
          >
            {pdfGenerating ? "Generando PDF..." : "Exportar PDF"}
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="no-print" style={{ display: "flex", gap: "1rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "1px", marginBottom: "1rem" }}>
        <button 
          className={`btn ${activeTab === "cobrar" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("cobrar")}
          style={{ borderRadius: "10px 10px 0 0", borderBottom: "none" }}
        >
          Cuentas por Cobrar (${totalCobrar.toFixed(2)})
        </button>
        <button 
          className={`btn ${activeTab === "pagar" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("pagar")}
          style={{ borderRadius: "10px 10px 0 0", borderBottom: "none" }}
        >
          Cuentas por Pagar (${totalPagar.toFixed(2)})
        </button>
        <button 
          className={`btn ${activeTab === "vendedores" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("vendedores")}
          style={{ borderRadius: "10px 10px 0 0", borderBottom: "none" }}
        >
          Ventas por Vendedor (${totalVendido.toFixed(2)})
        </button>
        <button 
          className={`btn ${activeTab === "ganancias" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("ganancias")}
          style={{ borderRadius: "10px 10px 0 0", borderBottom: "none" }}
        >
          Ganancias y Pérdidas (${totalProfitPL >= 0 ? "+" : ""}${totalProfitPL.toFixed(2)})
        </button>
      </div>

      {!loading && (
        <div className="no-print" style={{ 
          marginBottom: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          {/* Search bar */}
          <div style={{ 
            display: "flex",
            width: "100%",
            maxWidth: "360px",
            position: "relative",
            alignItems: "center"
          }}>
            <Search size={18} style={{ 
              position: "absolute", 
              left: "12px", 
              color: "var(--text-secondary)",
              pointerEvents: "none"
            }} />
            <input 
              type="text" 
              placeholder={
                activeTab === "cobrar" ? "Buscar por cliente o factura..." : 
                activeTab === "pagar" ? "Buscar por factura o producto..." : 
                activeTab === "ganancias" ? "Buscar factura, cliente o producto..." :
                "Buscar por vendedor..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 2.5rem 0.6rem 2.5rem",
                borderRadius: "10px",
                border: "1px solid var(--card-border)",
                background: "var(--card-bg)",
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                outline: "none",
                transition: "border-color 0.2s"
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Date range filters */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Desde:</span>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: "0.45rem 0.6rem",
                  borderRadius: "8px",
                  border: "1px solid var(--card-border)",
                  background: "var(--card-bg)",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem",
                  width: "auto"
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Hasta:</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: "0.45rem 0.6rem",
                  borderRadius: "8px",
                  border: "1px solid var(--card-border)",
                  background: "var(--card-bg)",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem",
                  width: "auto"
                }}
              />
            </div>
            {(startDate || endDate) && (
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => { setStartDate(""); setEndDate(""); }}
                style={{ padding: "0.45rem 0.75rem" }}
              >
                Limpiar Fechas
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>Generando reportes...</p>
      ) : (
        <>
          {/* TAB 1: CUENTAS POR COBRAR (CLIENTS) */}
          {activeTab === "cobrar" && (
            <div className="card">
              <div className="card-header-flex">
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Cuentas por Cobrar (Clientes)</h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                    Clientes que tienen facturas de despacho pendientes por pagar
                  </p>
                </div>
                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "0.5rem 1rem", borderRadius: "10px", color: "var(--success)", fontWeight: 700 }}>
                  Total por Cobrar: ${totalCobrar.toFixed(2)}
                </div>
              </div>

              {clientDebts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                  <CheckCircle size={32} style={{ color: "var(--success)", marginBottom: "0.5rem" }} />
                  <p>¡Excelente! No hay cuentas pendientes por cobrar de ningún cliente.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Facturas Pendientes</th>
                        <th>Deuda Consolidada ($)</th>
                        <th style={{ width: "80px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientDebts.map((client, idx) => {
                        const isExpanded = expandedClients[client.name];
                        return (
                          <React.Fragment key={idx}>
                            <tr 
                              className="expandable-row" 
                              onClick={() => toggleClientExpand(client.name)}
                            >
                              <td style={{ fontWeight: 600 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <Users size={16} style={{ color: "var(--accent-light)" }} />
                                  {client.name}
                                </span>
                              </td>
                              <td>{client.invoices.length} factura(s)</td>
                              <td>
                                <span className="badge danger" style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                                  ${client.totalDebt.toFixed(2)}
                                </span>
                              </td>
                              <td>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan="4" style={{ background: "rgba(0,0,0,0.05)", padding: "1.25rem" }}>
                                  <div className="expanded-details-box">
                                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.5rem" }}>
                                      Facturas Adeudadas por el Cliente:
                                    </p>
                                    <table className="invoice-items-table">
                                      <thead>
                                        <tr>
                                          <th>Fecha</th>
                                          <th>Factura / Guía #</th>
                                          <th>Monto Total ($)</th>
                                          <th>Saldo Adeudado ($)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {client.invoices.map((inv) => (
                                          <tr key={inv.id}>
                                            <td style={{ fontSize: "0.8rem" }}>
                                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <Calendar size={12} style={{ color: "var(--text-muted)" }} />
                                                {inv.fecha}
                                              </span>
                                            </td>
                                            <td style={{ fontSize: "0.8rem" }}>
                                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <FileText size={12} style={{ color: "var(--text-muted)" }} />
                                                {inv.invoiceNumber}
                                              </span>
                                            </td>
                                            <td style={{ fontSize: "0.8rem" }}>${inv.total.toFixed(2)}</td>
                                            <td style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--danger)" }}>
                                              ${inv.remaining.toFixed(2)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CUENTAS POR PAGAR (SUPPLIERS) */}
          {activeTab === "pagar" && (
            <div className="card">
              <div className="card-header-flex">
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Cuentas por Pagar (Proveedores)</h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                    Facturas de entradas de mercancía ingresadas que aún deben dinero
                  </p>
                </div>
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "0.5rem 1rem", borderRadius: "10px", color: "var(--danger)", fontWeight: 700 }}>
                  Deuda General: ${totalPagar.toFixed(2)}
                </div>
              </div>

              {supplierDebts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                  <CheckCircle size={32} style={{ color: "var(--success)", marginBottom: "0.5rem" }} />
                  <p>¡Excelente! No tienes deudas pendientes con ningún proveedor.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha Factura</th>
                        <th>Número Factura</th>
                        <th>Productos / Items</th>
                        <th>Total Facturado ($)</th>
                        <th>Saldo Adeudado ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierDebts.map((ent, idx) => {
                        return (
                          <tr key={idx}>
                            <td>
                              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
                                <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                                {ent.fecha}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FileText size={14} style={{ color: "var(--text-muted)" }} />
                                {ent.numeroFactura}
                              </span>
                            </td>
                            <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {ent.items?.map(i => `${i.cantidad} ${i.unidad}(s) de ${i.producto}`).join(", ")}
                            </td>
                            <td>${ent.totalFactura.toFixed(2)}</td>
                            <td>
                              <span className="badge danger" style={{ fontWeight: 700 }}>
                                ${ent.saldoAdeudado.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VENTAS POR VENDEDOR */}
          {activeTab === "vendedores" && (
            <div className="card">
              <div className="card-header-flex">
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Reporte de Ventas por Vendedor</h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                    Total vendido acumulado por cada despachador/vendedor en el sistema
                  </p>
                </div>
                <div style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.2)", padding: "0.5rem 1rem", borderRadius: "10px", color: "var(--accent-light)", fontWeight: 700 }}>
                  Total Ventas: ${totalVendido.toFixed(2)}
                </div>
              </div>

              {sellerSales.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                  <Inbox size={32} style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }} />
                  <p>No se han registrado ventas en el sistema para calcular reportes.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre del Vendedor</th>
                        <th>Despachos Realizados</th>
                        <th>Total Facturado ($)</th>
                        <th>Porcentaje de Ventas (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellerSales.map((seller, idx) => {
                        const percent = totalVendido > 0 ? (seller.totalSales / totalVendido) * 100 : 0;
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <UserCheck size={16} style={{ color: "var(--accent-light)" }} />
                                {seller.name}
                              </span>
                            </td>
                            <td>{seller.transactionsCount} despacho(s)</td>
                            <td style={{ fontWeight: 700, color: "var(--success)" }}>
                              ${seller.totalSales.toFixed(2)}
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <span style={{ width: "45px", textAlign: "right", fontSize: "0.85rem" }}>{percent.toFixed(1)}%</span>
                                <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                                  <div style={{ width: `${percent}%`, height: "100%", background: "var(--accent-gradient)" }}></div>
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
          )}

          {/* TAB 4: GANANCIAS Y PÉRDIDAS */}
          {activeTab === "ganancias" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Metrics Grid */}
              <div className="metrics-grid">
                <div className="card metric-card">
                  <div className="metric-icon-box success">
                    <DollarSign size={24} />
                  </div>
                  <div className="metric-content">
                    <h3>Ingresos Totales (Ventas)</h3>
                    <div className="value" style={{ color: "var(--success)" }}>
                      ${totalRevenuePL.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon-box danger">
                    <DollarSign size={24} />
                  </div>
                  <div className="metric-content">
                    <h3>Costos de Compra Estimados</h3>
                    <div className="value" style={{ color: "var(--danger)" }}>
                      ${totalCostPL.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className={`metric-icon-box ${totalProfitPL >= 0 ? "success" : "danger"}`}>
                    {totalProfitPL >= 0 ? <TrendingUp size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div className="metric-content">
                    <h3>{totalProfitPL >= 0 ? "Ganancia Neta" : "Pérdida Neta"}</h3>
                    <div className="value" style={{ color: totalProfitPL >= 0 ? "var(--success)" : "var(--danger)" }}>
                      ${totalProfitPL.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="card metric-card">
                  <div className="metric-icon-box accent">
                    <BarChart3 size={24} />
                  </div>
                  <div className="metric-content">
                    <h3>Margen de Utilidad</h3>
                    <div className="value">
                      {overallMarginPL.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="card">
                <div className="card-header-flex">
                  <div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Balance General de Utilidades</h2>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      Desglose de rentabilidad por cada factura de despacho de mercancía
                    </p>
                  </div>
                </div>

                {filteredSalesPL.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                    <Inbox size={32} style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }} />
                    <p>No se encontraron registros de despachos con los filtros actuales.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Factura / Guía</th>
                          <th>Cliente</th>
                          <th>Vendedor</th>
                          <th>Ingreso (Venta)</th>
                          <th>Costo Compra</th>
                          <th>Ganancia</th>
                          <th>Margen</th>
                          <th style={{ width: "60px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSalesPL.map((sal) => {
                          const isExpanded = expandedClients[sal.id];
                          const hasProfit = sal.netProfit >= 0;
                          return (
                            <React.Fragment key={sal.id}>
                              <tr 
                                className="expandable-row"
                                onClick={() => {
                                  setExpandedClients(prev => ({
                                    ...prev,
                                    [sal.id]: !prev[sal.id]
                                  }));
                                }}
                              >
                                <td>
                                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                                    {sal.fecha}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600 }}>{sal.numeroFactura}</span>
                                </td>
                                <td>{sal.clienteName}</td>
                                <td>{sal.vendedorName}</td>
                                <td>${sal.totalFactura.toFixed(2)}</td>
                                <td style={{ color: "var(--text-secondary)" }}>${sal.totalCost.toFixed(2)}</td>
                                <td style={{ fontWeight: 700, color: hasProfit ? "var(--success)" : "var(--danger)" }}>
                                  ${sal.netProfit.toFixed(2)}
                                </td>
                                <td>
                                  <span className={`badge ${hasProfit ? "success" : "danger"}`}>
                                    {sal.margin.toFixed(1)}%
                                  </span>
                                </td>
                                <td>
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan="9" style={{ background: "rgba(0,0,0,0.05)", padding: "1.25rem" }}>
                                    <div className="expanded-details-box">
                                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.5rem" }}>
                                        Detalle de Costos e Ingresos por Producto:
                                      </p>
                                      <table className="invoice-items-table">
                                        <thead>
                                          <tr>
                                            <th>Producto</th>
                                            <th>Cantidad</th>
                                            <th>Costo Prom. Compra</th>
                                            <th>Precio de Venta</th>
                                            <th>Costo Total</th>
                                            <th>Venta Total</th>
                                            <th>Ganancia Ítem</th>
                                            <th>Margen</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {sal.itemsWithCost.map((item, itemIdx) => {
                                            const itemHasProfit = item.profit >= 0;
                                            return (
                                              <tr key={itemIdx}>
                                                <td style={{ fontWeight: 600 }}>{item.producto}</td>
                                                <td>{item.cantidad} {item.unidad}(s)</td>
                                                <td>
                                                  {item.avgCost > 0 ? (
                                                    `$${item.avgCost.toFixed(2)}`
                                                  ) : (
                                                    <span style={{ color: "var(--warning)", fontWeight: 500 }} title="Sin facturas de compra registradas">
                                                      $0.00 ⚠️
                                                    </span>
                                                  )}
                                                </td>
                                                <td>${item.precioUnitario.toFixed(2)}</td>
                                                <td>${item.costTotal.toFixed(2)}</td>
                                                <td>${item.totalItem.toFixed(2)}</td>
                                                <td style={{ fontWeight: 700, color: itemHasProfit ? "var(--success)" : "var(--danger)" }}>
                                                  ${item.profit.toFixed(2)}
                                                </td>
                                                <td>
                                                  <span className={`badge ${itemHasProfit ? "success" : "danger"}`} style={{ fontSize: "0.75rem" }}>
                                                    {item.margin.toFixed(1)}%
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                      {sal.itemsWithCost.some(i => i.avgCost === 0) && (
                                        <p style={{ fontSize: "0.75rem", color: "var(--warning)", display: "flex", alignItems: "center", gap: "4px", marginTop: "0.5rem" }}>
                                          <AlertCircle size={12} />
                                          <span>Nota: El símbolo ⚠️ indica que el producto no tiene entradas registradas de compra, por lo que su costo se asume como $0.00 para la estimación.</span>
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Contenedor del PDF fuera de pantalla para exportación limpia */}
      <div style={{ height: 0, overflow: "hidden", position: "absolute", pointerEvents: "none" }}>
        <div id="pdf-report-content" style={{
          width: "750px",
          padding: "0",
          backgroundColor: "#ffffff",
          color: "#1f2937",
          fontFamily: "Arial, sans-serif",
          boxSizing: "border-box"
        }}>

          {/* ENCABEZADO OSCURO */}
          <div style={{ backgroundColor: "#1e2a3a", padding: "28px 35px 22px 35px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "#ffffff", marginBottom: "4px" }}>
                  SISTEMA DE INVENTARIO
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {activeTab === "cobrar" && "Control de Cuentas por Cobrar — Clientes"}
                  {activeTab === "pagar" && "Control de Cuentas por Pagar — Proveedores"}
                  {activeTab === "vendedores" && "Reporte de Rendimiento — Ventas por Vendedor"}
                  {activeTab === "ganancias" && "Reporte de Ganancias y Pérdidas (P&L)"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "4px" }}>Fecha de Emisión</div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#e2e8f0" }}>
                  {new Date().toLocaleDateString("es-VE", { year: "numeric", month: "long", day: "numeric" })}
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
                  {new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })} hrs
                </div>
              </div>
            </div>
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", gap: "24px" }}>
              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>
                <span style={{ color: "#94a3b8" }}>Total General: </span>
                <span style={{ color: "#ffffff", fontWeight: "700" }}>
                  {activeTab === "cobrar" && `$${totalCobrar.toFixed(2)}`}
                  {activeTab === "pagar" && `$${totalPagar.toFixed(2)}`}
                  {activeTab === "vendedores" && `$${totalVendido.toFixed(2)}`}
                  {activeTab === "ganancias" && `$${totalProfitPL.toFixed(2)} (Utilidad)`}
                </span>
              </span>
              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>
                <span style={{ color: "#94a3b8" }}>Registros: </span>
                <span style={{ color: "#ffffff", fontWeight: "700" }}>
                  {activeTab === "cobrar" && clientDebts.length}
                  {activeTab === "pagar" && supplierDebts.length}
                  {activeTab === "vendedores" && sellerSales.length}
                  {activeTab === "ganancias" && filteredSalesPL.length}
                </span>
              </span>
              {(startDate || endDate) && (
                <span style={{ fontSize: "11px", color: "#cbd5e1" }}>
                  <span style={{ color: "#94a3b8" }}>Período: </span>
                  <span style={{ color: "#ffffff", fontWeight: "700" }}>
                    {startDate || "Inicio"} al {endDate || "Fin"}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* CONTENIDO */}
          <div style={{ padding: "28px 35px" }}>

            {/* COBRAR */}
            {activeTab === "cobrar" && (
              <div>
                {clientDebts.length === 0 ? (
                  <p style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>No hay cuentas pendientes.</p>
                ) : (
                  clientDebts.map((client, idx) => (
                    <div key={idx} style={{ marginBottom: "22px", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden", pageBreakInside: "avoid" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1e2a3a", padding: "8px 14px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff" }}>👤 {client.name}</span>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#ffffff", backgroundColor: "#dc2626", padding: "2px 10px", borderRadius: "4px" }}>
                          Saldo: ${client.totalDebt.toFixed(2)}
                        </span>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#06b6d4" }}>
                            <th style={{ padding: "7px 14px", fontWeight: "700", color: "#ffffff", textAlign: "left", fontSize: "10px", textTransform: "uppercase" }}>Fecha</th>
                            <th style={{ padding: "7px 14px", fontWeight: "700", color: "#ffffff", textAlign: "left", fontSize: "10px", textTransform: "uppercase" }}>Factura / Guía #</th>
                            <th style={{ padding: "7px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>Monto Total ($)</th>
                            <th style={{ padding: "7px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>Saldo Adeudado ($)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {client.invoices.map((inv, invIdx) => (
                            <tr key={inv.id} style={{ borderBottom: invIdx === client.invoices.length - 1 ? "none" : "1px solid #f1f5f9", backgroundColor: invIdx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                              <td style={{ padding: "7px 14px", color: "#475569" }}>{inv.fecha}</td>
                              <td style={{ padding: "7px 14px", color: "#0f172a", fontWeight: "500" }}>{inv.invoiceNumber}</td>
                              <td style={{ padding: "7px 14px", color: "#475569", textAlign: "right" }}>${inv.total.toFixed(2)}</td>
                              <td style={{ padding: "7px 14px", color: "#dc2626", fontWeight: "700", textAlign: "right" }}>${inv.remaining.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}
                {clientDebts.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                    <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 18px", textAlign: "right" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Total General por Cobrar</div>
                      <div style={{ fontSize: "20px", fontWeight: "800", color: "#dc2626", marginTop: "2px" }}>${totalCobrar.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PAGAR */}
            {activeTab === "pagar" && (
              <div>
                {supplierDebts.length === 0 ? (
                  <p style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>No hay deudas pendientes con proveedores.</p>
                ) : (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#06b6d4" }}>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "left", fontSize: "10px", textTransform: "uppercase" }}>Fecha</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "left", fontSize: "10px", textTransform: "uppercase" }}>Factura #</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "left", fontSize: "10px", textTransform: "uppercase" }}>Productos</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>Total ($)</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>Saldo ($)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierDebts.map((ent, idx) => (
                          <tr key={idx} style={{ borderBottom: idx === supplierDebts.length - 1 ? "none" : "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                            <td style={{ padding: "7px 14px", color: "#475569" }}>{ent.fecha}</td>
                            <td style={{ padding: "7px 14px", color: "#0f172a", fontWeight: "600" }}>{ent.numeroFactura}</td>
                            <td style={{ padding: "7px 14px", color: "#475569", fontSize: "10px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {ent.items?.map(i => `${i.cantidad} ${i.unidad}(s) de ${i.producto}`).join(", ")}
                            </td>
                            <td style={{ padding: "7px 14px", color: "#475569", textAlign: "right" }}>${ent.totalFactura.toFixed(2)}</td>
                            <td style={{ padding: "7px 14px", color: "#dc2626", fontWeight: "700", textAlign: "right" }}>${ent.saldoAdeudado.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {supplierDebts.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                    <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 18px", textAlign: "right" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Total por Pagar</div>
                      <div style={{ fontSize: "20px", fontWeight: "800", color: "#dc2626", marginTop: "2px" }}>${totalPagar.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VENDEDORES */}
            {activeTab === "vendedores" && (
              <div>
                {sellerSales.length === 0 ? (
                  <p style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>No hay ventas registradas.</p>
                ) : (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#06b6d4" }}>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "left", fontSize: "10px", textTransform: "uppercase" }}>Vendedor</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "center", fontSize: "10px", textTransform: "uppercase" }}>Despachos</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>Total Facturado ($)</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>% de Ventas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sellerSales.map((seller, idx) => {
                          const percent = totalVendido > 0 ? (seller.totalSales / totalVendido) * 100 : 0;
                          return (
                            <tr key={idx} style={{ borderBottom: idx === sellerSales.length - 1 ? "none" : "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                              <td style={{ padding: "8px 14px", color: "#0f172a", fontWeight: "600" }}>{seller.name}</td>
                              <td style={{ padding: "8px 14px", color: "#475569", textAlign: "center" }}>{seller.transactionsCount}</td>
                              <td style={{ padding: "8px 14px", color: "#166534", fontWeight: "700", textAlign: "right" }}>${seller.totalSales.toFixed(2)}</td>
                              <td style={{ padding: "8px 14px", color: "#0f172a", fontWeight: "600", textAlign: "right" }}>{percent.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {sellerSales.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                    <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 18px", textAlign: "right" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>Total Ventas Acumuladas</div>
                      <div style={{ fontSize: "20px", fontWeight: "800", color: "#166534", marginTop: "2px" }}>${totalVendido.toFixed(2)}</div>
                    </div>
                  </div>
                )}
            {/* GANANCIAS Y PÉRDIDAS */}
            {activeTab === "ganancias" && (
              <div>
                {filteredSalesPL.length === 0 ? (
                  <p style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>No hay registros de utilidades para este período.</p>
                ) : (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#06b6d4" }}>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "left", fontSize: "10px", textTransform: "uppercase" }}>Fecha</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "left", fontSize: "10px", textTransform: "uppercase" }}>Factura #</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "left", fontSize: "10px", textTransform: "uppercase" }}>Cliente</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>Venta ($)</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>Costo ($)</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>Utilidad ($)</th>
                          <th style={{ padding: "9px 14px", fontWeight: "700", color: "#ffffff", textAlign: "right", fontSize: "10px", textTransform: "uppercase" }}>Margen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSalesPL.map((sal, idx) => (
                          <tr key={sal.id} style={{ borderBottom: idx === filteredSalesPL.length - 1 ? "none" : "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                            <td style={{ padding: "7px 14px", color: "#475569" }}>{sal.fecha}</td>
                            <td style={{ padding: "7px 14px", color: "#0f172a", fontWeight: "600" }}>{sal.numeroFactura}</td>
                            <td style={{ padding: "7px 14px", color: "#475569" }}>{sal.clienteName}</td>
                            <td style={{ padding: "7px 14px", color: "#475569", textAlign: "right" }}>${sal.totalFactura.toFixed(2)}</td>
                            <td style={{ padding: "7px 14px", color: "#64748b", textAlign: "right" }}>${sal.totalCost.toFixed(2)}</td>
                            <td style={{ padding: "7px 14px", color: sal.netProfit >= 0 ? "#166534" : "#dc2626", fontWeight: "700", textAlign: "right" }}>
                              ${sal.netProfit.toFixed(2)}
                            </td>
                            <td style={{ padding: "7px 14px", color: sal.netProfit >= 0 ? "#166534" : "#dc2626", fontWeight: "600", textAlign: "right" }}>
                              {sal.margin.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {filteredSalesPL.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "15px", gap: "10px" }}>
                    <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 14px", textAlign: "right" }}>
                      <div style={{ fontSize: "9px", color: "#64748b", fontWeight: "600" }}>Ingreso Acumulado</div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>${totalRevenuePL.toFixed(2)}</div>
                    </div>
                    <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 14px", textAlign: "right" }}>
                      <div style={{ fontSize: "9px", color: "#64748b", fontWeight: "600" }}>Costo Acumulado</div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#64748b" }}>${totalCostPL.toFixed(2)}</div>
                    </div>
                    <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 14px", textAlign: "right" }}>
                      <div style={{ fontSize: "9px", color: "#64748b", fontWeight: "600" }}>Ganancia Neta</div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: totalProfitPL >= 0 ? "#166534" : "#dc2626" }}>${totalProfitPL.toFixed(2)} ({overallMarginPL.toFixed(1)}%)</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

          </div>

          {/* PIE DE PÁGINA */}
          <div style={{ backgroundColor: "#1e2a3a", padding: "12px 35px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "9px", color: "#64748b" }}>Documento generado automáticamente — Sistema de Inventario</span>
            <span style={{ fontSize: "9px", color: "#64748b" }}>{new Date().toLocaleDateString("es-VE")} · Confidencial</span>
          </div>

        </div>
      </div>
    </>
  );
}
