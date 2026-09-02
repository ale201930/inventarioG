"use client";
import React, { useState, useEffect } from "react";
import { 
  getSalidas, 
  addSalida, 
  getAbonosSalidas, 
  addAbonoSalida, 
  updateSalidaTotal,
  updateAbonoSalida,
  getEntradas,
  deleteSalida,
  deleteAbonoSalida
} from "@/lib/dbService";
import { 
  Plus, 
  DollarSign, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  CreditCard, 
  Calendar,
  Layers,
  FileText,
  Search,
  CheckCircle,
  User,
  Trash2,
  AlertTriangle,
  Pencil
} from "lucide-react";

export default function SalidasPage() {
  const [salidas, setSalidas] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Expandable row states
  const [expandedRows, setExpandedRows] = useState({});

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showEditTotalModal, setShowEditTotalModal] = useState(false);
  const [selectedSalida, setSelectedSalida] = useState(null);

  // Custom UI notification states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [salidaToDelete, setSalidaToDelete] = useState(null);
  const [showDeleteAbonoConfirm, setShowDeleteAbonoConfirm] = useState(false);
  const [abonoToDelete, setAbonoToDelete] = useState(null);
  const [showEditAbonoModal, setShowEditAbonoModal] = useState(false);
  const [abonoToEdit, setAbonoToEdit] = useState(null);
  const [editAbonoFecha, setEditAbonoFecha] = useState("");
  const [editAbonoRef, setEditAbonoRef] = useState("");
  const [editAbonoVES, setEditAbonoVES] = useState("");
  const [editAbonoUSD, setEditAbonoUSD] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // New Salida Form State
  const [newInvoiceNumber, setNewInvoiceNumber] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newClientName, setNewClientName] = useState("");
  const [newSellerName, setNewSellerName] = useState("");
  const [newItems, setNewItems] = useState([
    { producto: "", cantidad: 1, unidad: "bulto", precioUnitario: 0, totalItem: 0 }
  ]);
  const [customTotalChecked, setCustomTotalChecked] = useState(false);
  const [customTotalValue, setCustomTotalValue] = useState("");

  // New Abono Form State
  const [abonoClientName, setAbonoClientName] = useState("");
  const [abonoDate, setAbonoDate] = useState(new Date().toISOString().split("T")[0]);
  const [abonoRef, setAbonoRef] = useState("");
  const [abonoVES, setAbonoVES] = useState("");
  const [abonoUSD, setAbonoUSD] = useState("");

  // Edit Total Form State
  const [editTotalValue, setEditTotalValue] = useState("");

  // Product Autocomplete
  const [allProducts, setAllProducts] = useState([]);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Registered clients and sellers for dropdowns
  const [registeredClients, setRegisteredClients] = useState([]);
  const [registeredSellers, setRegisteredSellers] = useState([]);
  const [newClientInput, setNewClientInput] = useState("");
  const [newSellerInput, setNewSellerInput] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const salList = await getSalidas();
      const abList = await getAbonosSalidas();
      setSalidas(salList);
      setAbonos(abList);

      // Collect product names from inputs to suggest them for sales
      const entList = await getEntradas();
      const products = new Set();
      entList.forEach(e => {
        if (e.items) {
          e.items.forEach(item => {
            if (item.producto) products.add(item.producto.trim());
          });
        }
      });
      // Also check existing sales for product names
      salList.forEach(s => {
        if (s.items) {
          s.items.forEach(item => {
            if (item.producto) products.add(item.producto.trim());
          });
        }
      });
      setAllProducts(Array.from(products));

      // Collect registered clients and sellers from existing salidas
      const clients = new Set();
      const sellers = new Set();
      salList.forEach(s => {
        if (s.clienteName?.trim()) clients.add(s.clienteName.trim());
        if (s.vendedorName?.trim()) sellers.add(s.vendedorName.trim());
      });
      setRegisteredClients(Array.from(clients).sort());
      setRegisteredSellers(Array.from(sellers).sort());

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Dynamic row changes — fix: editing totalItem only updates totalItem (not precioUnitario displayed)
  const handleItemChange = (index, field, value) => {
    const updated = [...newItems];
    updated[index] = { ...updated[index] };
    updated[index][field] = value;

    if (field === "cantidad" || field === "precioUnitario") {
      // cantidad or price changed → recalculate total
      const qty = parseFloat(updated[index].cantidad) || 0;
      const price = parseFloat(updated[index].precioUnitario) || 0;
      updated[index].totalItem = parseFloat((qty * price).toFixed(2));
    } else if (field === "totalItem") {
      // totalItem changed → only update total, do NOT change precioUnitario
      const total = parseFloat(value) || 0;
      updated[index].totalItem = total;
      // Do NOT modify precioUnitario here to avoid the bug
    }
    setNewItems(updated);
  };

  const addItemRow = () => {
    setNewItems([
      ...newItems,
      { producto: "", cantidad: 1, unidad: "bulto", precioUnitario: 0, totalItem: 0 }
    ]);
  };

  const removeItemRow = (index) => {
    if (newItems.length > 1) {
      setNewItems(newItems.filter((_, idx) => idx !== index));
    }
  };

  // Total invoice calculations
  const calculatedSubtotal = newItems.reduce((sum, item) => sum + (parseFloat(item.totalItem) || 0), 0);
  const finalInvoiceTotal = customTotalChecked 
    ? (parseFloat(customTotalValue) || 0) 
    : calculatedSubtotal;

  const handleAddSalidaSubmit = async (e) => {
    e.preventDefault();

    try {
      // Resolve actual client/seller names
      const resolvedClient = newClientName === "__nuevo__" ? newClientInput.trim() : newClientName.trim();
      const resolvedSeller = newSellerName === "__nuevo__" ? newSellerInput.trim() : newSellerName.trim();

      if (!resolvedClient || !resolvedSeller) {
        alert("Por favor ingresa el cliente y el vendedor");
        return;
      }

      const invoiceData = {
        numeroFactura: newInvoiceNumber || "DESP-" + Math.floor(1000 + Math.random() * 9000),
        fecha: newDate,
        clienteName: resolvedClient,
        vendedorName: resolvedSeller,
        totalFactura: finalInvoiceTotal,
        items: newItems.map(item => ({
          ...item,
          cantidad: parseFloat(item.cantidad) || 0,
          precioUnitario: parseFloat(item.precioUnitario) || 0,
          totalItem: parseFloat(item.totalItem) || 0
        }))
      };

      await addSalida(invoiceData);
      setShowAddModal(false);
      resetAddForm();
      await loadData();
    } catch (err) {
      alert("Error al registrar salida: " + err.message);
    }
  };

  const resetAddForm = () => {
    setNewInvoiceNumber("");
    setNewDate(new Date().toISOString().split("T")[0]);
    setNewClientName("");
    setNewSellerName("");
    setNewClientInput("");
    setNewSellerInput("");
    setNewItems([{ producto: "", cantidad: 1, unidad: "bulto", precioUnitario: 0, totalItem: 0 }]);
    setCustomTotalChecked(false);
    setCustomTotalValue("");
  };

  // List of clients with unpaid debt
  const clientsWithDebt = Array.from(
    salidas.reduce((acc, s) => {
      if (s.saldoAdeudado > 0) {
        const cName = s.clienteName.trim();
        acc.set(cName, (acc.get(cName) || 0) + s.saldoAdeudado);
      }
      return acc;
    }, new Map())
  ).map(([name, debt]) => ({ name, debt }));

  const handleOpenAbono = (clientName = "") => {
    setAbonoClientName(clientName);
    setAbonoUSD("");
    setAbonoVES("");
    setAbonoRef("");
    setAbonoDate(new Date().toISOString().split("T")[0]);
    setShowAbonoModal(true);
  };

  const handleAddAbonoSubmit = async (e) => {
    e.preventDefault();
    if (!abonoClientName) {
      alert("Por favor selecciona un cliente");
      return;
    }

    const usd = parseFloat(abonoUSD) || 0;
    if (usd <= 0) {
      alert("El monto en dólares debe ser mayor a 0");
      return;
    }

    const targetClient = clientsWithDebt.find(c => c.name === abonoClientName);
    if (targetClient && usd > targetClient.debt) {
      alert(`El abono ($${usd}) no puede superar la deuda total de este cliente ($${targetClient.debt.toFixed(2)})`);
      return;
    }

    try {
      await addAbonoSalida({
        clienteName: abonoClientName,
        fecha: abonoDate,
        referencia: abonoRef,
        montoVES: parseFloat(abonoVES) || 0,
        montoUSD: usd
      });
      setShowAbonoModal(false);
      await loadData();
    } catch (err) {
      alert("Error al registrar abono: " + err.message);
    }
  };

  const handleOpenEditTotal = (salida) => {
    setSelectedSalida(salida);
    setEditTotalValue(salida.totalFactura.toString());
    setShowEditTotalModal(true);
  };

  const handleEditTotalSubmit = async (e) => {
    e.preventDefault();
    const newTotal = parseFloat(editTotalValue) || 0;
    if (newTotal < 0) {
      alert("El total no puede ser negativo");
      return;
    }

    try {
      await updateSalidaTotal(selectedSalida.id, newTotal);
      setShowEditTotalModal(false);
      await loadData();
    } catch (err) {
      alert("Error al modificar total: " + err.message);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type });
    }, 3000);
  };

  const handleDeleteSalida = (salida) => {
    setSalidaToDelete(salida);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteSalida = async () => {
    if (!salidaToDelete) return;
    setLoading(true);
    try {
      await deleteSalida(salidaToDelete.id);
      setShowDeleteConfirm(false);
      setSalidaToDelete(null);
      await loadData();
      showToast("Factura/Despacho de salida eliminado con éxito");
    } catch (err) {
      showToast("Error al eliminar la salida: " + err.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  // Delete abono handlers
  const handleDeleteAbono = (abono) => {
    setAbonoToDelete(abono);
    setShowDeleteAbonoConfirm(true);
  };

  const handleConfirmDeleteAbono = async () => {
    if (!abonoToDelete) return;
    setLoading(true);
    try {
      await deleteAbonoSalida(abonoToDelete.id, abonoToDelete.clienteName, abonoToDelete.montoUSD);
      setShowDeleteAbonoConfirm(false);
      setAbonoToDelete(null);
      await loadData();
      showToast("Abono eliminado con éxito. El saldo del cliente fue actualizado.");
    } catch (err) {
      showToast("Error al eliminar el abono: " + err.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditAbono = (abono) => {
    setAbonoToEdit(abono);
    setEditAbonoFecha(abono.fecha);
    setEditAbonoRef(abono.referencia || "");
    setEditAbonoVES(abono.montoVES?.toString() || "");
    setEditAbonoUSD(abono.montoUSD?.toString() || "");
    setShowEditAbonoModal(true);
  };

  const handleEditAbonoSubmit = async (e) => {
    e.preventDefault();
    const usd = parseFloat(editAbonoUSD) || 0;
    if (usd <= 0) { showToast("El monto debe ser mayor a 0", "danger"); return; }
    setLoading(true);
    try {
      await updateAbonoSalida(abonoToEdit.id, abonoToEdit.clienteName, {
        fecha: editAbonoFecha,
        referencia: editAbonoRef,
        montoVES: parseFloat(editAbonoVES) || 0,
        montoUSD: usd,
      });
      setShowEditAbonoModal(false);
      setAbonoToEdit(null);
      await loadData();
      showToast("Abono actualizado con éxito.");
    } catch (err) {
      showToast("Error al editar el abono: " + err.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  // Product Autocomplete suggests
  const filteredProducts = (inputVal) => {
    if (!inputVal) return allProducts;
    return allProducts.filter(p => 
      p.toLowerCase().includes(inputVal.toLowerCase())
    );
  };

  const selectSuggestion = (index, value) => {
    const updated = [...newItems];
    updated[index].producto = value;
    setNewItems(updated);
    setShowSuggestions(false);
    setActiveItemIndex(null);
  };

  // Search filter
  const filteredSalidas = salidas.filter(sal => 
    sal.numeroFactura.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sal.clienteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sal.vendedorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sal.items?.some(i => i.producto.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalCuentasPorCobrar = salidas.reduce((sum, s) => sum + (s.saldoAdeudado || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Salidas / Despachos</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Registro de despachos de mercancía, ventas y abonos de clientes
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {clientsWithDebt.length > 0 && (
            <button className="btn btn-success" onClick={() => handleOpenAbono("")}>
              <CreditCard size={18} />
              <span>Abono de Cliente</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            <span>Registrar Salida</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-icon-box success">
            <DollarSign size={24} />
          </div>
          <div className="metric-content">
            <h3>Cuentas por Cobrar Clientes</h3>
            <div className="value" style={{ color: "var(--success)" }}>
              ${totalCuentasPorCobrar.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="card metric-card">
          <div className="metric-icon-box accent">
            <Layers size={24} />
          </div>
          <div className="metric-content">
            <h3>Total Despachos Realizados</h3>
            <div className="value">{salidas.length}</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card">
        <div className="card-header-flex">
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Registro de Despachos</h2>
          <div style={{ position: "relative", width: "100%", maxWidth: "300px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input 
              type="text" 
              placeholder="Buscar por factura, cliente, vendedor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", fontSize: "0.85rem" }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>Cargando registros...</p>
        ) : filteredSalidas.length === 0 ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No se encontraron despachos.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Factura / Guía</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Total Factura ($)</th>
                  <th>Saldo Deuda ($)</th>
                  <th style={{ textAlign: "center" }}>Acciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSalidas.map((sal) => {
                  const isExpanded = expandedRows[sal.id];
                  const hasDebt = sal.saldoAdeudado > 0;
                  const paid = Math.max(0, sal.totalFactura - sal.saldoAdeudado);
                  
                  // Get this client's overall debt
                  const clientTotalDebt = salidas
                    .filter(s => s.clienteName.toLowerCase().trim() === sal.clienteName.toLowerCase().trim())
                    .reduce((sum, s) => sum + s.saldoAdeudado, 0);

                  return (
                    <React.Fragment key={sal.id}>
                      <tr 
                        className="expandable-row" 
                        onClick={() => toggleExpandRow(sal.id)}
                      >
                        <td>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
                            <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                            {sal.fecha}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FileText size={14} style={{ color: "var(--text-muted)" }} />
                            {sal.numeroFactura}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", maxWidth: "160px", width: "100%" }}>
                            <User size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }} title={sal.clienteName}>{sal.clienteName}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ display: "block", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }} title={sal.vendedorName}>{sal.vendedorName}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span>${(sal.totalFactura || 0).toFixed(2)}</span>
                            <button 
                              className="btn-icon" 
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditTotal(sal);
                              }}
                              title="Modificar Total Factura"
                            >
                              <Edit3 size={12} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${hasDebt ? "danger" : "success"}`}>
                            ${(sal.saldoAdeudado || 0).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                            {hasDebt ? (
                              <button 
                                className="btn btn-success btn-sm"
                                onClick={() => handleOpenAbono(sal.clienteName)}
                              >
                                <CreditCard size={14} />
                                <span>Abonar</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.8rem", color: "var(--success)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <CheckCircle size={14} /> Saldado
                              </span>
                            )}
                            <button
                              className="btn btn-danger btn-sm btn-icon"
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px", border: "none", cursor: "pointer" }}
                              onClick={() => handleDeleteSalida(sal)}
                              title="Eliminar Salida"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                        <td>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="8" style={{ background: "rgba(0,0,0,0.05)", padding: "1.5rem" }}>
                            <div className="expanded-details-box">
                              <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.25rem" }}>
                                Detalles del Despacho
                              </h4>
                              
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "1rem" }}>
                                <div>
                                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.25rem" }}>Productos Entregados:</p>
                                  <ul style={{ paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
                                    {sal.items?.map((item, idx) => (
                                      <li key={idx} style={{ marginBottom: "0.25rem" }}>
                                        <strong>{item.cantidad} {item.unidad}(s)</strong> de {item.producto} @ ${item.precioUnitario.toFixed(2)} c/u (Total: ${item.totalItem.toFixed(2)})
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.25rem" }}>Resumen de Cobro:</p>
                                  <p style={{ fontSize: "0.85rem" }}>Monto Facturado (ajustado): <strong>${(sal.totalFactura || 0).toFixed(2)}</strong></p>
                                  <p style={{ fontSize: "0.85rem" }}>Abonado en esta Factura: <strong style={{ color: "var(--success)" }}>${paid.toFixed(2)}</strong></p>
                                  <p style={{ fontSize: "0.85rem" }}>Saldo en esta Factura: <strong style={{ color: "var(--danger)" }}>${(sal.saldoAdeudado || 0).toFixed(2)}</strong></p>
                                  <p style={{ fontSize: "0.85rem", borderTop: "1px dashed var(--card-border)", marginTop: "0.5rem", paddingTop: "0.5rem" }}>
                                    Deuda Total del Cliente (todas las facturas): <strong style={{ color: "var(--danger)" }}>${clientTotalDebt.toFixed(2)}</strong>
                                  </p>
                                </div>
                              </div>

                              <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.25rem" }}>
                                Historial de Abonos Recibidos de {sal.clienteName}
                              </h4>
                              
                              {abonos.filter(a => a.clienteName.toLowerCase().trim() === sal.clienteName.toLowerCase().trim()).length === 0 ? (
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No se han registrado abonos generales para este cliente.</p>
                              ) : (
                                <table className="invoice-items-table" style={{ marginTop: "0.5rem" }}>
                                  <thead>
                                    <tr>
                                      <th>Fecha Pago</th>
                                      <th>Referencia de Transacción</th>
                                      <th>Monto Bs. (Informativo)</th>
                                      <th>Monto USD ($)</th>
                                      <th style={{ textAlign: "center" }}>Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {abonos
                                      .filter(a => a.clienteName.toLowerCase().trim() === sal.clienteName.toLowerCase().trim())
                                      .map((ab) => (
                                        <tr key={ab.id}>
                                          <td style={{ fontSize: "0.8rem" }}>{ab.fecha}</td>
                                          <td style={{ fontSize: "0.8rem" }}>{ab.referencia || "Sin ref."}</td>
                                          <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Bs. {ab.montoVES?.toLocaleString()}</td>
                                          <td style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--success)" }}>${ab.montoUSD?.toFixed(2)}</td>
                                          <td style={{ textAlign: "center" }}>
                                            <div className="abono-actions">
                                              <button
                                                className="btn-icon"
                                                style={{ background: "none", border: "none", color: "var(--accent-light)", cursor: "pointer", padding: "4px" }}
                                                onClick={(e) => { e.stopPropagation(); handleOpenEditAbono(ab); }}
                                                title="Editar este abono"
                                              >
                                                <Pencil size={13} />
                                              </button>
                                              <button
                                                className="btn-icon"
                                                style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "4px" }}
                                                onClick={(e) => { e.stopPropagation(); handleDeleteAbono(ab); }}
                                                title="Eliminar este abono"
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))
                                    }
                                  </tbody>
                                </table>
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

      {/* --- MODAL REGISTRAR SALIDA --- */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "1100px" }}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Registrar Salida / Despacho</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><ChevronDown size={20} /></button>
            </div>
            <form onSubmit={handleAddSalidaSubmit}>
              <div className="modal-body">
                <div className="form-group inline-two">
                  <div className="form-group">
                    <label htmlFor="salInv">Número de Factura / Guía (Opcional)</label>
                    <input 
                      id="salInv" 
                      type="text" 
                      placeholder="Autogenerado si se deja vacío" 
                      value={newInvoiceNumber} 
                      onChange={(e) => setNewInvoiceNumber(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="salDate">Fecha de Despacho</label>
                    <input 
                      id="salDate" 
                      type="date" 
                      value={newDate} 
                      onChange={(e) => setNewDate(e.target.value)} 
                      required 
                    />
                  </div>
                </div>

                <div className="form-group inline-two">
                  <div className="form-group">
                    <label htmlFor="salClient">Nombre del Cliente</label>
                    {registeredClients.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <select
                          id="salClientSelect"
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                        >
                          <option value="">-- Seleccionar cliente registrado --</option>
                          {registeredClients.map((c, i) => (
                            <option key={i} value={c}>{c}</option>
                          ))}
                          <option value="__nuevo__">+ Ingresar nuevo cliente...</option>
                        </select>
                        {newClientName === "__nuevo__" && (
                          <input
                            id="salClient"
                            type="text"
                            placeholder="Nombre del nuevo cliente"
                            value={newClientInput}
                            onChange={(e) => setNewClientInput(e.target.value)}
                            required
                            autoFocus
                          />
                        )}
                        {newClientName !== "__nuevo__" && newClientName === "" && (
                          <input
                            id="salClientFallback"
                            type="text"
                            placeholder="O escribe el nombre del cliente"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            required
                          />
                        )}
                      </div>
                    ) : (
                      <input 
                        id="salClient" 
                        type="text" 
                        placeholder="Ej. Distribuidora Gómez" 
                        value={newClientName} 
                        onChange={(e) => setNewClientName(e.target.value)} 
                        required 
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="salSeller">Nombre del Vendedor</label>
                    {registeredSellers.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <select
                          id="salSellerSelect"
                          value={newSellerName}
                          onChange={(e) => setNewSellerName(e.target.value)}
                        >
                          <option value="">-- Seleccionar vendedor registrado --</option>
                          {registeredSellers.map((s, i) => (
                            <option key={i} value={s}>{s}</option>
                          ))}
                          <option value="__nuevo__">+ Ingresar nuevo vendedor...</option>
                        </select>
                        {newSellerName === "__nuevo__" && (
                          <input
                            id="salSeller"
                            type="text"
                            placeholder="Nombre del nuevo vendedor"
                            value={newSellerInput}
                            onChange={(e) => setNewSellerInput(e.target.value)}
                            required
                            autoFocus
                          />
                        )}
                        {newSellerName !== "__nuevo__" && newSellerName === "" && (
                          <input
                            id="salSellerFallback"
                            type="text"
                            placeholder="O escribe el nombre del vendedor"
                            value={newSellerName}
                            onChange={(e) => setNewSellerName(e.target.value)}
                            required
                          />
                        )}
                      </div>
                    ) : (
                      <input 
                        id="salSeller" 
                        type="text" 
                        placeholder="Ej. Carlos Pérez" 
                        value={newSellerName} 
                        onChange={(e) => setNewSellerName(e.target.value)} 
                        required 
                      />
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontWeight: 600 }}>Ítems a Despachar</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                    Agregar Item
                  </button>
                </div>

                <div className="table-container" style={{ border: "1px solid var(--card-border)", borderRadius: "8px", marginBottom: "1rem" }}>
                  <table style={{ minWidth: "600px" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "30%" }}>Producto / Descripción</th>
                        <th style={{ width: "15%" }}>Unidad</th>
                        <th style={{ width: "15%" }}>Cant.</th>
                        <th style={{ width: "20%" }}>Precio Unit. ($)</th>
                        <th style={{ width: "20%" }}>Total ($)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newItems.map((item, idx) => {
                        const suggestions = filteredProducts(item.producto);
                        return (
                          <tr key={idx}>
                            <td style={{ verticalAlign: "top" }}>
                              <div className="autocomplete-wrapper">
                                <input 
                                  type="text" 
                                  placeholder="Nombre del producto"
                                  value={item.producto}
                                  onChange={(e) => {
                                    handleItemChange(idx, "producto", e.target.value);
                                    setActiveItemIndex(idx);
                                    setShowSuggestions(true);
                                  }}
                                  onFocus={() => {
                                    setActiveItemIndex(idx);
                                    setShowSuggestions(true);
                                  }}
                                  required
                                  style={{ padding: "0.85rem 0.65rem", fontSize: "1.05rem" }}
                                />
                                {showSuggestions && activeItemIndex === idx && suggestions.length > 0 && (
                                  <div className="suggestions-list">
                                    {suggestions.map((sug, sIdx) => (
                                      <div 
                                        key={sIdx} 
                                        className="suggestion-item"
                                        onClick={() => selectSuggestion(idx, sug)}
                                      >
                                        <span>{sug}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="unit-toggle-container">
                                <button 
                                  type="button"
                                  className={`unit-toggle-btn ${item.unidad === "bulto" ? "active" : ""}`}
                                  onClick={() => handleItemChange(idx, "unidad", "bulto")}
                                >
                                  Bulto
                                </button>
                                <button 
                                  type="button"
                                  className={`unit-toggle-btn ${item.unidad === "kg" ? "active" : ""}`}
                                  onClick={() => handleItemChange(idx, "unidad", "kg")}
                                >
                                  Kg
                                </button>
                              </div>
                            </td>
                            <td>
                               <input 
                                 type="number" 
                                 step="any"
                                 min="0.01"
                                 value={item.cantidad} 
                                 onChange={(e) => handleItemChange(idx, "cantidad", e.target.value)}
                                 required 
                                 style={{ padding: "0.85rem 0.65rem", fontSize: "1.05rem" }}
                               />
                             </td>
                             <td>
                               <input 
                                 type="number" 
                                 step="any"
                                 min="0"
                                 value={item.precioUnitario} 
                                 onChange={(e) => handleItemChange(idx, "precioUnitario", e.target.value)}
                                 required 
                                 style={{ padding: "0.85rem 0.65rem", fontSize: "1.05rem" }}
                               />
                             </td>
                             <td>
                               <input 
                                 type="number" 
                                 step="any"
                                 min="0"
                                 value={item.totalItem || ""} 
                                 onChange={(e) => handleItemChange(idx, "totalItem", e.target.value)}
                                 required 
                                 style={{ padding: "0.85rem 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}
                               />
                             </td>
                            <td>
                              {newItems.length > 1 && (
                                <button 
                                  type="button" 
                                  className="btn-icon" 
                                  style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}
                                  onClick={() => removeItemRow(idx)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Subtotals & Override Section */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid var(--card-border)", paddingTop: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Subtotal Calculado:</span>
                    <span style={{ fontWeight: 600 }}>${calculatedSubtotal.toFixed(2)}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--card-border)" }}>
                    <input 
                      id="customTotalCheck"
                      type="checkbox"
                      checked={customTotalChecked}
                      onChange={(e) => {
                        setCustomTotalChecked(e.target.checked);
                        if (e.target.checked) setCustomTotalValue(calculatedSubtotal.toString());
                      }}
                      style={{ width: "auto", marginTop: "3px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <label htmlFor="customTotalCheck" style={{ fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}>
                        Ajustar total del despacho (Redondeos)
                      </label>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Activa esta casilla para modificar el total final si difiere de la suma de los ítems.
                      </p>

                      {customTotalChecked && (
                        <div className="form-group" style={{ marginTop: "0.5rem", maxWidth: "200px" }}>
                          <label>Total Despacho Ajustado ($)</label>
                          <input 
                            type="number"
                            step="any"
                            value={customTotalValue}
                            onChange={(e) => setCustomTotalValue(e.target.value)}
                            required
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--card-border)", paddingTop: "0.5rem" }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>Total Final Despacho:</span>
                    <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--accent-light)" }}>
                      ${finalInvoiceTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Registrar Despacho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL REGISTRAR ABONO CLIENTE --- */}
      {showAbonoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Registrar Abono de Cliente</h2>
              <button className="close-btn" onClick={() => setShowAbonoModal(false)}><ChevronDown size={20} /></button>
            </div>
            <form onSubmit={handleAddAbonoSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="abClientSelect">Seleccione el Cliente</label>
                  <select 
                    id="abClientSelect" 
                    value={abonoClientName}
                    onChange={(e) => {
                      setAbonoClientName(e.target.value);
                      const cli = clientsWithDebt.find(c => c.name === e.target.value);
                      if (cli) setAbonoUSD(cli.debt.toFixed(2));
                    }}
                    required
                  >
                    <option value="">-- Seleccione un cliente con deuda --</option>
                    {clientsWithDebt.map((cli, idx) => (
                      <option key={idx} value={cli.name}>
                        {cli.name} (Debe: ${cli.debt.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {abonoClientName && (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                    La deuda total de este cliente es de <strong style={{ color: "var(--danger)" }}>${(clientsWithDebt.find(c => c.name === abonoClientName)?.debt || 0).toFixed(2)}</strong>. 
                    El abono se aplicará automáticamente a sus facturas pendientes más antiguas.
                  </p>
                )}

                <div className="form-group">
                  <label htmlFor="abDate">Fecha de Pago</label>
                  <input 
                    id="abDate" 
                    type="date" 
                    value={abonoDate} 
                    onChange={(e) => setAbonoDate(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="abUSD">Monto en Dólares ($) - Descuenta Deuda</label>
                  <input 
                    id="abUSD" 
                    type="number" 
                    step="any"
                    min="0.01"
                    value={abonoUSD} 
                    onChange={(e) => setAbonoUSD(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="abVES">Monto en Bolívares (VES) - Informativo</label>
                  <input 
                    id="abVES" 
                    type="number" 
                    step="any"
                    placeholder="Opcional"
                    value={abonoVES} 
                    onChange={(e) => setAbonoVES(e.target.value)} 
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="abRef">Referencia de Transacción</label>
                  <input 
                    id="abRef" 
                    type="text" 
                    placeholder="Ej. Transferencia #9876" 
                    value={abonoRef} 
                    onChange={(e) => setAbonoRef(e.target.value)} 
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAbonoModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={!abonoClientName}>
                  Registrar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR TOTAL SALIDA DIRECTAMENTE --- */}
      {showEditTotalModal && selectedSalida && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Ajustar Total: Factura/Despacho {selectedSalida.numeroFactura}</h2>
              <button className="close-btn" onClick={() => setShowEditTotalModal(false)}><ChevronDown size={20} /></button>
            </div>
            <form onSubmit={handleEditTotalSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  Modifica el valor total de este despacho. Las deudas y abonos del cliente se volverán a calcular para reflejar el cambio.
                </p>
                
                <div className="form-group">
                  <label>Monto Total Despacho ($)</label>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    value={editTotalValue} 
                    onChange={(e) => setEditTotalValue(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditTotalModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CUSTOM DELETE CONFIRMATION MODAL (Salida) --- */}
      {showDeleteConfirm && salidaToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px", padding: "2rem", textAlign: "center" }}>
            <div style={{ display: "inline-flex", padding: "1rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "50%", color: "var(--danger)", marginBottom: "1.25rem" }}>
              <AlertTriangle size={40} className="pulse-animation" />
            </div>
            
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-primary)" }}>
              ¿Confirmar Eliminación?
            </h2>
            
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "1.5rem" }}>
              Estás a punto de eliminar el despacho/factura <strong style={{ color: "var(--text-primary)" }}>{salidaToDelete.numeroFactura}</strong>. 
              Esta acción es irreversible, reajustará las deudas del cliente y actualizará el stock en el inventario.
            </p>
            
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSalidaToDelete(null);
                }}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleConfirmDeleteSalida}
                style={{ 
                  flex: 1, 
                  background: "var(--danger)", 
                  borderColor: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem"
                }}
                disabled={loading}
              >
                {loading ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM DELETE ABONO CONFIRMATION MODAL --- */}
      {showDeleteAbonoConfirm && abonoToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px", padding: "2rem", textAlign: "center" }}>
            <div style={{ display: "inline-flex", padding: "1rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "50%", color: "var(--danger)", marginBottom: "1.25rem" }}>
              <AlertTriangle size={40} className="pulse-animation" />
            </div>
            
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-primary)" }}>
              ¿Eliminar Abono?
            </h2>
            
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "1.5rem" }}>
              Eliminarás el abono de <strong style={{ color: "var(--success)" }}>${abonoToDelete.montoUSD?.toFixed(2)}</strong> del cliente <strong style={{ color: "var(--text-primary)" }}>{abonoToDelete.clienteName}</strong>.
              El saldo adeudado del cliente será incrementado nuevamente.
            </p>
            
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowDeleteAbonoConfirm(false);
                  setAbonoToDelete(null);
                }}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleConfirmDeleteAbono}
                style={{ 
                  flex: 1, 
                  background: "var(--danger)", 
                  borderColor: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem"
                }}
                disabled={loading}
              >
                {loading ? "Eliminando..." : "Sí, Eliminar Abono"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR ABONO SALIDA --- */}
      {showEditAbonoModal && abonoToEdit && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "420px" }}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Editar Abono — {abonoToEdit.clienteName}</h2>
              <button className="close-btn" onClick={() => setShowEditAbonoModal(false)}><ChevronDown size={20} /></button>
            </div>
            <form onSubmit={handleEditAbonoSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="eabDate">Fecha del Abono</label>
                  <input id="eabDate" type="date" value={editAbonoFecha} onChange={(e) => setEditAbonoFecha(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="eabUSD">Monto en Dólares ($)</label>
                  <input id="eabUSD" type="number" step="any" min="0.01" value={editAbonoUSD} onChange={(e) => setEditAbonoUSD(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="eabVES">Monto en Bolívares (Informativo)</label>
                  <input id="eabVES" type="number" step="any" placeholder="Opcional" value={editAbonoVES} onChange={(e) => setEditAbonoVES(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="eabRef">Referencia / Banco</label>
                  <input id="eabRef" type="text" placeholder="Ej. Transf. #1234" value={editAbonoRef} onChange={(e) => setEditAbonoRef(e.target.value)} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditAbonoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Guardando..." : "Guardar Cambios"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CUSTOM BEAUTIFUL TOAST --- */}
      {toast.show && (
        <div style={{
          position: "fixed",
          bottom: "2rem",
          right: "2rem",
          background: toast.type === "success" ? "var(--success)" : "var(--danger)",
          color: "white",
          padding: "1rem 1.5rem",
          borderRadius: "10px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          zIndex: 9999,
          animation: "slideIn 0.3s ease-out"
        }}>
          {toast.type === "success" ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{toast.message}</span>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .pulse-animation {
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
