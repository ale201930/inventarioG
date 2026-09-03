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
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [loadingEstado, setLoadingEstado] = useState(false);

  const [form, setForm] = useState({
    clienteName:'', cedulaRif:'', telefono:'', fecha:today(), direccion:'',
    vendedorName:'JUAN MORA', facturaNumber:'', observaciones:'',
    items:[emptyItem()]
  });
  const [abonoForm, setAbonoForm] = useState({ salidaId:'', clienteName:'', montoUSD:0, montoVES:0, referencia:'', fecha:today() });

  // Bloquear scroll de fondo cuando cualquier modal esté abierto
  useEffect(() => {
    const isModalOpen = showModal || showTicketModal || showAbonoModal || showEstadoModal;
    if (typeof document !== 'undefined') {
      if (isModalOpen) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };
  }, [showModal, showTicketModal, showAbonoModal, showEstadoModal]);

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

  const loadEstadoCuenta = async (clienteName) => {
    if (!clienteName) return;
    setLoadingEstado(true);
    try {
      const res = await fetch(`/api/salidas?action=estado_cuenta&cliente=${encodeURIComponent(clienteName)}`);
      const d = await res.json();
      if (d.success) {
        setEstadoCuenta(d);
      } else {
        alert(d.error || 'Error cargando estado de cuenta');
      }
    } catch {
      alert('Error de conexión al cargar estado de cuenta');
    } finally {
      setLoadingEstado(false);
    }
  };

  const handleExportPDF = () => {
    const docEl = document.getElementById('estadoCuentaDocument');
    if (!docEl) { alert('Selecciona un cliente primero.'); return; }
    const clienteName = estadoCuenta?.cliente?.name || 'Cliente';
    const cleanName = clienteName.replace(/[^a-zA-Z0-9]/g, '_');

    if (typeof window !== 'undefined' && window.html2pdf) {
      setGeneratingPdf(true);
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Estado_de_Cuenta_${cleanName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      window.html2pdf().set(opt).from(docEl).save().then(() => {
        setGeneratingPdf(false);
      }).catch(err => {
        console.error(err);
        setGeneratingPdf(false);
        handlePrintDoc();
      });
    } else {
      handlePrintDoc();
    }
  };

  const handlePrintDoc = () => {
    const docEl = document.getElementById('estadoCuentaDocument');
    if (!docEl) { alert('Selecciona un cliente primero.'); return; }
    const win = window.open('', '_blank', 'width=850,height=900');
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Estado de Cuenta - ${estadoCuenta?.cliente?.name || 'Cliente'}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 20px; background: #fff; color: #000; margin: 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #cbd5e1; padding: 6px 8px; }
        @media print { body { padding: 0; } @page { margin: 10mm; } }
      </style>
      </head><body>
        ${docEl.outerHTML}
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
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
    const opcion = form.items[i]?.precioOpcion || '1';
    let precio = 0;
    if (opcion === '1') precio = parseFloat(prod.precio_venta1) || 0;
    else if (opcion === '2') precio = parseFloat(prod.precio_venta2) || 0;
    else if (opcion === '3') precio = parseFloat(prod.precio_venta3) || 0;
    else if (opcion === 'custom') precio = form.items[i]?.precioUnitario || '';
    
    const cant = parseInt(form.items[i]?.cantidad||1);
    updateItem(i, {
      productoId: prod.id,
      productoNombre: prod.nombre,
      precioUnitario: precio,
      subtotal: opcion === 'custom' ? (parseFloat(precio||0) * cant) : (cant * precio)
    });
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
    const cant = parseInt(form.items[i]?.cantidad || 1);
    if (opcion === 'custom') {
      updateItem(i, { precioOpcion: 'custom', precioUnitario: '', subtotal: 0 });
      return;
    }
    const prod = productos.find(p => p.id === form.items[i]?.productoId);
    if (!prod) {
      updateItem(i, { precioOpcion: opcion });
      return;
    }
    const precio = parseFloat(opcion === '2' ? prod.precio_venta2 : opcion === '3' ? prod.precio_venta3 : prod.precio_venta1) || 0;
    updateItem(i, { precioOpcion: opcion, precioUnitario: precio, subtotal: cant * precio });
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

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nota de Entrega Nº ${lastSalida.factura_number}</title>
  <style>
    @page {
      size: 76mm auto;
      margin: 0;
    }
    @media print {
      body {
        width: 72mm;
        margin: 0 auto;
        padding: 2mm 1mm;
        -webkit-print-color-adjust: exact;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      width: 72mm;
      margin: 0 auto;
      padding: 4mm 2mm;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #000000;
      background: #ffffff;
      line-height: 1.35;
    }
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
    .payment-box { border: 1px solid #475569; border-radius: 8px; padding: 8px 10px; margin: 10px 0 4px 0; background: #fafafa; font-size: 9.5px; line-height: 1.45; }
    .payment-title { font-weight: 800; font-size: 10.5px; text-align: center; margin-bottom: 4px; }
    .payment-data { text-align: left; padding-left: 2px; display: flex; flex-direction: column; gap: 2px; }
  </style>
</head>
<body>
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
    <div class="payment-data">
      <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3136805</strong> &nbsp;|&nbsp; C.I. 10.668.263</div>
      <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3004802</strong> &nbsp;|&nbsp; C.I. 28.012.615</div>
    </div>
    <div style="border-top: 1px dashed #cbd5e1; margin: 6px 0;"></div>
    <div class="payment-title">— DEPÓSITO BANCARIO BDV —</div>
    <div class="payment-data">
      <div>• <strong>0102 0467 4501 0162 8166</strong> <span style="font-size: 8.5px; color: #475569;">(JUAN MORA)</span></div>
      <div>• <strong>0102 0467 4500 0096 7787</strong> <span style="font-size: 8.5px; color: #475569;">(JORGE FLORES)</span></div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        try {
          window.print();
        } catch(e) {}
      }, 200);
    };
    window.onafterprint = function() {
      try {
        window.close();
      } catch(e) {}
    };
  </script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(htmlContent);
      win.document.close();
    }
  };

  return (
    <>
      <div className="page-header" style={{ marginBottom: '1.75rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
            <i className="fa-solid fa-receipt" style={{ color: '#0284c7' }}></i> Facturación y Despachos (Salidas)
          </h1>
          <p className="page-subtitle" style={{ color: '#475569', fontSize: '0.92rem', fontWeight: 500, margin: 0 }}>
            Facturación digital compatible con impresoras de ticket de 80mm (7.6 cm) · Sustitución de talonario
          </p>
        </div>
        <div style={{display:'flex', gap:'0.6rem', flexWrap:'wrap'}}>
          <button className="btn btn-secondary" style={{background:'#e0f2fe', color:'#0369a1', fontWeight:700}} onClick={()=>setShowEstadoModal(true)}>
            <i className="fa-solid fa-file-invoice-dollar"></i> Estado de Cuenta Cliente
          </button>
          <button className="btn btn-primary" onClick={openNewModal}><i className="fa-solid fa-plus"></i> Nueva Venta / Factura</button>
        </div>
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
                    <button className="btn btn-secondary btn-sm" style={{background:'#e0f2fe', color:'#0284c7', borderColor:'#bae6fd'}} title="Ver Estado de Cuenta del Cliente" onClick={()=>{ setSelectedCliente(s.cliente_name); loadEstadoCuenta(s.cliente_name); setShowEstadoModal(true); }}>
                      <i className="fa-solid fa-file-invoice-dollar"></i>
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

            {/* Formulario Cliente y Factura Adaptado a Móvil */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'0.75rem', marginBottom:'0.75rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Nombre del Cliente *</label>
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

            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'0.75rem', marginBottom:'1rem'}}>
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

            {/* Tabla Productos con Scroll Horizontal Garantizado */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem'}}>
              <h3 style={{fontSize:'0.9rem', fontWeight:700}}><i className="fa-solid fa-box-open"></i> Productos a Despachar</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setForm(f=>({...f, items:[...f.items, emptyItem()]}))}>+ Agregar Producto</button>
            </div>

            <div style={{overflowX:'auto', WebkitOverflowScrolling:'touch', border:'1px solid #e2e8f0', borderRadius:10, padding:'0.6rem', background:'#fff', marginBottom:'1rem'}}>
              <div style={{minWidth:620}}>
                <div style={{display:'grid', gridTemplateColumns:'2.2fr 1.1fr 75px 95px 95px 38px', gap:'0.5rem', marginBottom:'0.35rem', padding:'0 0.25rem', alignItems:'center'}}>
                  {['PRODUCTO','PRECIO CUAL','CANT.','PRECIO $','SUBTOTAL $',''].map((h,i) => (
                    <span key={i} style={{fontSize:'0.75rem', fontWeight:700, color:'var(--text-secondary)'}}>{h}</span>
                  ))}
                </div>
                <div style={{maxHeight:260, overflowY:'auto'}}>
                  {form.items.map((item, i) => (
                    <div key={i} style={{display:'grid', gridTemplateColumns:'2.2fr 1.1fr 75px 95px 95px 38px', gap:'0.5rem', marginBottom:'0.4rem', alignItems:'center'}}>
                      <select className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem', minHeight:38}} value={item.productoId} onChange={e=>selectProduct(i, e.target.value)}>
                        <option value="">-- Seleccionar producto --</option>
                        {productos.map(p => (
                          <option key={p.id} value={p.id} disabled={Number(p.cantidad)<=0}>
                            {p.nombre} (Stock: {p.cantidad} | P1:${Number(p.precio_venta1||0).toFixed(2)})
                          </option>
                        ))}
                      </select>
                      <select className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem', minHeight:38}} value={item.precioOpcion || '1'} onChange={e=>selectPrecio(i, e.target.value)}>
                        <option value="1">Precio 1</option>
                        <option value="2">Precio 2</option>
                        <option value="3">Precio 3</option>
                        <option value="custom">Personalizado</option>
                      </select>
                      <input type="number" className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem', minHeight:38}} min="1" value={item.cantidad} onChange={e=>updateItem(i, {cantidad:e.target.value})} />
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder={item.precioOpcion === 'custom' ? '0.00' : ''}
                        readOnly={item.precioOpcion !== 'custom'}
                        style={{
                          fontSize:'0.82rem',
                          padding:'0.35rem 0.5rem',
                          minHeight:38,
                          fontWeight:600,
                          backgroundColor: item.precioOpcion === 'custom' ? '#fff' : '#f1f5f9',
                          color: item.precioOpcion === 'custom' ? '#0284c7' : '#334155',
                          borderColor: item.precioOpcion === 'custom' ? '#0284c7' : '#cbd5e1',
                          cursor: item.precioOpcion === 'custom' ? 'text' : 'not-allowed'
                        }}
                        value={item.precioUnitario}
                        onChange={e => {
                          if (item.precioOpcion === 'custom') {
                            updateItem(i, { precioUnitario: e.target.value });
                          }
                        }}
                        title={item.precioOpcion !== 'custom' ? 'Precio de catálogo protegido (selecciona "Personalizado" para modificar)' : 'Escribe el precio libre'}
                      />
                      <span style={{fontWeight:700, color:'var(--primary)', fontSize:'0.88rem', textAlign:'right', paddingRight:'0.25rem'}}>${Number(item.subtotal||0).toFixed(2)}</span>
                      <button type="button" className="btn btn-danger btn-sm" style={{width:38, height:38, minHeight:38, minWidth:38, padding:0, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'}} title="Eliminar renglón" onClick={()=>setForm(f=>({...f, items:f.items.filter((_,j)=>j!==i)}))}>
                        <i className="fa-solid fa-trash" style={{fontSize:'0.8rem'}}></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Totales Venta */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0f172a', color:'#fff', padding:'0.85rem 1rem', borderRadius:10, marginTop:'1rem', flexWrap:'wrap', gap:'0.75rem'}}>
              <div style={{fontSize:'0.85rem'}}>Unidades Totales: <strong style={{color:'#fbbf24', fontSize:'1.05rem'}}>{totalUnidades}</strong></div>
              <div style={{display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap'}}>
                <div style={{fontSize:'0.85rem'}}>
                  TOTAL ($): <strong style={{color:'#38bdf8', fontSize:'1.15rem'}}>${totalFactura.toFixed(2)}</strong>
                </div>
                <div style={{fontSize:'0.85rem'}}>
                  (Bs.): <strong style={{color:'#a7f3d0', fontSize:'1.05rem'}}>Bs. {(totalFactura * bcvTasa).toLocaleString('es-VE',{minimumFractionDigits:2})}</strong>
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
          <div className="modal-content" style={{maxWidth:460, width:'95%', maxHeight:'80dvh', display:'flex', flexDirection:'column', padding:'1rem 1.15rem', margin:'auto'}}>
            <div className="modal-header" style={{marginBottom:'0.5rem', paddingBottom:'0.35rem', flexShrink:0}}>
              <div>
                <h2 style={{fontSize:'1.05rem', fontWeight:800, color:'#0f172a', margin:0}}>
                  <i className="fa-solid fa-receipt" style={{color:'#0284c7', marginRight:6}}></i> Vista Previa · Ticket (7.6 cm)
                </h2>
                <div style={{fontSize:'0.72rem', color:'#64748b', fontWeight:600}}>Listo para enviar a tu impresora térmica</div>
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowTicketModal(false)}>&times;</button>
            </div>

            {/* Ticket Preview Exact Matching User Photo */}
            {lastSalida && (() => {
              const items = lastSalida.items || [];
              const totalUnits = items.reduce((s, it) => s + parseInt(it.cantidad || 0), 0);
              const cleanFecha = String(lastSalida.fecha || '').split('T')[0];
              return (
                <div id="ticketPrintableArea" className="ticket-preview-box" style={{background:'#fff', border:'1px solid #94a3b8', borderRadius:6, padding:'12px 10px', fontFamily:'Arial, Helvetica, sans-serif', fontSize:'11px', color:'#000', flex:'1 1 auto', maxHeight:'38dvh', overflowY:'auto', overflowX:'hidden', lineHeight:1.35, width:'100%', boxSizing:'border-box', touchAction:'pan-y', WebkitOverflowScrolling:'touch'}}>
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
                  
                  <table style={{width:'100%', minWidth:0, borderCollapse:'collapse', fontSize:'11px', margin:'6px 0', tableLayout:'fixed'}}>
                    <thead>
                      <tr style={{borderBottom:'1.5px solid #000'}}>
                        <th style={{textAlign:'left', width:'12%', padding:'3px 0', background:'transparent', color:'#000', fontSize:'10.5px', fontWeight:800}}>CAN</th>
                        <th style={{textAlign:'left', width:'46%', padding:'3px 0', background:'transparent', color:'#000', fontSize:'10.5px', fontWeight:800}}>DESCRIPCIÓN</th>
                        <th style={{textAlign:'right', width:'21%', padding:'3px 0', background:'transparent', color:'#000', fontSize:'10.5px', fontWeight:800}}>P/U</th>
                        <th style={{textAlign:'right', width:'21%', padding:'3px 0', background:'transparent', color:'#000', fontSize:'10.5px', fontWeight:800}}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => {
                        const pu = Number(it.precioUnitario || it.precio_unitario || 0);
                        const cant = Number(it.cantidad || 0);
                        const tot = pu * cant;
                        return (
                          <tr key={i} style={{borderBottom:'1px dashed #e2e8f0'}}>
                            <td style={{padding:'4px 0', verticalAlign:'top', background:'transparent', color:'#000', fontSize:'11px'}}>{cant}</td>
                            <td style={{padding:'4px 0', verticalAlign:'top', background:'transparent', color:'#000', fontSize:'11px', fontWeight:600, wordBreak:'break-word'}}>{it.productoNombre || it.producto_nombre}</td>
                            <td style={{textAlign:'right', padding:'4px 0', verticalAlign:'top', background:'transparent', color:'#000', fontSize:'11px'}}>${pu.toFixed(2)}</td>
                            <td style={{textAlign:'right', padding:'4px 0', verticalAlign:'top', background:'transparent', color:'#000', fontSize:'11px', fontWeight:700}}>${tot.toFixed(2)}</td>
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
                  
                  <div style={{border:'1px solid #475569', borderRadius:'8px', padding:'8px 10px', margin:'10px 0 4px 0', background:'#fafafa', fontSize:'9.5px', lineHeight:1.45}}>
                    <div style={{fontWeight:800, fontSize:'10.5px', textAlign:'center', color:'#0f172a', marginBottom:'4px'}}>— PAGO MÓVIL BDV —</div>
                    <div style={{textAlign:'left', paddingLeft:'2px', display:'flex', flexDirection:'column', gap:'2px', color:'#1e293b'}}>
                      <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3136805</strong> &nbsp;|&nbsp; C.I. 10.668.263</div>
                      <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3004802</strong> &nbsp;|&nbsp; C.I. 28.012.615</div>
                    </div>
                    <div style={{borderTop:'1px dashed #cbd5e1', margin:'6px 0'}}></div>
                    <div style={{fontWeight:800, fontSize:'10.5px', textAlign:'center', color:'#0f172a', marginBottom:'4px'}}>— DEPÓSITO BANCARIO BDV —</div>
                    <div style={{textAlign:'left', paddingLeft:'2px', display:'flex', flexDirection:'column', gap:'2px', color:'#1e293b'}}>
                      <div>• <strong>0102 0467 4501 0162 8166</strong> <span style={{fontSize:'8.5px', color:'#475569'}}>(JUAN MORA)</span></div>
                      <div>• <strong>0102 0467 4500 0096 7787</strong> <span style={{fontSize:'8.5px', color:'#475569'}}>(JORGE FLORES)</span></div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{display:'flex', gap:'0.75rem', marginTop:'0.75rem', flexShrink:0}}>
              <button
                type="button"
                className="btn btn-primary"
                style={{width:'100%', fontSize:'0.95rem', padding:'0.75rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', background:'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', borderRadius:10}}
                onClick={printTicket}
              >
                <i className="fa-solid fa-print" style={{fontSize:'1.1rem'}}></i> Enviar a Impresora Térmica (7.6 cm)
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
          <div className="modal-content" style={{maxWidth:860, width:'95%', padding:'1.5rem'}}>
            <div className="modal-header">
              <div>
                <h2><i className="fa-solid fa-file-invoice-dollar" style={{color:'#0284c7'}}></i> Estado de Cuenta del Cliente</h2>
                <p style={{fontSize:'0.8rem', color:'var(--text-secondary)', margin:'2px 0 0 0'}}>Resumen detallado de compras, abonos y saldo deudor pendiente</p>
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowEstadoModal(false)}>&times;</button>
            </div>

            {/* Selector de Cliente y Filtros */}
            <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:'0.85rem', borderRadius:8, marginBottom:'1rem', display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap'}}>
              <div style={{flex:1, minWidth:220}}>
                <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700, marginBottom:'0.25rem'}}>Seleccionar o Buscar Cliente:</label>
                <select className="form-control" style={{fontSize:'0.9rem'}} value={selectedCliente} onChange={e=>{ setSelectedCliente(e.target.value); loadEstadoCuenta(e.target.value); }}>
                  <option value="">-- Cargar Lista de Clientes --</option>
                  {clientes.map((c,i) => <option key={i} value={c.cliente_name}>{c.cliente_name} (Deuda: ${Number(c.saldo_pendiente_usd||0).toFixed(2)})</option>)}
                </select>
              </div>
              <div style={{minWidth:220}}>
                <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700, marginBottom:'0.25rem'}}>Filtrar Notas del Documento:</label>
                <select className="form-control" style={{fontSize:'0.9rem', fontWeight:700, color:'#0284c7'}} value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}>
                  <option value="todas">📋 Todas (Ver todo el historial)</option>
                  <option value="pendientes">🔴 Solo Pendientes (Por cobrar)</option>
                  <option value="pagadas">🟢 Solo Pagadas (Historial al día)</option>
                </select>
              </div>
              <button type="button" className="btn btn-secondary" style={{marginTop:'1.2rem', minHeight:42}} onClick={()=>loadEstadoCuenta(selectedCliente)} disabled={loadingEstado}>
                {loadingEstado ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-arrows-rotate"></i>} Actualizar
              </button>
            </div>

            {estadoCuenta && (() => {
              const salidas = (estadoCuenta.salidas || []).filter(s => {
                const saldo = parseFloat(s.saldo_adeudado || 0);
                if (filtroEstado === 'pendientes') return saldo > 0.001;
                if (filtroEstado === 'pagadas') return saldo <= 0.001;
                return true;
              });

              const abonos = estadoCuenta.abonos || [];
              const c = estadoCuenta.cliente || {};
              const tasa = Number(estadoCuenta.totales?.tasa_bcv || bcvTasa || 798.33);

              const calcTotalComprasUSD = salidas.reduce((a, b) => a + (parseFloat(b.total_factura) || 0), 0);
              const calcSaldoUSD = salidas.reduce((a, b) => a + (parseFloat(b.saldo_adeudado) || 0), 0);
              const calcAbonadoUSD = Math.max(0, calcTotalComprasUSD - calcSaldoUSD);

              const calcTotalComprasVES = calcTotalComprasUSD * tasa;
              const calcAbonadoVES = calcAbonadoUSD * tasa;
              const calcSaldoVES = calcSaldoUSD * tasa;

              const formatBs = (num) => Number(num || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              return (
                <div>
                  {/* Vista Previa Imprimible / Exportable */}
                  <div style={{maxHeight:'58vh', overflowY:'auto', background:'#fff', border:'1px solid #cbd5e1', borderRadius:8, padding:'1rem'}}>
                    <div id="estadoCuentaDocument" style={{fontFamily:'Arial, Helvetica, sans-serif', color:'#0f172a', padding:'0.5rem', background:'#fff'}}>
                      {/* Encabezado Empresa */}
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'2px solid #0f172a', paddingBottom:'0.75rem', marginBottom:'1rem'}}>
                        <div>
                          <h2 style={{fontSize:'1.25rem', fontWeight:800, color:'#0f172a', margin:0}}>BESTEDA 2, C.A.</h2>
                          <p style={{fontSize:'0.8rem', fontWeight:700, color:'#475569', margin:'2px 0 0 0'}}>RIF: J-40529263-6</p>
                          <p style={{fontSize:'0.75rem', color:'#64748b', margin:'2px 0 0 0'}}>San Juan de los Morros - Estado Guárico | Tlfs: 0424-313.68.05</p>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <span style={{background:'#0f172a', color:'#fff', padding:'4px 10px', borderRadius:'4px', fontWeight:800, fontSize:'0.85rem', letterSpacing:'0.5px'}}>
                            ESTADO DE CUENTA DE CLIENTE
                          </span>
                          <p style={{fontSize:'0.75rem', color:'#64748b', marginTop:'6px'}}>
                            Fecha Emisión: {new Date().toLocaleDateString('es-VE')}
                          </p>
                        </div>
                      </div>

                      {/* Ficha Cliente */}
                      <div style={{background:'#f8fafc', border:'1px solid #cbd5e1', borderRadius:'6px', padding:'0.75rem 1rem', marginBottom:'1rem', display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:'0.5rem', fontSize:'0.85rem'}}>
                        <div>
                          <div><span style={{color:'#64748b', fontWeight:600}}>CLIENTE:</span> <strong>{c.name || selectedCliente}</strong></div>
                          <div><span style={{color:'#64748b', fontWeight:600}}>C.I. / RIF:</span> <strong>{c.cedula_rif || 'N/A'}</strong></div>
                        </div>
                        <div>
                          <div><span style={{color:'#64748b', fontWeight:600}}>TELÉFONO:</span> <strong>{c.telefono || 'N/A'}</strong></div>
                          <div><span style={{color:'#64748b', fontWeight:600}}>DIRECCIÓN:</span> <strong>{c.direccion || 'N/A'}</strong></div>
                        </div>
                      </div>

                      {/* 3 KPI Cards Resumen */}
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1.2fr', gap:'0.75rem', marginBottom:'1.25rem'}}>
                        <div style={{background:'#f1f5f9', padding:'0.75rem', borderRadius:'6px', textAlign:'center', border:'1px solid #e2e8f0'}}>
                          <span style={{fontSize:'0.75rem', color:'#64748b', fontWeight:700, textTransform:'uppercase'}}>Total Compras</span>
                          <div style={{fontSize:'1.25rem', fontWeight:800, color:'#0f172a'}}>${calcTotalComprasUSD.toFixed(2)}</div>
                          <div style={{fontSize:'0.75rem', color:'#64748b'}}>Bs. {formatBs(calcTotalComprasVES)}</div>
                        </div>
                        <div style={{background:'#f0fdf4', padding:'0.75rem', borderRadius:'6px', textAlign:'center', border:'1px solid #bbf7d0'}}>
                          <span style={{fontSize:'0.75rem', color:'#166534', fontWeight:700, textTransform:'uppercase'}}>Total Abonado</span>
                          <div style={{fontSize:'1.25rem', fontWeight:800, color:'#15803d'}}>${calcAbonadoUSD.toFixed(2)}</div>
                          <div style={{fontSize:'0.75rem', color:'#166534'}}>Bs. {formatBs(calcAbonadoVES)}</div>
                        </div>
                        <div style={{background:calcSaldoUSD>0?'#fef2f2':'#f0fdf4', padding:'0.75rem', borderRadius:'6px', textAlign:'center', border:`2px solid ${calcSaldoUSD>0?'#ef4444':'#16a34a'}`}}>
                          <span style={{fontSize:'0.75rem', color:calcSaldoUSD>0?'#dc2626':'#16a34a', fontWeight:800, textTransform:'uppercase'}}>
                            {calcSaldoUSD > 0 ? '🔴 SALDO PENDIENTE' : '✅ AL DÍA (SIN DEUDA)'}
                          </span>
                          <div style={{fontSize:'1.3rem', fontWeight:800, color:calcSaldoUSD>0?'#dc2626':'#16a34a'}}>${calcSaldoUSD.toFixed(2)} USD</div>
                          <div style={{fontSize:'0.82rem', fontWeight:700, color:calcSaldoUSD>0?'#dc2626':'#16a34a'}}>Bs. {formatBs(calcSaldoVES)}</div>
                          <div style={{fontSize:'0.7rem', color:'#64748b', marginTop:'2px'}}>Tasa BCV Ref: Bs. {tasa.toFixed(2)}/$</div>
                        </div>
                      </div>

                      {/* Tabla 1: Historial Compras / Salidas */}
                      <h4 style={{fontSize:'0.88rem', fontWeight:700, color:'#0f172a', marginBottom:'0.4rem', textTransform:'uppercase', display:'flex', alignItems:'center'}}>
                        <i className="fa-solid fa-list" style={{marginRight:6}}></i> Historial de Notas de Entrega / Compras
                        {filtroEstado === 'pendientes' && <span style={{marginLeft:8, fontSize:'0.72rem', color:'#dc2626', fontWeight:700}}>(Solo Pendientes)</span>}
                        {filtroEstado === 'pagadas' && <span style={{marginLeft:8, fontSize:'0.72rem', color:'#16a34a', fontWeight:700}}>(Solo Pagadas)</span>}
                      </h4>
                      <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'1.25rem', background:'#fff', minWidth:0}}>
                        <thead>
                          <tr style={{background:'#f0f9ff', fontSize:'0.75rem', color:'#475569', textTransform:'uppercase', borderBottom:'1px solid #cbd5e1'}}>
                            <th style={{padding:'6px 8px', textAlign:'left'}}>Fecha</th>
                            <th style={{padding:'6px 8px', textAlign:'left'}}>Documento</th>
                            <th style={{padding:'6px 8px', textAlign:'right'}}>Total USD</th>
                            <th style={{padding:'6px 8px', textAlign:'right'}}>Abonado USD</th>
                            <th style={{padding:'6px 8px', textAlign:'right'}}>Saldo Pend.</th>
                            <th style={{padding:'6px 8px', textAlign:'center'}}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salidas.length === 0 ? (
                            <tr><td colSpan={6} style={{textAlign:'center', padding:'1rem', color:'#94a3b8'}}>No se encontraron notas con la opción seleccionada.</td></tr>
                          ) : salidas.map(s => {
                            const tot = parseFloat(s.total_factura || 0);
                            const saldo = parseFloat(s.saldo_adeudado || 0);
                            const abonado = Math.max(0, tot - saldo);
                            const isPend = saldo > 0.001;
                            return (
                              <tr key={s.id} style={{borderBottom:'1px solid #e2e8f0', fontSize:'0.82rem'}}>
                                <td style={{padding:'6px 8px'}}>{s.fecha ? String(s.fecha).split('T')[0] : ''}</td>
                                <td style={{padding:'6px 8px', fontWeight:700}}>NOTA DE ENTREGA Nº {s.factura_number}</td>
                                <td style={{padding:'6px 8px', textAlign:'right'}}>${tot.toFixed(2)}</td>
                                <td style={{padding:'6px 8px', textAlign:'right', color:'#15803d'}}>${abonado.toFixed(2)}</td>
                                <td style={{padding:'6px 8px', textAlign:'right', fontWeight:700, color:isPend?'#b91c1c':'#15803d'}}>${saldo.toFixed(2)}</td>
                                <td style={{padding:'6px 8px', textAlign:'center'}}>
                                  <span style={{color:isPend?'#b91c1c':'#15803d', fontWeight:700}}>{isPend ? 'Pendiente' : 'Pagado'}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Tabla 2: Historial Abonos */}
                      <h4 style={{fontSize:'0.88rem', fontWeight:700, color:'#0f172a', marginBottom:'0.4rem', textTransform:'uppercase', display:'flex', alignItems:'center'}}>
                        <i className="fa-solid fa-receipt" style={{marginRight:6}}></i> Historial de Abonos / Pagos Recibidos
                      </h4>
                      <table style={{width:'100%', borderCollapse:'collapse', background:'#fff', minWidth:0}}>
                        <thead>
                          <tr style={{background:'#f0f9ff', fontSize:'0.75rem', color:'#475569', textTransform:'uppercase', borderBottom:'1px solid #cbd5e1'}}>
                            <th style={{padding:'6px 8px', textAlign:'left'}}>Fecha Pago</th>
                            <th style={{padding:'6px 8px', textAlign:'left'}}>Nota Afectada</th>
                            <th style={{padding:'6px 8px', textAlign:'left'}}>Referencia / Método</th>
                            <th style={{padding:'6px 8px', textAlign:'right'}}>Monto USD</th>
                            <th style={{padding:'6px 8px', textAlign:'right'}}>Monto VES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {abonos.length === 0 ? (
                            <tr><td colSpan={5} style={{textAlign:'center', padding:'1rem', color:'#94a3b8'}}>No ha realizado abonos aún.</td></tr>
                          ) : abonos.map((a, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #e2e8f0', fontSize:'0.82rem'}}>
                              <td style={{padding:'6px 8px'}}>{a.fecha ? String(a.fecha).split('T')[0] : ''}</td>
                              <td style={{padding:'6px 8px'}}>Nota Nº {a.factura_number || 'General'}</td>
                              <td style={{padding:'6px 8px'}}>{a.referencia || 'Efectivo / Transferencia'}</td>
                              <td style={{padding:'6px 8px', textAlign:'right', fontWeight:700, color:'#166534'}}>${parseFloat(a.monto_usd||0).toFixed(2)}</td>
                              <td style={{padding:'6px 8px', textAlign:'right', color:'#0284c7', fontWeight:600}}>Bs. {formatBs(a.monto_ves)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Acciones: Exportar PDF / Imprimir */}
                  <div style={{display:'flex', gap:'0.75rem', marginTop:'1.25rem', justifyContent:'flex-end', flexWrap:'wrap'}}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={generatingPdf}
                      style={{background:'#0284c7', color:'#fff', border:'none', fontWeight:700, padding:'0.65rem 1.25rem'}}
                      onClick={handleExportPDF}
                    >
                      {generatingPdf ? <><i className="fa-solid fa-spinner fa-spin"></i> Generando PDF...</> : <><i className="fa-solid fa-file-pdf" style={{fontSize:'1.1rem'}}></i> Exportar a PDF</>}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{background:'#475569', color:'#fff', border:'none', fontWeight:700, padding:'0.65rem 1.25rem'}}
                      onClick={handlePrintDoc}
                    >
                      <i className="fa-solid fa-print" style={{fontSize:'1.1rem'}}></i> Imprimir Documento
                    </button>
                  </div>
                </div>
              );
            })()}

            {!estadoCuenta && (
              <div style={{textAlign:'center', color:'var(--text-muted)', padding:'3rem 2rem', background:'#fff', border:'1px dashed #cbd5e1', borderRadius:8}}>
                <i className="fa-solid fa-user-tag" style={{fontSize:'3rem', marginBottom:'0.75rem', color:'#94a3b8', display:'block'}}></i>
                <p style={{fontSize:'1rem', fontWeight:600, color:'#475569', margin:0}}>Selecciona un cliente arriba para generar su Estado de Cuenta oficial.</p>
                <p style={{fontSize:'0.82rem', color:'#94a3b8', marginTop:'4px'}}>Podrás ver sus compras, abonos, deuda pendiente y exportarlo a PDF o imprimirlo.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
