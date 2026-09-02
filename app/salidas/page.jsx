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
          items:payload.items});
        setShowModal(false);
        if (printTicket) setShowTicketModal(true);
        load();
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

  const printTicket = () => {
    if (!lastSalida) return;
    const win = window.open('', '_blank', 'width=400,height=700');
    win.document.write(`<!DOCTYPE html><html><head><title>Ticket</title>
      <style>body{margin:0;padding:2mm;font-family:'Courier New',Courier,monospace;font-size:10px;width:76mm;}
      .center{text-align:center;}.bold{font-weight:900;}.hr{border:none;border-top:1px dashed #000;margin:4px 0;}
      table{width:100%;border-collapse:collapse;}td{font-size:9px;padding:1px 0;}
      .right{text-align:right;}.total-row{border-top:1px dashed #000;padding-top:3px;font-weight:900;font-size:11px;}
      @page{size:80mm auto;margin:0;}</style></head><body>
      <div class="center bold" style="font-size:13px;">BESTEDA 2, C.A.</div>
      <div class="center" style="font-size:10px;">RIF: J-40529263-6</div>
      <div class="center" style="font-size:9px;">San Juan de los Morros - Guárico</div>
      <hr class="hr"><div class="center bold" style="font-size:12px;">NOTA DE ENTREGA</div>
      <div class="center" style="color:#b91c1c;font-weight:900;">Nº ${lastSalida.factura_number}</div>
      <hr class="hr">
      <table><tr><td><b>Cliente:</b></td><td class="right">${lastSalida.cliente_name}</td></tr>
      <tr><td><b>C.I./RIF:</b></td><td class="right">${lastSalida.cedula_rif||'—'}</td></tr>
      <tr><td><b>Fecha:</b></td><td class="right">${lastSalida.fecha}</td></tr>
      <tr><td><b>Vendedor:</b></td><td class="right">${lastSalida.vendedor_name||'JUAN MORA'}</td></tr></table>
      <hr class="hr">
      <table><thead><tr><td style="font-weight:700;font-size:8px;">CANT</td><td style="font-weight:700;font-size:8px;">DESCRIPCIÓN</td>
      <td style="font-weight:700;font-size:8px;text-align:right">P/U</td><td style="font-weight:700;font-size:8px;text-align:right">TOTAL</td></tr></thead>
      <tbody>${(lastSalida.items||[]).map(it=>`<tr>
        <td>${it.cantidad}</td><td>${it.productoNombre||it.producto_nombre}</td>
        <td class="right">$${Number(it.precioUnitario||it.precio_unitario||0).toFixed(2)}</td>
        <td class="right">$${Number((it.cantidad)*(it.precioUnitario||it.precio_unitario||0)).toFixed(2)}</td>
      </tr>`).join('')}</tbody></table>
      <hr class="hr"><div class="total-row" style="display:flex;justify-content:space-between;">
        <span>TOTAL:</span><span>$${Number(lastSalida.total_factura||totalFactura).toFixed(2)}</span>
      </div>
      <br><div class="center" style="font-size:8px;margin-top:16px;border-top:1px solid #000;padding-top:3px;">FIRMA: ___________________</div>
      <div class="center" style="font-size:8px;">Gracias por su compra</div>
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
          <p className="page-subtitle">Facturación digital compatible con impresoras de ticket de 80mm · Sustitución de talonario</p>
        </div>
        <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
          <button className="btn btn-secondary" style={{background:'#0284c7', color:'#fff', borderColor:'#0284c7'}} onClick={()=>setShowEstadoModal(true)}>
            <i className="fa-solid fa-file-invoice-dollar"></i> 📋 Estado de Cuenta Cliente
          </button>
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}>
            <i className="fa-solid fa-plus"></i> Nueva Nota / Despacho
          </button>
        </div>
      </div>

      {/* Tabla Historial */}
      <div className="table-container">
        <div style={{padding:'1rem 1.25rem', background:'#fff', borderBottom:'1px solid var(--border-color)', display:'flex', flexWrap:'wrap', gap:'0.75rem', alignItems:'center', justifyContent:'space-between'}}>
          <h3 style={{fontSize:'1rem', fontWeight:600}}><i className="fa-solid fa-list-check"></i> Historial de Facturas</h3>
          <div style={{display:'flex', gap:'0.6rem', flexWrap:'wrap', alignItems:'center'}}>
            <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}>
              <label style={{fontSize:'0.82rem', color:'var(--text-secondary)', whiteSpace:'nowrap'}}><i className="fa-solid fa-calendar-day"></i> Filtrar día:</label>
              <input type="date" className="form-control" style={{minHeight:36, width:'auto', fontSize:'0.85rem'}} value={filterFecha} onChange={e=>setFilterFecha(e.target.value)} />
              <button className="btn btn-secondary btn-sm" onClick={()=>setFilterFecha('')}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <input type="text" className="form-control" placeholder="🔍 Buscar cliente, Nº factura..." style={{maxWidth:220, minHeight:36, fontSize:'0.85rem'}} value={searchText} onChange={e=>setSearchText(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Documento</th><th>Nº Factura</th><th>Fecha</th><th>Cliente</th><th>C.I. / RIF</th><th>Total ($)</th><th>Saldo Pendiente</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {filteredSalidas.length === 0 ? (
              <tr><td colSpan={8} style={{textAlign:'center', padding:'2.5rem', color:'var(--text-muted)'}}>
                {searchText || filterFecha ? 'Sin resultados para los filtros' : 'Sin facturas registradas'}
              </td></tr>
            ) : filteredSalidas.map(s => (
              <tr key={s.id}>
                <td><span className="badge badge-primary" style={{fontSize:'0.7rem'}}>{s.tipo_documento||'NOTA DE ENTREGA'}</span></td>
                <td style={{fontWeight:600}}>Nº {s.factura_number}</td>
                <td>{s.fecha ? String(s.fecha).split('T')[0] : '—'}</td>
                <td style={{fontWeight:500}}>{s.cliente_name}</td>
                <td style={{color:'var(--text-secondary)', fontSize:'0.85rem'}}>{s.cedula_rif||'—'}</td>
                <td style={{fontWeight:700}}>${Number(s.total_factura||0).toFixed(2)}</td>
                <td>
                  <span className={`badge ${Number(s.saldo_adeudado)>0?'badge-warning':'badge-success'}`}>
                    ${Number(s.saldo_adeudado||0).toFixed(2)}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex', gap:'0.4rem'}}>
                    <button className="btn btn-secondary btn-sm" title="Reprint ticket" onClick={()=>{ setLastSalida(s); setShowTicketModal(true); }}>
                      <i className="fa-solid fa-print"></i>
                    </button>
                    {Number(s.saldo_adeudado)>0 && (
                      <button className="btn btn-secondary btn-sm" title="Registrar abono" style={{background:'#dcfce7', color:'#166534'}}
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

      {/* Modal Nueva Factura */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={(e)=>{ e.stopPropagation(); setShowModal(false); }} />
          <div className="modal-content" style={{maxWidth:750}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2><i className="fa-solid fa-file-invoice"></i> Nueva Factura (BESTEDA 2, C.A.)</h2>
                <p style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>RIF: J-40529263-6 | San Juan de los Morros</p>
              </div>
              <button className="modal-close" onClick={()=>setShowModal(false)}>&times;</button>
            </div>

            <div style={{marginBottom:'1rem', background:'#e0f2fe', padding:'0.6rem 1rem', borderRadius:10, border:'1px solid #bae6fd', fontWeight:700, color:'#0369a1', fontSize:'0.88rem', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span><i className="fa-solid fa-file-invoice"></i> DOCUMENTO: NOTA DE ENTREGA</span>
              <span className="badge badge-primary" style={{background:'#0284c7', color:'#fff'}}>Talonario 80mm</span>
            </div>

            {/* Datos Cliente */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Cliente (Nombre y Apellido) *</label>
                <input type="text" className="form-control" placeholder="Ej: Pedro Pérez" required value={form.clienteName} onChange={e=>setForm(f=>({...f,clienteName:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Cédula / RIF *</label>
                <input type="text" className="form-control" placeholder="Ej: V-12345678" value={form.cedulaRif} onChange={e=>setForm(f=>({...f,cedulaRif:e.target.value}))} />
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input type="text" className="form-control" placeholder="Ej: 0412-1234567" value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input type="date" className="form-control" required value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input type="text" className="form-control" placeholder="Av. Bolívar Edif. Central Piso 1" value={form.direccion} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))} />
            </div>

            <hr style={{margin:'1rem 0', border:'none', borderTop:'1px solid var(--border-color)'}} />

            {/* Productos */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem'}}>
              <h3 style={{fontSize:'0.95rem', fontWeight:600}}><i className="fa-solid fa-cart-shopping"></i> Productos a Facturar</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setForm(f=>({...f,items:[...f.items,emptyItem()]}))}>+ Agregar Renglón</button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'2.2fr 1.4fr 0.7fr 1fr 1fr auto', gap:'0.5rem', marginBottom:'0.25rem', padding:'0 0.25rem'}}>
              {['PRODUCTO','OPCION PRECIO','CANT.','PRECIO $','SUBTOTAL',''].map((h,i)=>(
                <span key={i} style={{fontSize:'0.78rem', fontWeight:600, color:'var(--text-secondary)'}}>{h}</span>
              ))}
            </div>
            <div style={{maxHeight:300, overflowY:'auto'}}>
              {form.items.map((item, i) => (
                <div key={i} style={{display:'grid', gridTemplateColumns:'2.2fr 1.4fr 0.7fr 1fr 1fr auto', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center'}}>
                  <select className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} value={item.productoId} onChange={e=>selectProduct(i,e.target.value)}>
                    <option value="">-- Seleccionar --</option>
                    {productos.map(p=>(
                      <option key={p.id} value={p.id} disabled={parseInt(p.cantidad)<=0}>
                        {p.nombre} {parseInt(p.cantidad)<=0?'(Sin stock)':''} (Disp: {p.cantidad})
                      </option>
                    ))}
                  </select>
                  <select className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} value={item.precioOpcion} onChange={e=>selectPrecio(i,e.target.value)}>
                    <option value="1">P1 – ${Number(productos.find(p=>p.id===item.productoId)?.precio_venta1||0).toFixed(2)}</option>
                    <option value="2">P2 – ${Number(productos.find(p=>p.id===item.productoId)?.precio_venta2||0).toFixed(2)}</option>
                    <option value="3">P3 – ${Number(productos.find(p=>p.id===item.productoId)?.precio_venta3||0).toFixed(2)}</option>
                  </select>
                  <input type="number" className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} min="1" value={item.cantidad} onChange={e=>updateItem(i,{cantidad:e.target.value, subtotal:parseInt(e.target.value||0)*parseFloat(item.precioUnitario||0)})} />
                  <input type="number" step="0.01" className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} value={item.precioUnitario} onChange={e=>updateItem(i,{precioUnitario:e.target.value, subtotal:parseInt(item.cantidad||0)*parseFloat(e.target.value||0)})} />
                  <span style={{fontWeight:700, color:'var(--success)', fontSize:'0.85rem'}}>${Number(item.subtotal||0).toFixed(2)}</span>
                  <button type="button" className="btn btn-danger btn-sm" style={{padding:'0.25rem 0.5rem'}} onClick={()=>setForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))}>×</button>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f1f5f9', padding:'1rem', borderRadius:10, marginTop:'1rem'}}>
              <div>
                <span style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>Total Unidades:</span>
                <strong style={{fontSize:'1.1rem', color:'var(--primary)', marginLeft:'0.5rem'}}>{totalUnidades}</strong>
              </div>
              <div>
                <span style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>TOTAL FACTURA:</span>
                <strong style={{fontSize:'1.4rem', color:'var(--success)', marginLeft:'0.5rem'}}>${totalFactura.toFixed(2)}</strong>
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'1.5rem'}}>
              <button type="button" className="btn btn-secondary" style={{width:'100%'}} onClick={()=>handleSave(false)} disabled={saving}>
                <i className="fa-solid fa-floppy-disk"></i> Solo Guardar
              </button>
              <button type="button" className="btn btn-primary" style={{width:'100%'}} onClick={()=>handleSave(true)} disabled={saving}>
                {saving ? <><i className="fa-solid fa-spinner fa-spin"></i> Guardando...</> : <><i className="fa-solid fa-print"></i> Guardar e Imprimir Ticket (80mm)</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ticket 80mm */}
      {showTicketModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={()=>setShowTicketModal(false)} />
          <div className="modal-content" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{marginBottom:'0.75rem'}}>
              <h2><i className="fa-solid fa-receipt"></i> Vista Previa · Ticket 80mm</h2>
              <button type="button" className="modal-close" onClick={()=>setShowTicketModal(false)}>&times;</button>
            </div>
            {/* Ticket Preview */}
            {lastSalida && (
              <div style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:'1rem', fontFamily:'Courier New,monospace', fontSize:'10px', maxHeight:'65vh', overflowY:'auto'}}>
                <div style={{textAlign:'center', fontWeight:900, fontSize:13}}>BESTEDA 2, C.A.</div>
                <div style={{textAlign:'center', fontSize:10}}>RIF: J-40529263-6</div>
                <div style={{textAlign:'center', fontSize:9, color:'#333'}}>San Juan de los Morros - Guárico</div>
                <hr style={{border:'none', borderTop:'2px solid #000', margin:'5px 0'}} />
                <div style={{textAlign:'center', fontWeight:900, fontSize:12}}>NOTA DE ENTREGA</div>
                <div style={{textAlign:'center', fontWeight:900, color:'#b91c1c', fontSize:12}}>Nº {lastSalida.factura_number}</div>
                <hr style={{border:'none', borderTop:'1px dashed #666', margin:'4px 0'}} />
                <div style={{display:'flex', justifyContent:'space-between', fontSize:10}}><b>Cliente:</b><span>{lastSalida.cliente_name}</span></div>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:10}}><b>C.I./RIF:</b><span>{lastSalida.cedula_rif||'—'}</span></div>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:10}}><b>Fecha:</b><span>{lastSalida.fecha}</span></div>
                <hr style={{border:'none', borderTop:'1px dashed #666', margin:'4px 0'}} />
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{fontSize:9, fontWeight:700}}><td>CANT</td><td>DESCRIPCIÓN</td><td style={{textAlign:'right'}}>P/U</td><td style={{textAlign:'right'}}>TOTAL</td></tr>
                  </thead>
                  <tbody>
                    {(lastSalida.items||[]).map((it,i) => (
                      <tr key={i} style={{fontSize:9}}>
                        <td>{it.cantidad}</td>
                        <td style={{maxWidth:120, wordBreak:'break-word'}}>{it.productoNombre||it.producto_nombre}</td>
                        <td style={{textAlign:'right'}}>${Number(it.precioUnitario||it.precio_unitario||0).toFixed(2)}</td>
                        <td style={{textAlign:'right'}}>${Number((it.cantidad)*(it.precioUnitario||it.precio_unitario||0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr style={{border:'none', borderTop:'1px dashed #666', margin:'4px 0'}} />
                <div style={{display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:12}}>
                  <span>TOTAL:</span><span>${Number(lastSalida.total_factura||totalFactura).toFixed(2)}</span>
                </div>
                <div style={{textAlign:'center', fontSize:9, marginTop:16, borderTop:'1px solid #000', paddingTop:4}}>FIRMA: ___________________</div>
                <div style={{textAlign:'center', fontSize:8}}>Gracias por su compra</div>
              </div>
            )}
            <div style={{display:'flex', gap:'0.75rem', marginTop:'1rem'}}>
              <button type="button" className="btn btn-primary" style={{width:'100%', fontSize:'1rem', padding:'0.75rem'}} onClick={printTicket}>
                <i className="fa-solid fa-print"></i> Enviar a Impresora 80mm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abono de Cliente */}
      {showAbonoModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={()=>setShowAbonoModal(false)} />
          <div className="modal-content" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
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
          <div className="modal-backdrop" onClick={()=>setShowEstadoModal(false)} />
          <div className="modal-content" style={{maxWidth:850}} onClick={e=>e.stopPropagation()}>
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
