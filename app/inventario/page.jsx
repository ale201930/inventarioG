// app/inventario/page.jsx — Gestión de Inventario 100% fluido sin parpadeos
'use client';
import { useEffect, useState } from 'react';

export default function InventarioPage() {
  const [productos, setProductos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre:'', cantidad:0, costoUnitario:0, precioVenta1:0, precioVenta2:0, precioVenta3:0 });
  
  // Estado para edición rápida de precios en la misma tabla
  const [inlinePrices, setInlinePrices] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedSuccessId, setSavedSuccessId] = useState(null);

  const load = () => {
    fetch('/api/inventario')
      .then(r => r.json())
      .then(d => { if (d.success) { setProductos(d.data); setFiltered(d.data); } })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? productos.filter(p => p.nombre.toLowerCase().includes(q) || (p.codigo_producto||'').toLowerCase().includes(q)) : productos);
  }, [search, productos]);

  const handleQuickPriceChange = (id, field, val) => {
    setInlinePrices(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: val
      }
    }));
  };

  const handleQuickPriceSave = async (p) => {
    const edits = inlinePrices[p.id];
    if (!edits) return;
    setSavingId(p.id);
    try {
      const payload = {
        id: p.id,
        nombre: p.nombre,
        cantidad: p.cantidad,
        costoUnitario: edits.costo_unitario !== undefined ? edits.costo_unitario : p.costo_unitario,
        precioVenta1: edits.precio_venta1 !== undefined ? edits.precio_venta1 : p.precio_venta1,
        precioVenta2: edits.precio_venta2 !== undefined ? edits.precio_venta2 : p.precio_venta2,
        precioVenta3: edits.precio_venta3 !== undefined ? edits.precio_venta3 : p.precio_venta3,
      };
      const res = await fetch('/api/inventario', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const d = await res.json();
      if (d.success) {
        setInlinePrices(prev => {
          const copy = { ...prev };
          delete copy[p.id];
          return copy;
        });
        setSavedSuccessId(p.id);
        setTimeout(() => setSavedSuccessId(null), 2500);
        load();
      } else alert(d.error);
    } finally {
      setSavingId(null);
    }
  };

  const openNew = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setEditing(null);
    setForm({ nombre:'', cantidad:0, costoUnitario:0, precioVenta1:0, precioVenta2:0, precioVenta3:0 });
    setShowModal(true);
  };
  const openEdit = (p, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setEditing(p);
    setForm({ nombre:p.nombre, cantidad:p.cantidad, costoUnitario:p.costo_unitario, precioVenta1:p.precio_venta1, precioVenta2:p.precio_venta2, precioVenta3:p.precio_venta3 });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const method = editing ? 'PUT' : 'POST';
    const body = { ...form, id: editing?.id };
    const res = await fetch('/api/inventario', { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const d = await res.json();
    if (d.success) { setShowModal(false); load(); } else alert(d.error);
  };

  const handleDelete = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    const res = await fetch(`/api/inventario?id=${p.id}`, { method:'DELETE' });
    const d = await res.json();
    if (d.success) load(); else alert(d.error);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="fa-solid fa-box" style={{color:'var(--primary)'}}></i> Gestión de Inventario</h1>
          <p className="page-subtitle">Listado de productos, existencias en almacén y edición directa de precios individuales ($)</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}><i className="fa-solid fa-plus"></i> Nuevo Producto</button>
      </div>

      {/* Barra de Búsqueda */}
      <div className="card" style={{marginBottom:'1.5rem', padding:'1rem'}}>
        <div style={{display:'flex', gap:'1rem', alignItems:'center'}}>
          <i className="fa-solid fa-magnifying-glass" style={{color:'var(--text-muted)'}}></i>
          <input type="text" className="form-control" placeholder="Buscar producto por nombre..." style={{border:'none', boxShadow:'none'}} value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      {/* Tabla */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th style={{minWidth:110}}>Costo Compra ($)</th>
              <th style={{minWidth:110}}>Precio 1 ($)</th>
              <th style={{minWidth:110}}>Precio 2 ($)</th>
              <th style={{minWidth:110}}>Precio 3 ($)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{textAlign:'center', padding:'2.5rem', color:'var(--text-muted)'}}>
                {search ? 'Sin resultados para la búsqueda' : 'Sin productos en inventario'}
              </td></tr>
            ) : filtered.map(p => {
              const hasEdits = !!inlinePrices[p.id];
              const curCosto = inlinePrices[p.id]?.costo_unitario !== undefined ? inlinePrices[p.id].costo_unitario : p.costo_unitario;
              const curP1 = inlinePrices[p.id]?.precio_venta1 !== undefined ? inlinePrices[p.id].precio_venta1 : p.precio_venta1;
              const curP2 = inlinePrices[p.id]?.precio_venta2 !== undefined ? inlinePrices[p.id].precio_venta2 : p.precio_venta2;
              const curP3 = inlinePrices[p.id]?.precio_venta3 !== undefined ? inlinePrices[p.id].precio_venta3 : p.precio_venta3;
              const isSaving = savingId === p.id;
              const isSaved = savedSuccessId === p.id;

              return (
                <tr key={p.id} style={{background: hasEdits ? '#eff6ff' : 'transparent'}}>
                  <td>
                    <div style={{fontWeight:600, fontSize:'0.9rem'}}>{p.nombre}</div>
                    {p.codigo_producto && <div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>{p.codigo_producto}</div>}
                  </td>
                  <td>
                    <span className={`badge ${Number(p.cantidad)<=0?'badge-danger':Number(p.cantidad)<5?'badge-warning':'badge-success'}`}>
                      {p.cantidad} uds
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'0.2rem'}}>
                      <span style={{fontSize:'0.85rem', color:'#64748b'}}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        style={{width:80, fontSize:'0.85rem', padding:'0.25rem 0.4rem', fontWeight:600}}
                        value={curCosto}
                        onChange={e=>handleQuickPriceChange(p.id, 'costo_unitario', e.target.value)}
                        onKeyDown={e=>{ if (e.key === 'Enter') handleQuickPriceSave(p); }}
                      />
                    </div>
                  </td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'0.2rem'}}>
                      <span style={{fontSize:'0.85rem', color:'#0284c7'}}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        style={{width:80, fontSize:'0.85rem', padding:'0.25rem 0.4rem', fontWeight:700, borderColor:'#38bdf8', color:'#0284c7'}}
                        value={curP1}
                        onChange={e=>handleQuickPriceChange(p.id, 'precio_venta1', e.target.value)}
                        onKeyDown={e=>{ if (e.key === 'Enter') handleQuickPriceSave(p); }}
                      />
                    </div>
                  </td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'0.2rem'}}>
                      <span style={{fontSize:'0.85rem', color:'#0284c7'}}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        style={{width:80, fontSize:'0.85rem', padding:'0.25rem 0.4rem', fontWeight:700, borderColor:'#38bdf8', color:'#0284c7'}}
                        value={curP2}
                        onChange={e=>handleQuickPriceChange(p.id, 'precio_venta2', e.target.value)}
                        onKeyDown={e=>{ if (e.key === 'Enter') handleQuickPriceSave(p); }}
                      />
                    </div>
                  </td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'0.2rem'}}>
                      <span style={{fontSize:'0.85rem', color:'#0284c7'}}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        style={{width:80, fontSize:'0.85rem', padding:'0.25rem 0.4rem', fontWeight:700, borderColor:'#38bdf8', color:'#0284c7'}}
                        value={curP3}
                        onChange={e=>handleQuickPriceChange(p.id, 'precio_venta3', e.target.value)}
                        onKeyDown={e=>{ if (e.key === 'Enter') handleQuickPriceSave(p); }}
                      />
                    </div>
                  </td>
                  <td>
                    <div style={{display:'flex', gap:'0.4rem', alignItems:'center'}}>
                      {hasEdits && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{background:'#16a34a', borderColor:'#16a34a', fontSize:'0.75rem', padding:'0.3rem 0.5rem'}}
                          onClick={()=>handleQuickPriceSave(p)}
                          disabled={isSaving}
                          title="Guardar precios modificados"
                        >
                          {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-floppy-disk"></i> Guardar</>}
                        </button>
                      )}
                      {isSaved && (
                        <span style={{color:'#16a34a', fontSize:'0.75rem', fontWeight:700}}>✓ Guardado</span>
                      )}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={(e)=>openEdit(p, e)} title="Editar todos los datos"><i className="fa-solid fa-pen"></i></button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={()=>handleDelete(p)} title="Eliminar"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:550}}>
            <div className="modal-header">
              <h2>{editing ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button type="button" className="modal-close" onClick={()=>setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nombre del Producto</label>
                <input type="text" className="form-control" placeholder="Ej: Lucky Cosmic 20 Cig x 10 Cajetillas" required value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} />
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
                <div className="form-group">
                  <label className="form-label">Cantidad / Stock</label>
                  <input type="number" className="form-control" min="0" required value={form.cantidad} onChange={e=>setForm({...form,cantidad:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Costo de Compra ($)</label>
                  <input type="number" step="0.01" className="form-control" min="0" required value={form.costoUnitario} onChange={e=>setForm({...form,costoUnitario:e.target.value})} />
                </div>
              </div>
              <div style={{background:'#f8fafc', border:'1px solid #cbd5e1', borderRadius:6, padding:'0.75rem', marginTop:'0.5rem', marginBottom:'1rem'}}>
                <h4 style={{fontSize:'0.8rem', fontWeight:700, color:'var(--primary)', textTransform:'uppercase', marginBottom:'0.5rem'}}>Precios de Venta de Salida</h4>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem'}}>
                  {[1,2,3].map(n => (
                    <div className="form-group" key={n} style={{margin:0}}>
                      <label className="form-label" style={{fontSize:'0.75rem'}}>Precio {n} ($)</label>
                      <input type="number" step="0.01" className="form-control" min="0" placeholder="0.00"
                        value={form[`precioVenta${n}`]}
                        onChange={e=>setForm({...form,[`precioVenta${n}`]:e.target.value})} />
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{width:'100%'}}>Guardar Producto</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
