// app/salidas/page.jsx — Facturación y Despachos (idéntico a views/salidas.php + salidas_v2.js)
'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

function today() { return new Date().toISOString().split('T')[0]; }
const emptyItem = () => ({ productoId:'', productoNombre:'', precioOpcion:'1', cantidad:1, precioUnitario:0, subtotal:0 });

export default function SalidasPage() {
  const [salidas, setSalidas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [bcvTasa, setBcvTasa] = useState(798.33);
  const [showModal, setShowModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSalida, setLastSalida] = useState(null);
  const [estadoCuenta, setEstadoCuenta] = useState(null);
  const [selectedCliente, setSelectedCliente] = useState('');

  const [form, setForm] = useState({
    clienteName:'', cedulaRif:'', telefono:'', fecha:today(), direccion:'',
    vendedorName:'JUAN MORA', facturaNumber:'', observaciones:'',
    items:[emptyItem()]
  });
  const [abonoForm, setAbonoForm] = useState({ salidaId:'', clienteName:'', montoUSD:0, montoVES:0, referencia:'', fecha:today() });

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/salidas').then(r=>r.json()),
      fetch('/api/inventario').then(r=>r.json()),
      fetch('/api/salidas?action=clientes').then(r=>r.json()),
    ]).then(([sal, inv, cli]) => {
      if(sal.success) setSalidas(sal.data);
      if(inv.success) setProductos(inv.data);
      if(cli.success) setClientes(cli.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { fetch('/api/bcv').then(r=>r.json()).then(d => { if(d.success) setBcvTasa(d.data.tasaHoy); }); }, []);

  const filteredSalidas = salidas.filter(s => {
    const q = searchText.toLowerCase();
    const matchText = !q || s.cliente_name.toLowerCase().includes(q) || (s.factura_number||'').includes(q);
    const matchFecha = !filterFecha || s.fecha === filterFecha;
    return matchText && matchFecha;
  });

  const selectProduct = (i, prodId) => {
    const prod = productos.find(p=>p.id===prodId);
    if (!prod) return;
    const precio = parseFloat(form.items[i]?.precioOpcion === '2' ? prod.precio_venta2 : form.items[i]?.precioOpcion === '3' ? prod.precio_venta3 : prod.precio_venta1) || 0;
    const cant = parseInt(form.items[i]?.cantidad||1);
    updateItem(i, { productoId:prod.id, productoNombre:prod.nombre, precioUnitario:precio, subtotal:cant*precio });
  };

  const updateItem = (i, patch) => {
    const items = [...form.items];
    items[i] = { ...items[i], ...patch };
    if ('cantidad' in patch || 'precioUnitario' in patch) {
      items[i].subtotal = parseInt(items[i].cantidad||0) * parseFloat(items[i].precioUnitario||0);
    }
    setForm(f => ({...f, items}));
  };

  const selectPrecio = (i, opcion) => {
    if (opcion === 'custom') {
      updateItem(i, { precioOpcion: 'custom' });
      return;
    }
    const prod = productos.find(p=>p.id===form.items[i]?.productoId);
    if (!prod) { updateItem(i,{precioOpcion:opcion}); return; }
    const precio = parseFloat(opcion==='2'?prod.precio_venta2:opcion==='3'?prod.precio_venta3:prod.precio_venta1)||0;
    const cant = parseInt(form.items[i]?.cantidad||1);
    updateItem(i, {precioOpcion:opcion, precioUnitario:precio, subtotal:cant*precio});
  };

  const totalFactura = form.items.reduce((s,it)=>s+parseFloat(it.subtotal||0),0);
  const totalUnidades = form.items.reduce((s,it)=>s+parseInt(it.cantidad||0),0);

  const handleSave = async (printTicket) => {
    setSaving(true);
    try {
      const payload = {
        clienteName:form.clienteName, cedulaRif:form.cedulaRif, telefono:form.telefono,
        direccion:form.direccion, vendedorName:form.vendedorName, facturaNumber:form.facturaNumber,
        fecha:form.fecha, observaciones:form.observaciones,
        items: form.items.filter(it=>it.productoId&&parseInt(it.cantidad||0)>0).map(it=>({
          productoId:it.productoId, productoNombre:it.productoNombre,
          cantidad:parseInt(it.cantidad), precioUnitario:parseFloat(it.precioUnitario||0)
        }))
      };
      const res = await fetch('/api/salidas', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const d = await res.json();
      if (d.success) {
        setLastSalida({...d.data, cliente_name:form.clienteName, cedula_rif:form.cedulaRif, telefono:form.telefono,
          direccion:form.direccion, vendedor_name:form.vendedorName, fecha:form.fecha, observaciones:form.observaciones,
          items: form.items.filter(it=>it.productoId&&parseInt(it.cantidad||0)>0).map(it=>({
            producto_nombre:it.productoNombre, cantidad:parseInt(it.cantidad), precio_unitario:parseFloat(it.precioUnitario||0)
          }))
        });
        load();
        setShowModal(false);
        if (printTicket) setShowTicketModal(true);
        setForm({ clienteName:'', cedulaRif:'', telefono:'', fecha:today(), direccion:'', vendedorName:'JUAN MORA', facturaNumber:'', observaciones:'', items:[emptyItem()] });
      } else alert('Error: ' + d.error);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta factura? El stock será repuesto.')) return;
    const res = await fetch(`/api/salidas?id=${id}`, {method:'DELETE'});
    const d = await res.json();
    if (d.success) load(); else alert(d.error);
  };

  const handleAbonoSave = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/abonos-salidas', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({salidaId:abonoForm.salidaId, clienteName:abonoForm.clienteName,
        montoUSD:parseFloat(abonoForm.montoUSD||0), montoVES:parseFloat(abonoForm.montoVES||0),
        referencia:abonoForm.referencia, fecha:abonoForm.fecha})
    });
    const d = await res.json();
    if (d.success) { setShowAbonoModal(false); load(); } else alert(d.error);
  };

  const loadEstadoCuenta = async (cliente) => {
    if (!cliente) return;
    const res = await fetch(`/api/salidas?action=estado_cuenta&cliente=${encodeURIComponent(cliente)}`);
    const d = await res.json();
    if (d.success) setEstadoCuenta(d);
  };

  const openNewModal = async () => {
    let nextNum = '3000';
    try {
      const res = await fetch('/api/salidas?action=next_number');
      const d = await res.json();
      if (d.success && d.nextNumber) nextNum = d.nextNumber;
    } catch {}

    setForm({
      clienteName: '', cedulaRif: '', telefono: '', fecha: today(), direccion: '',
      vendedorName: 'JUAN MORA', facturaNumber: nextNum, observaciones: '',
      items: [emptyItem()]
    });
    setShowModal(true);
  };

  const printTicket = () => {
    if (!lastSalida) return;
    const items = lastSalida.items || [];
    const totalUnits = items.reduce((s, it) => s + parseInt(it.cantidad || 0), 0);
    const cleanFecha = String(lastSalida.fecha || '').split('T')[0];
    const win = window.open('', '_blank', 'width=450,height=800');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nota de Entrega Nº ${lastSalida.factura_number}</title>
      <style>
        @page { size: 76mm auto; margin: 0; }
        body { width: 72mm; margin: 0 auto; padding: 4mm 2mm; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; line-height: 1.35; }
        .header-title { font-size: 15px; font-weight: 800; text-align: center; margin: 0 0 2px 0; }
        .header-sub { font-size: 10px; text-align: center; color: #111; margin: 1px 0; }
        .divider-solid { border: none; border-top: 1.5px solid #000; margin: 8px 0; }
        .divider-dashed { border: none; border-top: 1px dashed #444; margin: 8px 0; }
        .doc-title { font-size: 14px; font-weight: 800; text-align: center; letter-spacing: 0.5px; }
        .doc-num { font-size: 14px; font-weight: 800; text-align: center; margin-top: 2px; }
        .info-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .info-table td { padding: 2px 0; vertical-align: top; }
        .info-label { font-weight: 700; color: #000; }
        .info-val { text-align: right; word-break: break-word; }
        .items-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0; table-layout: fixed; }
        .items-table th { font-size: 10.5px; font-weight: 800; padding: 4px 0; text-align: left; border-bottom: 1.5px solid #000; }
        .items-table td { padding: 4px 0; vertical-align: top; word-break: break-word; }
        .text-right { text-align: right; }
        .totals-row { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; font-weight: 800; margin: 10px 0; }
        .payment-box { border: 1px solid #666; border-radius: 8px; padding: 8px 10px; margin: 12px 0; background: #fafafa; font-size: 9.5px; text-align: center; line-height: 1.45; }
        .payment-title { font-weight: 800; font-size: 10px; margin: 2px 0; }
        .signature-area { margin-top: 32px; text-align: center; font-size: 10px; }
        .signature-line { border-top: 1.5px solid #000; width: 65%; margin: 0 auto 5px auto; }
      </style></head><body>
      <div class="header-title">BESTEDA 2, C.A.</div>
      <div class="header-sub" style="font-weight:700;">RIF: J-40529263-6</div>
      <div class="header-sub">Calle Principal Casa Nº A-13, Urb. Alto de Fenix II</div>
      <div class="header-sub">San Juan de los Morros - Estado Guárico</div>
      <div class="header-sub">Tlfs: 0424-313.68.05 / 0424-300.48.02</div>
      <hr class="divider-solid" />
      <div class="doc-title">NOTA DE ENTREGA</div>
      <div class="doc-num">Nº ${lastSalida.factura_number}</div>
      <hr class="divider-dashed" />
      <table class="info-table">
        <tr><td class="info-label">FECHA:</td><td class="info-val">${cleanFecha}</td></tr>
        <tr><td class="info-label">CLIENTE:</td><td class="info-val">${lastSalida.cliente_name || ''}</td></tr>
        <tr><td class="info-label">C.I./RIF:</td><td class="info-val">${lastSalida.cedula_rif || '—'}</td></tr>
        <tr><td class="info-label">TELF:</td><td class="info-val">${lastSalida.telefono || '—'}</td></tr>
        <tr><td class="info-label">DIR:</td><td class="info-val">${lastSalida.direccion || '—'}</td></tr>
      </table>
      <hr class="divider-dashed" />
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 12%;">CAN</th>
            <th style="width: 46%;">DESCRIPCIÓN</th>
            <th style="width: 21%; text-align: right;">P/U</th>
            <th style="width: 21%; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => {
            const pu = Number(it.precioUnitario || it.precio_unitario || 0);
            const cant = Number(it.cantidad || 0);
            const tot = pu * cant;
            return `
              <tr>
                <td>${cant}</td>
                <td>${it.productoNombre || it.producto_nombre || ''}</td>
                <td class="text-right">$${pu.toFixed(2)}</td>
                <td class="text-right">$${tot.toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <hr class="divider-solid" />
      <div class="totals-row">
        <span>UND: ${totalUnits}</span>
        <span>TOTAL: $${Number(lastSalida.total_factura || 0).toFixed(2)}</span>
      </div>
      <div class="payment-box">
        <div class="payment-title">— PAGO MÓVIL BDV —</div>
        <div>0102 | 0424 3136805 | C.I. 10668263</div>
        <div>0102 | 0424 3004802 | C.I. 28012615</div>
        <div class="payment-title" style="margin-top: 6px;">— DEPÓSITO BANCARIO BDV —</div>
        <div>01020467450101628166 (JUAN MORA)</div>
        <div>01020467450000967787 (JORGE FLORES)</div>
      </div>
      <div class="signature-area">
        <div class="signature-line"></div>
        <div style="font-weight:600;">Firma del Cliente</div>
      </div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="fa-solid fa-receipt" style={{color:'var(--primary)'}}></i> Facturación y Despachos (Salidas)</h1>
          <p className="page-subtitle">Facturación digital compatible con impresoras de ticket de 80mm (7.6 cm) · Sustitución de talonario</p>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}><i className="fa-solid fa-plus"></i> Nueva Venta / Factura</button>
      </div>

      {/* Tabla Historial */}
      <div className="table-container">
        <div style={{padding:'1rem 1.25rem', background:'#fff', borderBottom:'1px solid var(--border-color)', display:'flex', flexWrap:'wrap', gap:'0.75rem', alignItems:'center', justifyContent:'space-between'}}>
          <h3 style={{fontSize:'1rem', fontWeight:600}}><i className="fa-solid fa-receipt"></i> Historial de Ventas y Facturación</h3>
          <div style={{display:'flex', gap:'0.6rem', flexWrap:'wrap', alignItems:'center'}}>
            <input type="date" className="form-control" style={{minHeight:36, width:'auto', fontSize:'0.85rem'}} value={filterFecha} onChange={e=>setFilterFecha(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={()=>setFilterFecha('')}><i className="fa-solid fa-xmark"></i></button>
            <input type="text" className="form-control" placeholder="🔍 Buscar cliente, Nº factura..." style={{maxWidth:220, minHeight:36, fontSize:'0.85rem'}} value={searchText} onChange={e=>setSearchText(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Tipo</th><th>Nº Documento</th><th>Fecha</th><th>Cliente</th>
              <th>Total ($)</th><th>Total (Bs.)</th><th>Saldo Pendiente</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSalidas.length === 0 ? (
              <tr><td colSpan={8} style={{textAlign:'center', padding:'2.5rem', color:'var(--text-muted)'}}>
                {searchText || filterFecha ? 'Sin resultados para los filtros' : 'Sin ventas registradas'}
              </td></tr>
            ) : filteredSalidas.map(s => (
              <tr key={s.id}>
                <td><span className="badge badge-primary" style={{fontSize:'0.7rem'}}>NOTA DE ENTREGA</span></td>
                <td style={{fontWeight:600}}>Nº {s.factura_number}</td>
                <td>{s.fecha ? String(s.fecha).split('T')[0] : '—'}</td>
                <td>
                  <div style={{fontWeight:600, fontSize:'0.88rem'}}>{s.cliente_name}</div>
                  {s.cedula_rif && <div style={{fontSize:'0.72rem', color:'var(--text-muted)'}}>{s.cedula_rif}</div>}
                </td>
                <td style={{fontWeight:700}}>${Number(s.total_factura||0).toFixed(2)}</td>
                <td style={{color:'#64748b', fontSize:'0.85rem'}}>Bs. {Number((s.total_factura||0)*bcvTasa).toLocaleString('es-VE',{minimumFractionDigits:2})}</td>
                <td>
                  <span className={`badge ${Number(s.saldo_adeudado)>0?'badge-warning':'badge-success'}`}>
                    ${Number(s.saldo_adeudado||0).toFixed(2)}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex', gap:'0.4rem'}}>
                    <button className="btn btn-secondary btn-sm" title="Imprimir Ticket (7.6 cm / 80mm)" onClick={()=>{ setLastSalida(s); setShowTicketModal(true); }}>
                      <i className="fa-solid fa-print"></i>
                    </button>
                    {Number(s.saldo_adeudado)>0 && (
                      <button className="btn btn-secondary btn-sm" title="Registrar abono"
                        onClick={()=>{ setAbonoForm({...abonoForm, salidaId:s.id, clienteName:s.cliente_name}); setShowAbonoModal(true); }}>
                        <i className="fa-solid fa-dollar-sign"></i>
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(s.id)} title="Eliminar">
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Nueva Venta */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:850}}>
            <div className="modal-header">
              <div>
                <h2><i className="fa-solid fa-cart-shopping"></i> Registrar Nueva Venta / Despacho</h2>
                <p style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>Sustitución digital de talonario · Genera Nota de Entrega en Ticket de 80mm</p>
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowModal(false)}>&times;</button>
            </div>

            {/* Formulario Cliente y Factura */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem', marginBottom:'1rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Nombre del Cliente</label>
                <input type="text" className="form-control" required style={{fontSize:'0.85rem'}} placeholder="Ej: Alexander Almaguer" value={form.clienteName} onChange={e=>setForm(f=>({...f,clienteName:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>C.I. / RIF</label>
                <input type="text" className="form-control" style={{fontSize:'0.85rem'}} placeholder="Ej: 30626438" value={form.cedulaRif} onChange={e=>setForm(f=>({...f,cedulaRif:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Teléfono</label>
                <input type="text" className="form-control" style={{fontSize:'0.85rem'}} placeholder="Ej: 0424-313.68.05" value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} />
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr', gap:'0.75rem', marginBottom:'1rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Dirección del Cliente</label>
                <input type="text" className="form-control" style={{fontSize:'0.85rem'}} placeholder="Ej: Calle Santa Rosa" value={form.direccion} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Nº Nota de Entrega</label>
                <input type="text" className="form-control" style={{fontSize:'0.85rem'}} placeholder="Ej: 3000" value={form.facturaNumber} onChange={e=>setForm(f=>({...f,facturaNumber:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Fecha</label>
                <input type="date" className="form-control" style={{fontSize:'0.85rem'}} value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} />
              </div>
            </div>

            {/* Tabla Productos */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem'}}>
              <h3 style={{fontSize:'0.9rem', fontWeight:700}}><i className="fa-solid fa-box-open"></i> Productos a Despachar</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setForm(f=>({...f, items:[...f.items, emptyItem()]}))}>+ Agregar Producto</button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'2.4fr 1.1fr 0.8fr 1fr 1fr 38px', gap:'0.5rem', marginBottom:'0.35rem', padding:'0 0.25rem', alignItems:'center'}}>
              {['PRODUCTO','PRECIO CUAL','CANT.','PRECIO $','SUBTOTAL $',''].map((h,i) => (
                <span key={i} style={{fontSize:'0.75rem', fontWeight:700, color:'var(--text-secondary)'}}>{h}</span>
              ))}
            </div>
            <div style={{maxHeight:250, overflowY:'auto'}}>
              {form.items.map((item, i) => (
                <div key={i} style={{display:'grid', gridTemplateColumns:'2.4fr 1.1fr 0.8fr 1fr 1fr 38px', gap:'0.5rem', marginBottom:'0.4rem', alignItems:'center'}}>
                  <select className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} value={item.productoId} onChange={e=>selectProduct(i, e.target.value)}>
                    <option value="">-- Seleccionar producto --</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id} disabled={Number(p.cantidad)<=0}>
                        {p.nombre} (Stock: {p.cantidad} | P1:${Number(p.precio_venta1||0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                  <select className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} value={item.precioOpcion || '1'} onChange={e=>selectPrecio(i, e.target.value)}>
                    <option value="1">Precio 1</option>
                    <option value="2">Precio 2</option>
                    <option value="3">Precio 3</option>
                    <option value="custom">Personalizado</option>
                  </select>
                  <input type="number" className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} min="1" value={item.cantidad} onChange={e=>updateItem(i, {cantidad:e.target.value})} />
                  <input type="number" step="0.01" className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem', fontWeight:600}} value={item.precioUnitario} onChange={e=>updateItem(i, {precioUnitario:e.target.value, precioOpcion:'custom'})} />
                  <span style={{fontWeight:700, color:'var(--primary)', fontSize:'0.88rem'}}>${Number(item.subtotal||0).toFixed(2)}</span>
                  <button type="button" className="btn btn-danger btn-sm" style={{width:32, height:32, minWidth:32, padding:0, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center'}} title="Eliminar renglón" onClick={()=>setForm(f=>({...f, items:f.items.filter((_,j)=>j!==i)}))}>
                    <i className="fa-solid fa-trash" style={{fontSize:'0.75rem'}}></i>
                  </button>
                </div>
              ))}
            </div>

            {/* Totales Venta */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0f172a', color:'#fff', padding:'0.85rem 1.25rem', borderRadius:10, marginTop:'1rem', flexWrap:'wrap', gap:'0.75rem'}}>
              <div style={{fontSize:'0.85rem'}}>Unidades Totales: <strong style={{color:'#fbbf24', fontSize:'1.05rem'}}>{totalUnidades}</strong></div>
              <div style={{display:'flex', alignItems:'center', gap:'1.5rem'}}>
                <div style={{fontSize:'0.85rem'}}>
                  TOTAL ($): <strong style={{color:'#38bdf8', fontSize:'1.2rem'}}>${totalFactura.toFixed(2)}</strong>
                </div>
                <div style={{fontSize:'0.85rem'}}>
                  (Bs.): <strong style={{color:'#a7f3d0', fontSize:'1.1rem'}}>Bs. {(totalFactura * bcvTasa).toLocaleString('es-VE',{minimumFractionDigits:2})}</strong>
                </div>
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginTop:'1.25rem'}}>
              <button type="button" className="btn btn-secondary" style={{width:'100%'}} onClick={()=>handleSave(false)} disabled={saving}>
                <i className="fa-solid fa-floppy-disk"></i> Solo Guardar
              </button>
              <button type="button" className="btn btn-primary" style={{width:'100%'}} onClick={()=>handleSave(true)} disabled={saving}>
                {saving ? <><i className="fa-solid fa-spinner fa-spin"></i> Guardando...</> : <><i className="fa-solid fa-print"></i> Guardar e Imprimir Ticket (7.6 cm)</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ticket 80mm / 7.6cm */}
      {showTicketModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:460, width:'95%'}}>
            <div className="modal-header" style={{marginBottom:'0.75rem'}}>
              <h2><i className="fa-solid fa-receipt"></i> Vista Previa · Ticket (7.6 cm)</h2>
              <button type="button" className="modal-close" onClick={()=>setShowTicketModal(false)}>&times;</button>
            </div>
            {/* Ticket Preview Exact Matching User Photo */}
            {lastSalida && (() => {
              const items = lastSalida.items || [];
              const totalUnits = items.reduce((s, it) => s + parseInt(it.cantidad || 0), 0);
              const cleanFecha = String(lastSalida.fecha || '').split('T')[0];
              return (
                <div style={{background:'#fff', border:'1px solid #cbd5e1', borderRadius:8, padding:'1.25rem 1rem', fontFamily:'Arial, Helvetica, sans-serif', fontSize:'11px', color:'#000', maxHeight:'68vh', overflowY:'auto', overflowX:'hidden', lineHeight:1.35, width:'100%', boxSizing:'border-box'}}>
                  <div style={{textAlign:'center', fontWeight:800, fontSize:'15px'}}>BESTEDA 2, C.A.</div>
                  <div style={{textAlign:'center', fontWeight:700, fontSize:'11px', marginTop:'2px'}}>RIF: J-40529263-6</div>
                  <div style={{textAlign:'center', fontSize:'9.5px', color:'#111', marginTop:'2px'}}>Calle Principal Casa Nº A-13, Urb. Alto de Fenix II</div>
                  <div style={{textAlign:'center', fontSize:'9.5px', color:'#111'}}>San Juan de los Morros - Estado Guárico</div>
                  <div style={{textAlign:'center', fontSize:'9.5px', color:'#111'}}>Tlfs: 0424-313.68.05 / 0424-300.48.02</div>
                  
                  <hr style={{border:'none', borderTop:'1.5px solid #000', margin:'8px 0'}} />
                  
                  <div style={{textAlign:'center', fontWeight:800, fontSize:'14px', letterSpacing:'0.5px'}}>NOTA DE ENTREGA</div>
                  <div style={{textAlign:'center', fontWeight:800, fontSize:'14px', marginTop:'2px'}}>Nº {lastSalida.factura_number}</div>
                  
                  <hr style={{border:'none', borderTop:'1px dashed #444', margin:'8px 0'}} />
                  
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>FECHA:</b><span>{cleanFecha}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>CLIENTE:</b><span>{lastSalida.cliente_name || ''}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>C.I./RIF:</b><span>{lastSalida.cedula_rif || '—'}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>TELF:</b><span>{lastSalida.telefono || '—'}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>DIR:</b><span>{lastSalida.direccion || '—'}</span></div>
                  
                  <hr style={{border:'none', borderTop:'1px dashed #444', margin:'8px 0'}} />
                  
                  <table style={{width:'100%', borderCollapse:'collapse', fontSize:'11px', margin:'6px 0', tableLayout:'fixed'}}>
                    <thead>
                      <tr style={{fontSize:'10.5px', fontWeight:800, borderBottom:'1.5px solid #000'}}>
                        <th style={{textAlign:'left', width:'12%', paddingBottom:'4px'}}>CAN</th>
                        <th style={{textAlign:'left', width:'46%', paddingBottom:'4px'}}>DESCRIPCIÓN</th>
                        <th style={{textAlign:'right', width:'21%', paddingBottom:'4px'}}>P/U</th>
                        <th style={{textAlign:'right', width:'21%', paddingBottom:'4px'}}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => {
                        const pu = Number(it.precioUnitario || it.precio_unitario || 0);
                        const cant = Number(it.cantidad || 0);
                        const tot = pu * cant;
                        return (
                          <tr key={i} style={{borderBottom:'1px dashed #f1f5f9'}}>
                            <td style={{padding:'4px 0', verticalAlign:'top'}}>{cant}</td>
                            <td style={{padding:'4px 0', verticalAlign:'top', fontWeight:600, wordBreak:'break-word'}}>{it.productoNombre || it.producto_nombre}</td>
                            <td style={{textAlign:'right', padding:'4px 0', verticalAlign:'top'}}>${pu.toFixed(2)}</td>
                            <td style={{textAlign:'right', padding:'4px 0', verticalAlign:'top', fontWeight:700}}>${tot.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  <hr style={{border:'none', borderTop:'1.5px solid #000', margin:'8px 0'}} />
                  
                  <div style={{display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:'14px', margin:'10px 0'}}>
                    <span>UND: {totalUnits}</span>
                    <span>TOTAL: ${Number(lastSalida.total_factura || totalFactura).toFixed(2)}</span>
                  </div>
                  
                  <div style={{border:'1px solid #666', borderRadius:'8px', padding:'8px 10px', margin:'12px 0', background:'#fafafa', fontSize:'9.5px', textAlign:'center', lineHeight:1.45}}>
                    <div style={{fontWeight:800, fontSize:'10px'}}>— PAGO MÓVIL BDV —</div>
                    <div>0102 | 0424 3136805 | C.I. 10668263</div>
                    <div>0102 | 0424 3004802 | C.I. 28012615</div>
                    <div style={{fontWeight:800, fontSize:'10px', marginTop:'6px'}}>— DEPÓSITO BANCARIO BDV —</div>
                    <div>01020467450101628166 (JUAN MORA)</div>
                    <div>01020467450000967787 (JORGE FLORES)</div>
                  </div>
                  
                  <div style={{marginTop:'32px', textAlign:'center'}}>
                    <div style={{borderTop:'1.5px solid #000', width:'65%', margin:'0 auto 5px auto'}}></div>
                    <div style={{fontSize:'10.5px', fontWeight:600}}>Firma del Cliente</div>
                  </div>
                </div>
              );
            })()}
            <div style={{display:'flex', gap:'0.75rem', marginTop:'1rem'}}>
              <button type="button" className="btn btn-primary" style={{width:'100%', fontSize:'1rem', padding:'0.75rem'}} onClick={printTicket}>
                <i className="fa-solid fa-print"></i> Enviar a Impresora Térmica (7.6 cm)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abono de Cliente */}
      {showAbonoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:500}}>
            <div className="modal-header">
              <div>
                <h2><i className="fa-solid fa-hand-holding-dollar"></i> Registrar Abono de Cliente</h2>
                <p style={{fontSize:'0.82rem', color:'var(--text-secondary)', fontWeight:600, margin:0}}>{abonoForm.clienteName}</p>
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowAbonoModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAbonoSave}>
              <div style={{background:'#f0f9ff', border:'1px solid #bae6fd', padding:'0.5rem 0.75rem', borderRadius:6, marginBottom:'1rem', fontSize:'0.8rem', color:'#0369a1', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span><i className="fa-solid fa-coins"></i> Tasa BCV de Conversión:</span>
                <strong style={{color:'#0284c7', fontSize:'0.9rem'}}>Bs. {bcvTasa.toFixed(2)} / $</strong>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'0.5rem'}}>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700}}>Monto en USD ($)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="0.00" required style={{fontSize:'1rem', fontWeight:700, color:'#166534'}}
                    value={abonoForm.montoUSD} onChange={e=>setAbonoForm(f=>({...f,montoUSD:e.target.value,montoVES:(parseFloat(e.target.value||0)*bcvTasa).toFixed(2)}))} />
                  <small style={{fontSize:'0.72rem', color:'#0284c7', fontWeight:600, display:'block', marginTop:3}}>= Bs. {(parseFloat(abonoForm.montoUSD||0)*bcvTasa).toLocaleString('es-VE',{minimumFractionDigits:2})}</small>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700}}>Monto en BS (VES)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="0.00" style={{fontSize:'1rem', fontWeight:700, color:'#0284c7'}}
                    value={abonoForm.montoVES} onChange={e=>setAbonoForm(f=>({...f,montoVES:e.target.value}))} />
                  <small style={{fontSize:'0.72rem', color:'#166534', fontWeight:600, display:'block', marginTop:3}}>= ${(parseFloat(abonoForm.montoVES||0)/bcvTasa).toFixed(2)} USD</small>
                </div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginTop:'0.85rem'}}>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label" style={{fontSize:'0.8rem'}}>Fecha de Pago</label>
                  <input type="date" className="form-control" required style={{fontSize:'0.85rem'}} value={abonoForm.fecha} onChange={e=>setAbonoForm(f=>({...f,fecha:e.target.value}))} />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label" style={{fontSize:'0.8rem'}}>Nº Referencia / Método</label>
                  <input type="text" className="form-control" placeholder="Ej: Pago Móvil 583920" style={{fontSize:'0.85rem'}} value={abonoForm.referencia} onChange={e=>setAbonoForm(f=>({...f,referencia:e.target.value}))} />
                </div>
              </div>
              <div style={{marginTop:'1.25rem'}}>
                <button type="submit" className="btn btn-primary" style={{width:'100%', padding:'0.7rem', fontSize:'0.95rem'}}>
                  <i className="fa-solid fa-check"></i> Procesar Abono de Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Estado de Cuenta */}
      {showEstadoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:850}}>
            <div className="modal-header">
              <div>
                <h2><i className="fa-solid fa-file-invoice-dollar" style={{color:'#0284c7'}}></i> Estado de Cuenta del Cliente</h2>
                <p style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>Resumen detallado de compras, abonos y saldo deudor pendiente</p>
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowEstadoModal(false)}>&times;</button>
            </div>
            <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:'0.85rem', borderRadius:8, marginBottom:'1rem', display:'flex', gap:'0.75rem', alignItems:'flex-end', flexWrap:'wrap'}}>
              <div style={{flex:1, minWidth:220}}>
                <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700}}>Seleccionar Cliente:</label>
                <select className="form-control" style={{fontSize:'0.9rem'}} value={selectedCliente} onChange={e=>setSelectedCliente(e.target.value)}>
                  <option value="">-- Seleccionar cliente --</option>
                  {clientes.map((c,i) => <option key={i} value={c.cliente_name}>{c.cliente_name} (Deuda: ${Number(c.saldo_pendiente_usd||0).toFixed(2)})</option>)}
                </select>
              </div>
              <button className="btn btn-secondary" onClick={()=>loadEstadoCuenta(selectedCliente)}>
                <i className="fa-solid fa-arrows-rotate"></i> Ver Estado
              </button>
            </div>

            {estadoCuenta && (
              <div style={{background:'#fff', border:'1px solid #cbd5e1', borderRadius:8, padding:'1.25rem', maxHeight:'55vh', overflowY:'auto'}}>
                <div style={{textAlign:'center', marginBottom:'1rem'}}>
                  <h3 style={{fontSize:'1.1rem', fontWeight:800}}>{estadoCuenta.cliente?.name}</h3>
                  <p style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>C.I./RIF: {estadoCuenta.cliente?.cedula_rif||'—'} | Telf: {estadoCuenta.cliente?.telefono||'—'}</p>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'1rem'}}>
                  <div style={{textAlign:'center', background:'#f0fdf4', padding:'0.75rem', borderRadius:8}}>
                    <div style={{fontSize:'0.75rem', color:'#166534', fontWeight:700}}>TOTAL COMPRAS</div>
                    <div style={{fontSize:'1.2rem', fontWeight:800, color:'#166534'}}>${Number(estadoCuenta.totales?.total_compras_usd||0).toFixed(2)}</div>
                  </div>
                  <div style={{textAlign:'center', background:'#eff6ff', padding:'0.75rem', borderRadius:8}}>
                    <div style={{fontSize:'0.75rem', color:'#0369a1', fontWeight:700}}>ABONADO</div>
                    <div style={{fontSize:'1.2rem', fontWeight:800, color:'#0369a1'}}>${Number(estadoCuenta.totales?.total_abonado_usd||0).toFixed(2)}</div>
                  </div>
                  <div style={{textAlign:'center', background:'#fef2f2', padding:'0.75rem', borderRadius:8}}>
                    <div style={{fontSize:'0.75rem', color:'#dc2626', fontWeight:700}}>SALDO DEUDOR</div>
                    <div style={{fontSize:'1.2rem', fontWeight:800, color:'#dc2626'}}>${Number(estadoCuenta.totales?.saldo_pendiente_usd||0).toFixed(2)}</div>
                  </div>
                </div>
                <table>
                  <thead><tr><th>Nº Factura</th><th>Fecha</th><th>Total</th><th>Saldo</th></tr></thead>
                  <tbody>
                    {(estadoCuenta.salidas||[]).map(s => (
                      <tr key={s.id}>
                        <td>Nº {s.factura_number}</td>
                        <td>{s.fecha}</td>
                        <td>${Number(s.total_factura||0).toFixed(2)}</td>
                        <td><span className={`badge ${Number(s.saldo_adeudado)>0?'badge-danger':'badge-success'}`}>${Number(s.saldo_adeudado||0).toFixed(2)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!estadoCuenta && (
              <div style={{textAlign:'center', color:'var(--text-muted)', padding:'2rem'}}>
                <i className="fa-solid fa-user-tag" style={{fontSize:'2.5rem', marginBottom:'0.5rem', color:'#94a3b8'}}></i>
                <p>Selecciona un cliente arriba para generar su Estado de Cuenta.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
