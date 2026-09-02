"use client";
import React, { useState, useEffect } from "react";
import { 
  getEntradas, 
  addEntrada, 
  getAbonosEntradas, 
  addAbonoEntrada, 
  updateAbonoEntrada,
  deleteAbonoEntrada,
  updateEntradaTotal,
  deleteEntrada
} from "@/lib/dbService";
import { 
  Plus, 
  DollarSign, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  CreditCard, 
  Calendar,
  Layers,
  FileText,
  Search,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Pencil
} from "lucide-react";

export default function EntradasPage() {
  const [entradas, setEntradas] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Expandable row states
  const [expandedRows, setExpandedRows] = useState({});

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showEditTotalModal, setShowEditTotalModal] = useState(false);
  const [selectedEntrada, setSelectedEntrada] = useState(null);

  // Custom UI notification states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [entradaToDelete, setEntradaToDelete] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Edit/Delete Abono State
  const [showEditAbonoModal, setShowEditAbonoModal] = useState(false);
  const [abonoToEdit, setAbonoToEdit] = useState(null);
  const [editAbonoFecha, setEditAbonoFecha] = useState("");
  const [editAbonoRef, setEditAbonoRef] = useState("");
  const [editAbonoVES, setEditAbonoVES] = useState("");
  const [editAbonoUSD, setEditAbonoUSD] = useState("");
  const [showDeleteAbonoConfirm, setShowDeleteAbonoConfirm] = useState(false);
  const [abonoToDelete, setAbonoToDelete] = useState(null);

  // New Entrada Form State
  const [newInvoiceNumber, setNewInvoiceNumber] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newItems, setNewItems] = useState([
    { producto: "", cantidad: 1, unidad: "bulto", precioUnitario: 0, totalItem: 0 }
  ]);
  const [customTotalChecked, setCustomTotalChecked] = useState(false);
  const [customTotalValue, setCustomTotalValue] = useState("");
  
  // New Abono Form State
  const [abonoDate, setAbonoDate] = useState(new Date().toISOString().split("T")[0]);
  const [abonoRef, setAbonoRef] = useState("");
  const [abonoVES, setAbonoVES] = useState("");
  const [abonoUSD, setAbonoUSD] = useState("");

  // Edit Total Form State
  const [editTotalValue, setEditTotalValue] = useState("");

  // Product suggestions
  const [allProducts, setAllProducts] = useState([]);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const entList = await getEntradas();
      const abList = await getAbonosEntradas();
      setEntradas(entList);
      setAbonos(abList);

      // Collect unique product names for autocompletion
      const products = new Set();
      entList.forEach(e => {
        if (e.items) {
          e.items.forEach(item => {
            if (item.producto) products.add(item.producto.trim());
          });
        }
      });
      setAllProducts(Array.from(products));
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

  // Dynamic Item row updates
  const handleItemChange = (index, field, value) => {
    const updated = [...newItems];
    updated[index][field] = value;

    if (field === "cantidad" || field === "precioUnitario") {
      const qty = parseFloat(updated[index].cantidad) || 0;
      const price = parseFloat(updated[index].precioUnitario) || 0;
      updated[index].totalItem = parseFloat((qty * price).toFixed(2));
    } else if (field === "totalItem") {
      const total = parseFloat(value) || 0;
      const qty = parseFloat(updated[index].cantidad) || 0;
      updated[index].totalItem = total;
      if (qty > 0) {
        updated[index].precioUnitario = parseFloat((total / qty).toFixed(4));
      }
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

  // Calculations for new invoice
  const calculatedSubtotal = newItems.reduce((sum, item) => sum + (item.totalItem || 0), 0);
  const finalInvoiceTotal = customTotalChecked 
    ? (parseFloat(customTotalValue) || 0) 
    : calculatedSubtotal;

  const handleAddEntradaSubmit = async (e) => {
    e.preventDefault();
    try {
      const invoiceData = {
        numeroFactura: newInvoiceNumber,
        fecha: newDate,
        subtotal: calculatedSubtotal,
        totalFactura: finalInvoiceTotal,
        items: newItems.map(item => ({
          ...item,
          cantidad: parseFloat(item.cantidad) || 0,
          precioUnitario: parseFloat(item.precioUnitario) || 0,
          totalItem: parseFloat(item.totalItem) || 0
        }))
      };

      await addEntrada(invoiceData);
      setShowAddModal(false);
      resetAddForm();
      await loadData();
    } catch (err) {
      alert("Error al registrar entrada: " + err.message);
    }
  };

  const resetAddForm = () => {
    setNewInvoiceNumber("");
    setNewDate(new Date().toISOString().split("T")[0]);
    setNewItems([{ producto: "", cantidad: 1, unidad: "bulto", precioUnitario: 0, totalItem: 0 }]);
    setCustomTotalChecked(false);
    setCustomTotalValue("");
  };

  const handleOpenAbono = (entrada) => {
    setSelectedEntrada(entrada);
    setAbonoUSD(entrada.saldoAdeudado.toString());
    setAbonoVES("");
    setAbonoRef("");
    setAbonoDate(new Date().toISOString().split("T")[0]);
    setShowAbonoModal(true);
  };

  const handleAddAbonoSubmit = async (e) => {
    e.preventDefault();
    const usd = parseFloat(abonoUSD) || 0;
    if (usd <= 0) {
      alert("El monto en dólares debe ser mayor a 0");
      return;
    }
    if (usd > selectedEntrada.saldoAdeudado) {
      alert("El abono no puede exceder el saldo adeudado ($" + selectedEntrada.saldoAdeudado + ")");
      return;
    }

    try {
      await addAbonoEntrada({
        entradaId: selectedEntrada.id,
        numeroFactura: selectedEntrada.numeroFactura,
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

  const handleOpenEditTotal = (entrada) => {
    setSelectedEntrada(entrada);
    setEditTotalValue(entrada.totalFactura.toString());
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
      await updateEntradaTotal(selectedEntrada.id, newTotal);
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

  const handleDeleteEntrada = (entrada) => {
    setEntradaToDelete(entrada);
    setShowDeleteConfirm(true);
  };

  const handleOpenEditAbono = (abono) => {
    setAbonoToEdit(abono);
    setEditAbonoFecha(abono.fecha);
    setEditAbonoRef(abono.referencia || "");
    setEditAbonoVES(abono.montoVES?.toString() || "");
    setEditAbonoUSD(abono.montoUSD?.toString() || "");
    setShowEditAbonoModal(true);
  };

  const handleEditAbonoEntradaSubmit = async (e) => {
    e.preventDefault();
    const usd = parseFloat(editAbonoUSD) || 0;
    if (usd <= 0) { showToast("El monto debe ser mayor a 0", "danger"); return; }
    setLoading(true);
    try {
      await updateAbonoEntrada(abonoToEdit.id, abonoToEdit.entradaId, {
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

  const handleDeleteAbono = (abono) => {
    setAbonoToDelete(abono);
    setShowDeleteAbonoConfirm(true);
  };

  const handleConfirmDeleteAbono = async () => {
    if (!abonoToDelete) return;
    setLoading(true);
    try {
      await deleteAbonoEntrada(abonoToDelete.id, abonoToDelete.entradaId, abonoToDelete.montoUSD);
      setShowDeleteAbonoConfirm(false);
      setAbonoToDelete(null);
      await loadData();
      showToast("Abono eliminado. El saldo fue actualizado.");
    } catch (err) {
      showToast("Error al eliminar el abono: " + err.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteEntrada = async () => {
    if (!entradaToDelete) return;
    setLoading(true);
    try {
      await deleteEntrada(entradaToDelete.id);
      setShowDeleteConfirm(false);
      setEntradaToDelete(null);
      await loadData();
      showToast("Factura de entrada eliminada con éxito");
    } catch (err) {
      showToast("Error al eliminar la entrada: " + err.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  // Suggestion filters
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

  // Search filter for lists
  const filteredEntradas = entradas.filter(ent => 
    ent.numeroFactura.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ent.items?.some(i => i.producto.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalDeudaGeneral = entradas.reduce((sum, e) => sum + (e.saldoAdeudado || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Entradas de Inventario</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Registro cronológico de compras a proveedores y abonos
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} />
          <span>Nueva Entrada</span>
        </button>
      </div>

      {/* Summary Stat Card */}
      <div className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-icon-box danger">
            <DollarSign size={24} />
          </div>
          <div className="metric-content">
            <h3>Deuda General Proveedores</h3>
            <div className="value" style={{ color: "var(--danger)" }}>
              ${totalDeudaGeneral.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="card metric-card">
          <div className="metric-icon-box accent">
            <Layers size={24} />
          </div>
          <div className="metric-content">
            <h3>Total de Facturas Ingresadas</h3>
            <div className="value">{entradas.length}</div>
          </div>
        </div>
      </div>

      {/* Table section */}
      <div className="card">
        <div className="card-header-flex">
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Registro de Facturas</h2>
          <div style={{ position: "relative", width: "100%", maxWidth: "300px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input 
              type="text" 
              placeholder="Buscar por factura o ítem..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", fontSize: "0.85rem" }}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>Cargando registros...</p>
        ) : filteredEntradas.length === 0 ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No se encontraron facturas de entrada.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Factura #</th>
                  <th>Detalles de Ítems</th>
                  <th>Subtotal ($)</th>
                  <th>Total Factura ($)</th>
                  <th>Saldo Debe ($)</th>
                  <th style={{ textAlign: "center" }}>Acciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntradas.map((ent) => {
                  const isExpanded = expandedRows[ent.id];
                  const hasDebt = ent.saldoAdeudado > 0;
                  const paid = Math.max(0, ent.totalFactura - ent.saldoAdeudado);

                  return (
                    <React.Fragment key={ent.id}>
                      <tr 
                        className="expandable-row" 
                        onClick={() => toggleExpandRow(ent.id)}
                      >
                        <td style={{ fontWeight: 500 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                            {ent.fecha}
                          </span>
                        </td>
                        <td>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FileText size={14} style={{ color: "var(--text-muted)" }} />
                            {ent.numeroFactura}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ent.items?.map(i => `${i.cantidad} ${i.unidad}(s) de ${i.producto}`).join(", ")}
                        </td>
                        <td>${(ent.subtotal || 0).toFixed(2)}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span>${(ent.totalFactura || 0).toFixed(2)}</span>
                            <button 
                              className="btn-icon" 
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditTotal(ent);
                              }}
                              title="Modificar Total Factura"
                            >
                              <Edit3 size={12} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${hasDebt ? "danger" : "success"}`}>
                            ${(ent.saldoAdeudado || 0).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                            {hasDebt ? (
                              <button 
                                className="btn btn-success btn-sm"
                                onClick={() => handleOpenAbono(ent)}
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
                              onClick={() => handleDeleteEntrada(ent)}
                              title="Eliminar Entrada"
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
                                Detalles de la Factura
                              </h4>
                              
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "1rem" }}>
                                <div>
                                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.25rem" }}>Productos Ingresados:</p>
                                  <ul style={{ paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
                                    {ent.items?.map((item, idx) => (
                                      <li key={idx} style={{ marginBottom: "0.25rem" }}>
                                        <strong>{item.cantidad} {item.unidad}(s)</strong> de {item.producto} @ ${item.precioUnitario.toFixed(2)} c/u (Total: ${item.totalItem.toFixed(2)})
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "0.25rem" }}>Resumen de Saldos:</p>
                                  <p style={{ fontSize: "0.85rem" }}>Monto de Factura original (calculado): <strong>${(ent.subtotal || 0).toFixed(2)}</strong></p>
                                  <p style={{ fontSize: "0.85rem" }}>Monto Facturado (ajustado): <strong>${(ent.totalFactura || 0).toFixed(2)}</strong></p>
                                  <p style={{ fontSize: "0.85rem" }}>Total Abonado: <strong style={{ color: "var(--success)" }}>${paid.toFixed(2)}</strong></p>
                                  <p style={{ fontSize: "0.85rem" }}>Saldo Restante: <strong style={{ color: "var(--danger)" }}>${(ent.saldoAdeudado || 0).toFixed(2)}</strong></p>
                                </div>
                              </div>

                              <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.25rem" }}>
                                Historial de Abonos a esta Factura
                              </h4>
                              
                              {abonos.filter(a => a.entradaId === ent.id).length === 0 ? (
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No se han registrado abonos para esta factura.</p>
                              ) : (
                                <table className="invoice-items-table" style={{ marginTop: "0.5rem" }}>
                                  <thead>
                                    <tr>
                                      <th>Fecha Abono</th>
                                      <th>Referencia</th>
                                      <th>Monto Bs. (Informativo)</th>
                                      <th>Monto USD ($)</th>
                                      <th style={{ textAlign: "center" }}>Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {abonos.filter(a => a.entradaId === ent.id).map((ab) => (
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
                                    ))}
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

      {/* --- MODAL REGISTRAR ENTRADA --- */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "1100px" }}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Registrar Entrada de Mercancía</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><ChevronDown size={20} /></button>
            </div>
            <form onSubmit={handleAddEntradaSubmit}>
              <div className="modal-body">
                <div className="form-group inline-two">
                  <div className="form-group">
                    <label htmlFor="invNum">Número de Factura</label>
                    <input 
                      id="invNum" 
                      type="text" 
                      placeholder="Ej. FACT-0012" 
                      value={newInvoiceNumber} 
                      onChange={(e) => setNewInvoiceNumber(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="invDate">Fecha de Factura</label>
                    <input 
                      id="invDate" 
                      type="date" 
                      value={newDate} 
                      onChange={(e) => setNewDate(e.target.value)} 
                      required 
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontWeight: 600 }}>Ítems / Productos</label>
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

                {/* Subtotal & Override Total Section */}
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
                        Ajustar total de la factura (Redondeos)
                      </label>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Activa esta casilla para modificar el total final si difiere de la suma de los ítems.
                      </p>

                      {customTotalChecked && (
                        <div className="form-group" style={{ marginTop: "0.5rem", maxWidth: "200px" }}>
                          <label>Total Factura Ajustado ($)</label>
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
                    <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>Total Final Factura:</span>
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
                  Registrar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR ABONO ENTRADA --- */}
      {showEditAbonoModal && abonoToEdit && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "420px" }}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Editar Abono — Factura {abonoToEdit.numeroFactura}</h2>
              <button className="close-btn" onClick={() => setShowEditAbonoModal(false)}><ChevronDown size={20} /></button>
            </div>
            <form onSubmit={handleEditAbonoEntradaSubmit}>
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

      {/* --- MODAL CONFIRMAR ELIMINAR ABONO ENTRADA --- */}
      {showDeleteAbonoConfirm && abonoToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px", padding: "2rem", textAlign: "center" }}>
            <div style={{ display: "inline-flex", padding: "1rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "50%", color: "var(--danger)", marginBottom: "1.25rem" }}>
              <AlertTriangle size={40} className="pulse-animation" />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem" }}>¿Eliminar Abono?</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "1.5rem" }}>
              Eliminarás el abono de <strong style={{ color: "var(--success)" }}>${abonoToDelete.montoUSD?.toFixed(2)}</strong> de la factura <strong>{abonoToDelete.numeroFactura}</strong>. El saldo pendiente se incrementará.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowDeleteAbonoConfirm(false); setAbonoToDelete(null); }} style={{ flex: 1 }}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmDeleteAbono} style={{ flex: 1, background: "var(--danger)", borderColor: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }} disabled={loading}>
                {loading ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL REGISTRAR ABONO --- */}
      {showAbonoModal && selectedEntrada && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Registrar Abono a Factura {selectedEntrada.numeroFactura}</h2>
              <button className="close-btn" onClick={() => setShowAbonoModal(false)}><ChevronDown size={20} /></button>
            </div>
            <form onSubmit={handleAddAbonoSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  Monto total factura: <strong>${selectedEntrada.totalFactura.toFixed(2)}</strong><br />
                  Saldo adeudado actual: <strong style={{ color: "var(--danger)" }}>${selectedEntrada.saldoAdeudado.toFixed(2)}</strong>
                </p>

                <div className="form-group">
                  <label htmlFor="abDate">Fecha del Abono</label>
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
                    max={selectedEntrada.saldoAdeudado}
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
                  <label htmlFor="abRef">Referencia / Banco</label>
                  <input 
                    id="abRef" 
                    type="text" 
                    placeholder="Ej. Transf. Banesco #1234" 
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
                <button type="submit" className="btn btn-success">
                  Abonar Deuda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR TOTAL FACTURA DIRECTAMENTE --- */}
      {showEditTotalModal && selectedEntrada && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Ajustar Total: Factura {selectedEntrada.numeroFactura}</h2>
              <button className="close-btn" onClick={() => setShowEditTotalModal(false)}><ChevronDown size={20} /></button>
            </div>
            <form onSubmit={handleEditTotalSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  Puedes modificar el valor total cobrado/deudor de esta factura. El saldo pendiente se recalculará automáticamente restando los abonos ya registrados.
                </p>
                
                <div className="form-group">
                  <label>Monto Total Factura ($)</label>
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

      {/* --- CUSTOM DELETE CONFIRMATION MODAL --- */}
      {showDeleteConfirm && entradaToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px", padding: "2rem", textAlign: "center" }}>
            <div style={{ display: "inline-flex", padding: "1rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "50%", color: "var(--danger)", marginBottom: "1.25rem" }}>
              <AlertTriangle size={40} className="pulse-animation" />
            </div>
            
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-primary)" }}>
              ¿Confirmar Eliminación?
            </h2>
            
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "1.5rem" }}>
              Estás a punto de eliminar la factura <strong style={{ color: "var(--text-primary)" }}>{entradaToDelete.numeroFactura}</strong>. 
              Esta acción es irreversible, eliminará permanentemente sus abonos y reajustará el stock.
            </p>
            
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEntradaToDelete(null);
                }}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleConfirmDeleteEntrada}
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
