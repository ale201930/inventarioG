'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';

function today() { return new Date().toISOString().split('T')[0]; }
function todayPlus7() { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().split('T')[0]; }

const emptyItem = () => ({ codigo:'', nombre:'', cantidad:1, costoUSD:0, totalUSD:0, totalVES:0 });

export default function EntradasPage() {
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [bcvTasa, setBcvTasa] = useState(798.33);
  const [currentEntradaId, setCurrentEntradaId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrRunning, setOcrRunning] = useState(false);
  const [facturaImg, setFacturaImg] = useState(null);

  const [form, setForm] = useState({
    proveedorName:'', proveedorRif:'', proveedorTelf:'', proveedorDir:'',
    tipoDoc:'NOTA DE ENTREGA', facturaNum:'', fecha:today(), fechaVenc:todayPlus7(),
    tasaBCV:798.33, totalUSD:0, totalVES:0, observaciones:'',
    items:[emptyItem()]
  });
  const [abonoForm, setAbonoForm] = useState({ entradaId:'', montoUSD:0, montoVES:0, referencia:'', fecha:today() });

  const load = () => {
    setLoading(true);
    fetch('/api/entradas')
      .then(r => r.json())
      .then(d => { if (d.success) setEntradas(d.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { fetch('/api/bcv').then(r=>r.json()).then(d => { if(d.success) setBcvTasa(d.data.tasaHoy); }); }, []);

  const filteredEntradas = entradas.filter(e => {
    const q = searchText.toLowerCase();
    const matchText = !q || e.proveedor_name.toLowerCase().includes(q) || (e.factura_number||'').toLowerCase().includes(q);
    const matchFecha = !filterFecha || e.fecha === filterFecha;
    return matchText && matchFecha;
  });

  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    if (field === 'cantidad' || field === 'costoUSD') {
      items[i].totalUSD = parseFloat(items[i].cantidad||0) * parseFloat(items[i].costoUSD||0);
      items[i].totalVES = items[i].totalUSD * form.tasaBCV;
    }
    const totalUSD = items.reduce((s,it) => s + parseFloat(it.totalUSD||0), 0);
    setForm(f => ({ ...f, items, totalUSD: totalUSD.toFixed(2), totalVES: (totalUSD * f.tasaBCV).toFixed(2) }));
  };

  const handleSave = async (confirmed) => {
    if (!confirmed) { setShowPreviewModal(true); return; }
    setSaving(true);
    try {
      const payload = {
        proveedorName: form.proveedorName, proveedorRif: form.proveedorRif,
        proveedorTelefono: form.proveedorTelf, proveedorDireccion: form.proveedorDir,
        tipoDocumento: form.tipoDoc, numeroDocumento: form.facturaNum,
        fecha: form.fecha, fechaVencimiento: form.fechaVenc,
        tasaBCV: parseFloat(form.tasaBCV), totalUSD: parseFloat(form.totalUSD), totalVES: parseFloat(form.totalVES),
        observaciones: form.observaciones,
        items: form.items.map(it => ({
          codigoProducto: it.codigo, productoNombre: it.nombre,
          cantidad: parseInt(it.cantidad||0),
          costoUnitarioUSD: parseFloat(it.costoUSD||0),
          costoUnitarioVES: parseFloat(it.costoUSD||0) * parseFloat(form.tasaBCV||798.33),
        })).filter(it => it.productoNombre && it.cantidad > 0)
      };
      const res = await fetch('/api/entradas', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const d = await res.json();
      if (d.success) {
        setShowModal(false); setShowPreviewModal(false); load();
        setForm({ proveedorName:'', proveedorRif:'', proveedorTelf:'', proveedorDir:'',
          tipoDoc:'NOTA DE ENTREGA', facturaNum:'', fecha:today(), fechaVenc:todayPlus7(),
          tasaBCV:798.33, totalUSD:0, totalVES:0, observaciones:'', items:[emptyItem()] });
      } else alert('Error: ' + d.error);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta compra? El stock será revertido.')) return;
    const res = await fetch(`/api/entradas?id=${id}`, { method:'DELETE' });
    const d = await res.json();
    if (d.success) load(); else alert(d.error);
  };

  const handleAbonoSave = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/abonos-entradas', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ entradaId:abonoForm.entradaId, montoUSD:parseFloat(abonoForm.montoUSD||0),
        montoVES:parseFloat(abonoForm.montoVES||0), referencia:abonoForm.referencia, fecha:abonoForm.fecha })
    });
    const d = await res.json();
    if (d.success) { setShowAbonoModal(false); load(); } else alert(d.error);
  };

  const handleOCR = async (file) => {
    if (!file) return;
    setFacturaImg(URL.createObjectURL(file));
    setOcrRunning(true);
    setOcrText('Iniciando escaneo OCR...');
    try {
      if (typeof window !== 'undefined' && window.Tesseract) {
        const result = await window.Tesseract.recognize(file, 'spa+eng', {
          logger: m => { if (m.status === 'recognizing text') setOcrText(`Escaneando... ${Math.round(m.progress*100)}%`); }
        });
        setOcrText('OCR completado: ' + result.data.text.slice(0,200));
        // Auto-extract numero de documento
        const numMatch = result.data.text.match(/(?:N[ºo°\.]\s*|#\s*)(\d{4,8})/i);
        if (numMatch) setForm(f => ({...f, facturaNum: numMatch[1]}));
      }
    } catch(err) { setOcrText('OCR no disponible: ' + err.message); }
    finally { setOcrRunning(false); }
  };

  const demoSosacruz = () => setForm(f => ({...f,
    proveedorName:'DISTRIBUIDORA Y TRANSPORTE SOSACRUZ, C.A.', proveedorRif:'J-50273341-8',
    tipoDoc:'NOTA DE ENTREGA', facturaNum:'032047', tasaBCV:bcvTasa.toFixed(2),
    items:[{codigo:'', nombre:'Lucky Nova 20 Cig x 10 Cajetillas (E)', cantidad:5, costoUSD:28.90, totalUSD:144.50, totalVES:144.50*bcvTasa}]
  }));

  return (
    <>
      {/* Tesseract.js OCR */}
      <Script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" strategy="lazyOnload" />

      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="fa-solid fa-truck-loading" style={{color:'var(--primary)'}}></i> Entradas / Compras a Proveedores</h1>
          <p className="page-subtitle">Carga de facturas/notas de entrega, escaneo OCR automático, control dual ($ / Bs.) e incremento de inventario</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><i className="fa-solid fa-plus"></i> Registrar Nueva Compra</button>
      </div>

      {/* Tabla Historial */}
      <div className="table-container">
        <div style={{padding:'1rem 1.25rem', background:'#fff', borderBottom:'1px solid var(--border-color)', display:'flex', flexWrap:'wrap', gap:'0.75rem', alignItems:'center', justifyContent:'space-between'}}>
          <h3 style={{fontSize:'1rem', fontWeight:600}}><i className="fa-solid fa-receipt"></i> Historial de Compras y Notas de Entrega</h3>
          <div style={{display:'flex', gap:'0.6rem', flexWrap:'wrap', alignItems:'center'}}>
            <input type="date" className="form-control" style={{minHeight:36, width:'auto', fontSize:'0.85rem'}} value={filterFecha} onChange={e=>setFilterFecha(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={()=>setFilterFecha('')}><i className="fa-solid fa-xmark"></i></button>
            <input type="text" className="form-control" placeholder="🔍 Buscar proveedor, Nº factura..." style={{maxWidth:220, minHeight:36, fontSize:'0.85rem'}} value={searchText} onChange={e=>setSearchText(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Tipo</th><th>Nº Documento</th><th>Fecha</th><th>Proveedor</th>
              <th>Tasa BCV</th><th>Total ($)</th><th>Total (Bs.)</th><th>Saldo Pendiente</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntradas.length === 0 ? (
              <tr><td colSpan={9} style={{textAlign:'center', padding:'2.5rem', color:'var(--text-muted)'}}>
                {searchText || filterFecha ? 'Sin resultados para los filtros' : 'Sin compras registradas'}
              </td></tr>
            ) : filteredEntradas.map(e => (
              <tr key={e.id}>
                <td><span className="badge badge-primary" style={{fontSize:'0.7rem'}}>{e.tipo_documento||'NOTA DE ENTREGA'}</span></td>
                <td style={{fontWeight:600}}>Nº {e.factura_number}</td>
                <td>{e.fecha ? String(e.fecha).split('T')[0] : '—'}</td>
                <td>
                  <div style={{fontWeight:600, fontSize:'0.88rem'}}>{e.proveedor_name}</div>
                  {e.proveedor_rif && <div style={{fontSize:'0.72rem', color:'var(--text-muted)'}}>{e.proveedor_rif}</div>}
                </td>
                <td><span style={{color:'var(--primary)', fontWeight:700, fontSize:'0.82rem'}}>Bs. {Number(e.tasa_bcv||0).toFixed(2)}</span></td>
                <td style={{fontWeight:700}}>${Number(e.total_factura||0).toFixed(2)}</td>
                <td style={{color:'#64748b', fontSize:'0.85rem'}}>Bs. {Number((e.total_factura||0)*(e.tasa_bcv||bcvTasa)).toLocaleString('es-VE',{minimumFractionDigits:2})}</td>
                <td>
                  <span className={`badge ${Number(e.saldo_adeudado)>0?'badge-warning':'badge-success'}`}>
                    ${Number(e.saldo_adeudado||0).toFixed(2)}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex', gap:'0.4rem'}}>
                    {Number(e.saldo_adeudado)>0 && (
                      <button className="btn btn-secondary btn-sm" title="Registrar abono"
                        onClick={()=>{ setAbonoForm({...abonoForm, entradaId:e.id}); setShowAbonoModal(true); }}>
                        <i className="fa-solid fa-dollar-sign"></i>
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(e.id)} title="Eliminar">
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Entrada */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={()=>setShowModal(false)} />
          <div className="modal-content" style={{maxWidth:950}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2><i className="fa-solid fa-file-circle-plus"></i> Cargar Factura de Proveedor / Entrada</h2>
                <p style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>Toma una foto de la factura o sube la imagen para escaneo automático OCR</p>
              </div>
              <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={demoSosacruz} style={{fontSize:'0.75rem', background:'#e0f2fe', color:'#0369a1', borderColor:'#bae6fd'}}>
                  💡 Ejemplo SOSACRUZ
                </button>
                <button type="button" className="modal-close" onClick={()=>setShowModal(false)}>&times;</button>
              </div>
            </div>

            {/* OCR upload zone */}
            <div style={{background:'#eff6ff', border:'2px dashed #3b82f6', borderRadius:10, padding:'0.85rem 1rem', marginBottom:'1rem'}}>
              <div style={{fontSize:'0.85rem', fontWeight:700, color:'#1e40af', marginBottom:'0.5rem', textAlign:'center'}}>📷 Capturar / Adjuntar Factura (Escaneo Inteligente OCR):</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
              <label style={{cursor:'pointer', background:'#2563eb', color:'#fff', padding:'0.65rem 0.8rem', borderRadius:6, textAlign:'center', fontWeight:700, fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem'}}>
                <i className="fa-solid fa-camera"></i> 📷 Tomar Foto con Cámara
                <input type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handleOCR(e.target.files[0])} />
              </label>
              <label style={{cursor:'pointer', background:'#fff', color:'#1d4ed8', border:'1.5px solid #3b82f6', padding:'0.65rem 0.8rem', borderRadius:6, textAlign:'center', fontWeight:700, fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem'}}>
                <i className="fa-solid fa-folder-open"></i> 📁 Subir de la Galería
                <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleOCR(e.target.files[0])} />
              </label>
            </div>
          </div>
          {ocrRunning && <div style={{background:'#fef3c7', border:'1px solid #f59e0b', color:'#92400e', padding:'0.6rem 0.85rem', borderRadius:6, fontSize:'0.82rem', marginBottom:'1rem'}}>
            <i className="fa-solid fa-spinner fa-spin"></i> {ocrText}
          </div>}
          {facturaImg && !ocrRunning && (
            <div style={{marginBottom:'1rem', textAlign:'center'}}>
              <img src={facturaImg} alt="Factura" style={{maxWidth:'100%', maxHeight:200, borderRadius:8, objectFit:'contain'}} />
              <button className="btn btn-danger btn-sm" style={{marginTop:'0.5rem'}} onClick={()=>setFacturaImg(null)}>Quitar Foto</button>
            </div>
          )}

          {/* Formulario */}
          <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:'0.85rem 1rem', borderRadius:10, marginBottom:'1rem'}}>
            <h4 style={{fontSize:'0.85rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'0.6rem', textTransform:'uppercase'}}><i className="fa-solid fa-building"></i> Datos del Proveedor</h4>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'0.75rem', marginBottom:'0.5rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Nombre o Razón Social *</label>
                <input type="text" className="form-control" placeholder="Distribuidora Central, C.A." required style={{fontSize:'0.88rem'}} value={form.proveedorName} onChange={e=>setForm(f=>({...f,proveedorName:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>RIF *</label>
                <input type="text" className="form-control" placeholder="J-12345678-9" style={{fontSize:'0.88rem'}} value={form.proveedorRif} onChange={e=>setForm(f=>({...f,proveedorRif:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Teléfono</label>
                <input type="text" className="form-control" placeholder="0412-1234567" style={{fontSize:'0.88rem'}} value={form.proveedorTelf} onChange={e=>setForm(f=>({...f,proveedorTelf:e.target.value}))} />
              </div>
            </div>
          </div>

          <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:'0.85rem 1rem', borderRadius:10, marginBottom:'1rem'}}>
            <h4 style={{fontSize:'0.85rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'0.6rem', textTransform:'uppercase'}}><i className="fa-solid fa-file-invoice"></i> Datos del Documento y Tasa BCV</h4>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1.5fr', gap:'0.75rem', marginBottom:'0.75rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Tipo Documento</label>
                <select className="form-control" style={{fontSize:'0.85rem'}} value={form.tipoDoc} onChange={e=>setForm(f=>({...f,tipoDoc:e.target.value}))}>
                  <option>NOTA DE ENTREGA</option><option>FACTURA</option><option>ORDEN DE COMPRA</option>
                </select>
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Nº Documento *</label>
                <input type="text" className="form-control" placeholder="032047" required style={{fontSize:'0.88rem'}} value={form.facturaNum} onChange={e=>setForm(f=>({...f,facturaNum:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700, color:'#0284c7'}}>🇻🇪 Tasa BCV (Bs./$)</label>
                <input type="number" step="0.0001" className="form-control" placeholder="798.33" required style={{fontSize:'0.92rem', fontWeight:700, color:'#0284c7'}} value={form.tasaBCV} onChange={e=>setForm(f=>({...f,tasaBCV:e.target.value}))} />
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Fecha Emisión</label>
                <input type="date" className="form-control" required style={{fontSize:'0.85rem'}} value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Fecha Vencimiento</label>
                <input type="date" className="form-control" style={{fontSize:'0.85rem'}} value={form.fechaVenc} onChange={e=>setForm(f=>({...f,fechaVenc:e.target.value}))} />
              </div>
            </div>
          </div>

          {/* Items */}
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem'}}>
            <h3 style={{fontSize:'0.95rem', fontWeight:700}}><i className="fa-solid fa-boxes-stacked"></i> Productos de la Factura</h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setForm(f=>({...f, items:[...f.items, emptyItem()]}))}>+ Agregar Producto</button>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 2fr 0.8fr 1fr 1fr auto', gap:'0.4rem', marginBottom:'0.25rem', padding:'0 0.25rem'}}>
            {['CÓDIGO','DESCRIPCIÓN / PRODUCTO','CANT.','COSTO $','TOTAL $',''].map((h,i) => (
              <span key={i} style={{fontSize:'0.75rem', fontWeight:700, color:'var(--text-secondary)'}}>{h}</span>
            ))}
          </div>
          <div style={{maxHeight:280, overflowY:'auto'}}>
            {form.items.map((item, i) => (
              <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 2fr 0.8fr 1fr 1fr auto', gap:'0.4rem', marginBottom:'0.4rem', alignItems:'center'}}>
                <input type="text" className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} placeholder="Código" value={item.codigo} onChange={e=>updateItem(i,'codigo',e.target.value)} />
                <input type="text" className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} placeholder="Nombre del producto" required value={item.nombre} onChange={e=>updateItem(i,'nombre',e.target.value)} />
                <input type="number" className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} min="1" value={item.cantidad} onChange={e=>updateItem(i,'cantidad',e.target.value)} />
                <input type="number" step="0.01" className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem'}} placeholder="0.00" value={item.costoUSD} onChange={e=>updateItem(i,'costoUSD',e.target.value)} />
                <span style={{fontWeight:700, color:'var(--primary)', fontSize:'0.85rem'}}>${Number(item.totalUSD||0).toFixed(2)}</span>
                <button type="button" className="btn btn-danger btn-sm" style={{padding:'0.25rem 0.5rem'}} onClick={()=>setForm(f=>({...f, items:f.items.filter((_,j)=>j!==i)}))}>×</button>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0f172a', color:'#fff', padding:'0.85rem 1.25rem', borderRadius:10, marginTop:'1rem', flexWrap:'wrap', gap:'0.75rem'}}>
            <div style={{fontSize:'0.85rem'}}>Unidades: <strong style={{color:'#fbbf24', fontSize:'1.05rem'}}>{form.items.reduce((s,it)=>s+parseInt(it.cantidad||0),0)}</strong></div>
            <div style={{display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap'}}>
              <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}>
                <label style={{fontSize:'0.82rem', color:'#38bdf8', fontWeight:700, margin:0}}>TOTAL COMPRA ($):</label>
                <input type="number" step="0.01" className="form-control" style={{width:120, fontSize:'1.1rem', fontWeight:800, color:'#38bdf8', background:'#1e293b', border:'1.5px solid #38bdf8', textAlign:'right', padding:'4px 8px'}} value={form.totalUSD} onChange={e=>setForm(f=>({...f, totalUSD:e.target.value, totalVES:(parseFloat(e.target.value||0)*parseFloat(f.tasaBCV||798.33)).toFixed(2)}))} />
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}>
                <label style={{fontSize:'0.82rem', color:'#a7f3d0', fontWeight:700, margin:0}}>(Bs.):</label>
                <input type="number" step="0.01" className="form-control" style={{width:140, fontSize:'1.05rem', fontWeight:800, color:'#a7f3d0', background:'#1e293b', border:'1.5px solid #a7f3d0', textAlign:'right', padding:'4px 8px'}} value={form.totalVES} onChange={e=>setForm(f=>({...f, totalVES:e.target.value}))} />
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-primary" style={{width:'100%', fontSize:'1rem', padding:'0.75rem', marginTop:'1.25rem'}} onClick={()=>handleSave(false)}>
            <i className="fa-solid fa-eye"></i> Previsualizar antes de Guardar
          </button>
        </div>
      </div>
      )}

      {/* Modal Preview */}
      {showPreviewModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={()=>setShowPreviewModal(false)} />
          <div className="modal-content" style={{maxWidth:900}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{marginBottom:'0.75rem', borderBottom:'2px solid var(--primary-light)', paddingBottom:'0.5rem'}}>
              <div>
                <h2><i className="fa-solid fa-clipboard-check" style={{color:'var(--success)'}}></i> Inspección Visual de Carga al Inventario</h2>
                <p style={{fontSize:'0.82rem', color:'var(--text-secondary)'}}>Verifica cómo quedará tu inventario después de procesar esta compra</p>
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowPreviewModal(false)}>&times;</button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', minWidth:600}}>
                <thead><tr><th>Producto</th><th>Cantidad</th><th>Costo USD</th><th>Total USD</th><th>Total Bs.</th></tr></thead>
                <tbody>
                  {form.items.filter(it=>it.nombre&&parseInt(it.cantidad||0)>0).map((it,i) => (
                    <tr key={i}>
                      <td>{it.nombre}</td>
                      <td><span className="badge badge-primary">{it.cantidad}</span></td>
                      <td>${Number(it.costoUSD||0).toFixed(2)}</td>
                      <td style={{fontWeight:700}}>${Number(it.totalUSD||0).toFixed(2)}</td>
                      <td style={{color:'var(--text-secondary)'}}>Bs. {Number((it.totalUSD||0)*parseFloat(form.tasaBCV||798.33)).toLocaleString('es-VE',{minimumFractionDigits:2})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:'1rem', marginTop:'1.25rem'}}>
              <button type="button" className="btn btn-secondary" onClick={()=>setShowPreviewModal(false)}><i className="fa-solid fa-arrow-left"></i> Volver a Editar</button>
              <button type="button" className="btn btn-primary" style={{background:'var(--success)', borderColor:'var(--success)'}} onClick={()=>handleSave(true)} disabled={saving}>
                {saving ? <><i className="fa-solid fa-spinner fa-spin"></i> Guardando...</> : <><i className="fa-solid fa-check-double"></i> Confirmar e Ingresar al Inventario</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abono */}
      {showAbonoModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={()=>setShowAbonoModal(false)} />
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Abono a Proveedor</h2>
              <button type="button" className="modal-close" onClick={()=>setShowAbonoModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAbonoSave}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                <div className="form-group">
                  <label className="form-label">Monto en USD ($)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="0.00" required value={abonoForm.montoUSD} onChange={e=>setAbonoForm(f=>({...f,montoUSD:e.target.value,montoVES:(parseFloat(e.target.value||0)*bcvTasa).toFixed(2)}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Monto en BS (VES)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="0.00" value={abonoForm.montoVES} onChange={e=>setAbonoForm(f=>({...f,montoVES:e.target.value}))} />
                </div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                <div className="form-group">
                  <label className="form-label">Fecha de Pago</label>
                  <input type="date" className="form-control" required value={abonoForm.fecha} onChange={e=>setAbonoForm(f=>({...f,fecha:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nº Referencia / Pago Móvil</label>
                  <input type="text" className="form-control" placeholder="Ej: 948302" value={abonoForm.referencia} onChange={e=>setAbonoForm(f=>({...f,referencia:e.target.value}))} />
                </div>
              </div>
              <div style={{marginTop:'1.5rem'}}>
                <button type="submit" className="btn btn-primary" style={{width:'100%'}}>Procesar Abono a Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
