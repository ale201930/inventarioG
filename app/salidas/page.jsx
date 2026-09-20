// app/salidas/page.jsx — Facturación y Despachos (idéntico a views/salidas.php + salidas_v2.js)
'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import ConfirmModal from '@/components/ConfirmModal';

function today() { return new Date().toISOString().split('T')[0]; }
const emptyItem = () => ({ productoId:'', productoNombre:'', precioOpcion:'1', cantidad:1, precioUnitario:0, subtotal:0 });

export default function SalidasPage() {
  const [salidas, setSalidas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [selectedVendedorFilter, setSelectedVendedorFilter] = useState('');
  const [bcvTasa, setBcvTasa] = useState(798.33);
  const [showModal, setShowModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSalida, setLastSalida] = useState(null);
  const [estadoCuenta, setEstadoCuenta] = useState(null);
  const [selectedClienteKey, setSelectedClienteKey] = useState('');
  const [selectedCliente, setSelectedCliente] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [loadingEstado, setLoadingEstado] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isPrintingMultiple, setIsPrintingMultiple] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: null,
    confirmText: 'Sí, Continuar',
    cancelText: 'Cancelar',
    variant: 'danger',
    icon: null,
    onConfirm: null,
    loading: false
  });

  const [form, setForm] = useState({
    clienteName:'', cedulaRif:'', telefono:'', fecha:today(), direccion:'',
    vendedorName:'', facturaNumber:'', observaciones:'',
    items:[emptyItem()]
  });
  const [abonoForm, setAbonoForm] = useState({ salidaId:'', clienteName:'', facturaNumber:'', totalFactura:0, saldoAdeudado:0, montoUSD:'', montoVES:'', referencia:'', fecha:today() });

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
      fetch('/api/vendedores').then(r=>r.json()),
    ]).then(([sal, inv, cli, vend]) => {
      if(sal.success) setSalidas(sal.data);
      if(inv.success) setProductos(inv.data);
      if(cli.success) setClientes(cli.data);
      if(vend.success) setVendedores(vend.data);
    }).finally(() => setLoading(false));
  };

  const handleSelectClienteFrecuente = (key) => {
    setSelectedClienteKey(key);
    if (!key) return;
    const found = clientes.find(c => (c.cedula_rif ? `CI:${c.cedula_rif}` : `NAME:${c.cliente_name}`) === key);
    if (found) {
      setForm(f => ({
        ...f,
        clienteName: found.cliente_name || '',
        cedulaRif: found.cedula_rif || '',
        telefono: found.telefono || '',
        direccion: found.direccion || ''
      }));
    }
  };

  const handleCedulaChange = (val) => {
    setForm(f => ({ ...f, cedulaRif: val }));
    const clean = val.trim().toLowerCase();
    if (clean.length >= 3) {
      const match = clientes.find(c => (c.cedula_rif || '').trim().toLowerCase() === clean);
      if (match && !form.clienteName) {
        setForm(f => ({
          ...f,
          cedulaRif: val,
          clienteName: match.cliente_name || '',
          telefono: match.telefono || '',
          direccion: match.direccion || ''
        }));
        setSelectedClienteKey(match.cedula_rif ? `CI:${match.cedula_rif}` : `NAME:${match.cliente_name}`);
      }
    }
  };

  const loadEstadoCuenta = async (clientKey) => {
    if (!clientKey) {
      setEstadoCuenta(null);
      return;
    }
    const found = clientes.find(c => (c.cedula_rif ? `CI:${c.cedula_rif}` : `NAME:${c.cliente_name}`) === clientKey);
    const name = found ? found.cliente_name : clientKey;
    const cedula = found ? (found.cedula_rif || '') : '';
    setLoadingEstado(true);
    try {
      const res = await fetch(`/api/salidas?action=estado_cuenta&cliente=${encodeURIComponent(name)}&cedula=${encodeURIComponent(cedula)}`);
      const d = await res.json();
      if (d.success) {
        setEstadoCuenta(d);
      } else {
        setConfirmDialog({
          isOpen: true,
          title: 'Error',
          message: d.error || 'Error cargando estado de cuenta.',
          confirmText: 'Entendido',
          variant: 'danger',
          onConfirm: () => setConfirmDialog(cd => ({ ...cd, isOpen: false })),
          onCancel: () => setConfirmDialog(cd => ({ ...cd, isOpen: false }))
        });
      }
    } catch {
      setConfirmDialog({
        isOpen: true,
        title: 'Error de Conexión',
        message: 'No se pudo conectar para cargar el estado de cuenta.',
        confirmText: 'Entendido',
        variant: 'danger',
        onConfirm: () => setConfirmDialog(cd => ({ ...cd, isOpen: false })),
        onCancel: () => setConfirmDialog(cd => ({ ...cd, isOpen: false }))
      });
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
    const matchText = !q || (s.cliente_name||'').toLowerCase().includes(q) || (s.factura_number||'').includes(q) || (s.vendedor_name||'').toLowerCase().includes(q);
    const matchFecha = !filterFecha || s.fecha === filterFecha;
    const matchVendedor = !selectedVendedorFilter || (s.vendedor_name || '').toLowerCase() === selectedVendedorFilter.toLowerCase();
    return matchText && matchFecha && matchVendedor;
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

  const handleSave = async (printTicket, skipDuplicateCheck = false) => {
    if (!skipDuplicateCheck && form.facturaNumber) {
      const numTrim = form.facturaNumber.toString().trim().toLowerCase();
      const docExiste = salidas.find(s => (s.factura_number || '').toString().trim().toLowerCase() === numTrim);
      if (docExiste) {
        setConfirmDialog({
          isOpen: true,
          title: '⚠️ Nota de Entrega Ya Registrada',
          message: (
            <div>
              <p style={{marginBottom:'0.5rem', color:'#334155'}}>
                Ya existe una venta registrada con la Nota de Entrega Nº <strong>"{form.facturaNumber}"</strong>:
              </p>
              <div style={{background:'#f8fafc', padding:'0.65rem 0.85rem', borderRadius:10, border:'1.5px solid #fed7aa', fontSize:'0.84rem', textAlign:'left', marginBottom:'0.75rem', color:'#1e293b'}}>
                <div><strong>👤 Cliente:</strong> {docExiste.cliente_name}</div>
                <div><strong>📅 Fecha:</strong> {docExiste.fecha ? String(docExiste.fecha).split('T')[0] : '—'}</div>
                <div><strong>💵 Total:</strong> ${Number(docExiste.total_factura||0).toFixed(2)}</div>
              </div>
              <p style={{margin:0, color:'#b45309', fontWeight:700, fontSize:'0.9rem'}}>
                ¿Deseas registrar esta venta de todos modos con el mismo número?
              </p>
            </div>
          ),
          confirmText: 'Sí, Registrar de Todos Modos',
          cancelText: 'Corregir Número',
          variant: 'warning',
          icon: 'fa-triangle-exclamation',
          onConfirm: () => {
            setConfirmDialog(cd => ({ ...cd, isOpen: false }));
            handleSave(printTicket, true);
          },
          onCancel: () => setConfirmDialog(cd => ({ ...cd, isOpen: false }))
        });
        return;
      }
    }

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
        setForm({ clienteName:'', cedulaRif:'', telefono:'', fecha:today(), direccion:'', vendedorName:'', facturaNumber:'', observaciones:'', items:[emptyItem()] });
      } else {
        setConfirmDialog({
          isOpen: true,
          title: 'Error al Registrar Venta',
          message: d.error || 'No se pudo guardar la venta.',
          confirmText: 'Entendido',
          cancelText: 'Cerrar',
          variant: 'danger',
          onConfirm: () => setConfirmDialog(cd => ({ ...cd, isOpen: false })),
          onCancel: () => setConfirmDialog(cd => ({ ...cd, isOpen: false }))
        });
      }
    } finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    const sal = salidas.find(s => s.id === id);
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar esta Venta?',
      message: (
        <div>
          <p style={{marginBottom:'0.5rem', color:'#334155'}}>
            ¿Deseas eliminar la venta <strong>{sal ? `Nº ${sal.factura_number} (${sal.cliente_name})` : ''}</strong>?
          </p>
          <p style={{margin:0, color:'#dc2626', fontSize:'0.82rem', fontWeight:600}}>
            ⚠️ El stock despachado en esta venta será repuesto al inventario.
          </p>
        </div>
      ),
      confirmText: 'Sí, Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
      icon: 'fa-trash-can',
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, loading: true }));
        try {
          const res = await fetch(`/api/salidas?id=${id}`, {method:'DELETE'});
          const d = await res.json();
          if (d.success) {
            setConfirmDialog(cd => ({ ...cd, isOpen: false }));
            load();
          } else {
            setConfirmDialog({
              isOpen: true,
              title: 'Error al Eliminar',
              message: d.error || 'No se pudo eliminar la venta.',
              confirmText: 'Entendido',
              cancelText: 'Cerrar',
              variant: 'danger',
              onConfirm: () => setConfirmDialog(cd => ({ ...cd, isOpen: false })),
              onCancel: () => setConfirmDialog(cd => ({ ...cd, isOpen: false }))
            });
          }
        } catch {
          setConfirmDialog(cd => ({ ...cd, isOpen: false }));
        }
      },
      onCancel: () => setConfirmDialog(d => ({ ...d, isOpen: false }))
    });
  };

  const handleQuickPagarTodo = (s) => {
    const saldoUSD = parseFloat(s.saldo_adeudado || 0);
    if (saldoUSD <= 0) return;
    const saldoVES = (saldoUSD * bcvTasa).toFixed(2);
    const saldoVESFormatted = (saldoUSD * bcvTasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    setConfirmDialog({
      isOpen: true,
      title: `Saldar Factura Nº ${s.factura_number}`,
      message: `¿Deseas registrar el pago total de $${saldoUSD.toFixed(2)} USD (Bs. ${saldoVESFormatted}) para dejar la Nota Nº ${s.factura_number} de ${s.cliente_name} completamente pagada ($0.00 de saldo)?`,
      confirmText: 'Sí, Saldar Factura Completa',
      cancelText: 'Cancelar',
      variant: 'success',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/abonos-salidas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              salidaId: s.id,
              clienteName: s.cliente_name,
              montoUSD: saldoUSD,
              montoVES: parseFloat(saldoVES),
              referencia: 'Pago Total Factura',
              fecha: today()
            })
          });
          const d = await res.json();
          setConfirmDialog(cd => ({ ...cd, isOpen: false }));
          if (d.success) {
            load();
          } else {
            setConfirmDialog({
              isOpen: true,
              title: 'Error al Saldar',
              message: d.error || 'No se pudo procesar el pago total.',
              confirmText: 'Entendido',
              cancelText: 'Cerrar',
              variant: 'danger',
              onConfirm: () => setConfirmDialog(cd => ({ ...cd, isOpen: false })),
              onCancel: () => setConfirmDialog(cd => ({ ...cd, isOpen: false }))
            });
          }
        } catch {
          setConfirmDialog(cd => ({ ...cd, isOpen: false }));
        }
      },
      onCancel: () => setConfirmDialog(d => ({ ...d, isOpen: false }))
    });
  };

  const handleAbonoSave = async (e) => {
    e.preventDefault();
    const montoUSD = parseFloat(abonoForm.montoUSD || 0);
    if (montoUSD <= 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'Monto Inválido',
        message: 'Por favor ingresa un monto válido mayor a 0 para el abono.',
        confirmText: 'Entendido',
        cancelText: 'Cerrar',
        variant: 'danger',
        onConfirm: () => setConfirmDialog(cd => ({ ...cd, isOpen: false })),
        onCancel: () => setConfirmDialog(cd => ({ ...cd, isOpen: false }))
      });
      return;
    }
    const res = await fetch('/api/abonos-salidas', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({salidaId:abonoForm.salidaId, clienteName:abonoForm.clienteName,
        montoUSD:montoUSD, montoVES:parseFloat(abonoForm.montoVES||0),
        referencia:abonoForm.referencia, fecha:abonoForm.fecha})
    });
    const d = await res.json();
    if (d.success) {
      setShowAbonoModal(false);
      load();
    } else {
      setConfirmDialog({
        isOpen: true,
        title: 'Error en Abono',
        message: d.error || 'No se pudo procesar el abono.',
        confirmText: 'Entendido',
        cancelText: 'Cerrar',
        variant: 'danger',
        onConfirm: () => setConfirmDialog(cd => ({ ...cd, isOpen: false })),
        onCancel: () => setConfirmDialog(cd => ({ ...cd, isOpen: false }))
      });
    }
  };

  const openNewModal = async () => {
    let nextNum = '3000';
    try {
      const res = await fetch('/api/salidas?action=next_number');
      const d = await res.json();
      if (d.success && d.nextNumber) nextNum = d.nextNumber;
    } catch {}

    // Refrescar lista de clientes y vendedores siempre al abrir el modal
    fetch('/api/salidas?action=clientes')
      .then(r => r.json())
      .then(d => { if (d.success) setClientes(d.data); })
      .catch(() => {});
    fetch('/api/vendedores')
      .then(r => r.json())
      .then(d => { if (d.success) setVendedores(d.data); })
      .catch(() => {});

    setSelectedClienteKey('');
    setForm({
      clienteName: '', cedulaRif: '', telefono: '', fecha: today(), direccion: '',
      vendedorName: '', facturaNumber: nextNum, observaciones: '',
      items: [emptyItem()]
    });
    setShowModal(true);
  };

  // Genera el HTML del cuerpo de una nota (reutilizado por printTicket y printMultiple)
  const buildNotaHTML = (salida) => {
    const items = salida.items || [];
    const totalUnits = items.reduce((s, it) => s + parseInt(it.cantidad || 0), 0);
    const cleanFecha = String(salida.fecha || '').split('T')[0];
    const styles = `
      * { box-sizing: border-box; }
      @page { size: 76mm auto; margin: 0; }
      body { width: 72mm; margin: 0 auto; padding: 2mm 1mm; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; line-height: 1.35; }
      .nota-wrap { width: 72mm; margin: 0 auto; padding: 2mm 1mm; page-break-after: always; }
      .nota-wrap:last-child { page-break-after: avoid; }
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
      .payment-box { border: 1.5px solid #000; border-radius: 8px; padding: 8px 10px; margin: 10px 0 4px 0; background: #fff; font-size: 10.5px; line-height: 1.45; color: #000; }
      .payment-title { font-weight: 800; font-size: 11px; text-align: center; margin-bottom: 4px; }
      .payment-data { text-align: left; padding-left: 2px; display: flex; flex-direction: column; gap: 2px; }
    `;
    const body = `
      <div class="nota-wrap">
        <div class="header-title">BESTEDA 2, C.A.</div>
        <div class="header-sub" style="font-weight:700;">RIF: J-40529263-6</div>
        <div class="header-sub">Calle Principal Casa Nº A-13, Urb. Alto de Fenix II</div>
        <div class="header-sub">San Juan de los Morros - Estado Guárico</div>
        <div class="header-sub">Tlfs: 0424-313.68.05 / 0424-300.48.02</div>
        <hr class="divider-solid" />
        <div class="doc-title">NOTA DE ENTREGA</div>
        <div class="doc-num">Nº ${salida.factura_number}</div>
        <hr class="divider-dashed" />
        <table class="info-table">
          <tr><td class="info-label">FECHA:</td><td class="info-val">${cleanFecha}</td></tr>
          ${(salida.vendedor_name || salida.vendedorName) ? `<tr><td class="info-label">VENDEDOR:</td><td class="info-val">${salida.vendedor_name || salida.vendedorName}</td></tr>` : ''}
          <tr><td class="info-label">CLIENTE:</td><td class="info-val">${salida.cliente_name || ''}</td></tr>
          <tr><td class="info-label">C.I./RIF:</td><td class="info-val">${salida.cedula_rif || '—'}</td></tr>
          <tr><td class="info-label">TELF:</td><td class="info-val">${salida.telefono || '—'}</td></tr>
          <tr><td class="info-label">DIR:</td><td class="info-val">${salida.direccion || '—'}</td></tr>
        </table>
        <hr class="divider-dashed" />
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:12%">CANT</th>
              <th style="width:46%">DESCRIPCIÓN</th>
              <th style="width:21%; text-align:right">P/U</th>
              <th style="width:21%; text-align:right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => {
              const pu = Number(it.precioUnitario || it.precio_unitario || 0);
              const cant = Number(it.cantidad || 0);
              const tot = pu * cant;
              return `<tr><td>${cant}</td><td>${it.productoNombre || it.producto_nombre || ''}</td><td class="text-right">$${pu.toFixed(2)}</td><td class="text-right">$${tot.toFixed(2)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
        <hr class="divider-solid" />
        <div class="totals-row">
          <span>UND: ${totalUnits}</span>
          <span>TOTAL: $${Number(salida.total_factura || 0).toFixed(2)}</span>
        </div>
        <div class="payment-box">
          <div class="payment-title">— PAGO MÓVIL BDV —</div>
          <div class="payment-data">
            <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3136805</strong> &nbsp;|&nbsp; C.I. 10.668.263</div>
            <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3004802</strong> &nbsp;|&nbsp; C.I. 28.012.615</div>
          </div>
          <div style="border-top:1px dashed #000; margin:6px 0;"></div>
          <div class="payment-title">— DEPÓSITO BANCARIO BDV —</div>
          <div class="payment-data">
            <div>• <strong>0102 0467 4501 0162 8166</strong> <span style="font-size:8.5px">(JUAN MORA)</span></div>
            <div>• <strong>0102 0467 4500 0096 7787</strong> <span style="font-size:8.5px">(JORGE FLORES)</span></div>
          </div>
          <div style="border-top:1px dashed #000; margin:6px 0;"></div>
          <div style="font-size:11.5px; font-weight:400; text-align:center; color:#000; line-height:1.35; padding-top:2px;">
            NOTA: Los pagos en Bs. emitidos en fines de semana o feriados se calculan a la tasa oficial BCV fijada para el siguiente día hábil (Art. 25 Ley del IVA).
          </div>
        </div>
      </div>
    `;
    return { styles, body };
  };

  // Genera el innerHTML del printDiv para una salida (igual al de printTicket pero parametrizado)
  const buildAndroidInnerHTML = (salida) => {
    const items = salida.items || [];
    const totalUnits = items.reduce((s, it) => s + parseInt(it.cantidad || 0), 0);
    const cleanFecha = String(salida.fecha || '').split('T')[0];
    return `
      <div style="text-align:center; font-weight:800; font-size:32px; margin-bottom:3px; letter-spacing:0.5px;">BESTEDA 2, C.A.</div>
      <div style="text-align:center; font-weight:700; font-size:20px; margin:2px 0;">RIF: J-40529263-6</div>
      <div style="text-align:center; font-size:17.5px; margin:1px 0;">Calle Principal Casa N\u00ba A-13, Urb. Alto de Fenix II</div>
      <div style="text-align:center; font-size:17.5px; margin:1px 0;">San Juan de los Morros - Estado Gu\u00e1rico</div>
      <div style="text-align:center; font-size:17.5px; margin:1px 0;">Tlfs: 0424-313.68.05 / 0424-300.48.02</div>
      <hr style="border:none; border-top:3px solid #000; margin:12px 0;" />
      <div style="text-align:center; font-weight:800; font-size:27px; letter-spacing:0.8px;">NOTA DE ENTREGA</div>
      <div style="text-align:center; font-weight:800; font-size:27px; margin-top:2px;">N\u00ba ${salida.factura_number}</div>
      <hr style="border:none; border-top:2.5px dashed #000; margin:12px 0;" />
      <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>FECHA:</b><span>${cleanFecha}</span></div>
      ${(salida.vendedor_name || salida.vendedorName) ? `<div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>VENDEDOR:</b><span style="font-weight:700;">${salida.vendedor_name || salida.vendedorName}</span></div>` : ''}
      <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>CLIENTE:</b><span style="font-weight:700;">${salida.cliente_name || ''}</span></div>
      <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>C.I./RIF:</b><span>${salida.cedula_rif || '\u2014'}</span></div>
      <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>TELF:</b><span>${salida.telefono || '\u2014'}</span></div>
      <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>DIR:</b><span>${salida.direccion || '\u2014'}</span></div>
      <hr style="border:none; border-top:2.5px dashed #000; margin:12px 0;" />
      <table style="width:100%; border-collapse:collapse; font-size:20.5px; margin:12px 0; table-layout:fixed;">
        <thead>
          <tr style="border-bottom:3px solid #000;">
            <th style="text-align:left; width:12%; padding:6px 0; font-size:19.5px; font-weight:800;">CANT</th>
            <th style="text-align:left; width:46%; padding:6px 0; font-size:19.5px; font-weight:800;">DESCRIPCI\u00d3N</th>
            <th style="text-align:right; width:21%; padding:6px 0; font-size:19.5px; font-weight:800;">P/U</th>
            <th style="text-align:right; width:21%; padding:6px 0; font-size:19.5px; font-weight:800;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => {
            const pu = Number(it.precioUnitario || it.precio_unitario || 0);
            const cant = Number(it.cantidad || 0);
            const tot = pu * cant;
            return `<tr style="border-bottom:1.5px dashed #000;">
              <td style="padding:8px 0; vertical-align:top; font-size:20.5px; font-weight:700;">${cant}</td>
              <td style="padding:8px 0; vertical-align:top; font-size:20.5px; font-weight:700; word-break:break-word;">${it.productoNombre || it.producto_nombre || ''}</td>
              <td style="text-align:right; padding:8px 0; vertical-align:top; font-size:20.5px;">$${pu.toFixed(2)}</td>
              <td style="text-align:right; padding:8px 0; vertical-align:top; font-size:20.5px; font-weight:800;">$${tot.toFixed(2)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <hr style="border:none; border-top:3px solid #000; margin:12px 0;" />
      <div style="display:flex; justify-content:space-between; font-weight:800; font-size:26px; margin:14px 0;">
        <span>UND: ${totalUnits}</span>
        <span>TOTAL: $${Number(salida.total_factura || 0).toFixed(2)}</span>
      </div>
      <div style="border:2.5px solid #000; border-radius:8px; padding:12px 10px; margin:14px 0 8px 0; background:#fff; font-size:17.5px; line-height:1.45; color:#000;">
        <div style="font-weight:800; font-size:19px; text-align:center; margin-bottom:8px;">\u2014 PAGO M\u00d3VIL BDV \u2014</div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div>\u2022 <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3136805</strong> &nbsp;|&nbsp; C.I. 10.668.263</div>
          <div>\u2022 <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3004802</strong> &nbsp;|&nbsp; C.I. 28.012.615</div>
        </div>
        <div style="border-top:2px dashed #000; margin:10px 0;"></div>
        <div style="font-weight:800; font-size:19px; text-align:center; margin-bottom:8px;">\u2014 DEP\u00d3SITO BANCARIO BDV \u2014</div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div>\u2022 <strong>0102 0467 4501 0162 8166</strong> <span style="font-size:15px;">(JUAN MORA)</span></div>
          <div>\u2022 <strong>0102 0467 4500 0096 7787</strong> <span style="font-size:15px;">(JORGE FLORES)</span></div>
        </div>
        <div style="border-top:2px dashed #000; margin:10px 0;"></div>
        <div style="font-size:18px; font-weight:400; text-align:center; color:#000; line-height:1.35; padding-top:2px;">
          NOTA: Los pagos en Bs. emitidos en fines de semana o feriados se calculan a la tasa oficial BCV fijada para el siguiente d\u00eda h\u00e1bil (Art. 25 Ley del IVA).
        </div>
      </div>
    `;
  };

  // Convierte un array de canvas binarizados a un stream de comandos ESC/POS binario
  // Incluye avance de papel y corte de papel automático entre cada factura
  const buildEscPosStream = (canvases) => {
    const chunks = [];
    
    // ESC @: Inicializar impresora
    chunks.push(new Uint8Array([0x1B, 0x40]));
    
    for (let cIdx = 0; cIdx < canvases.length; cIdx++) {
      const canvas = canvases[cIdx];
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      
      const width = canvas.width; // 576px
      const height = canvas.height;
      const xBytes = Math.ceil(width / 8); // 72 bytes por línea horizontal
      const yHeight = height;
      
      // Comando ESC/POS Raster Bit Image: GS v 0 0 xL xH yL yH
      const header = [
        0x1D, 0x76, 0x30, 0x00,
        xBytes & 0xFF, (xBytes >> 8) & 0xFF,
        yHeight & 0xFF, (yHeight >> 8) & 0xFF
      ];
      
      const imgBuf = new Uint8Array(header.length + xBytes * yHeight);
      imgBuf.set(header, 0);
      let offset = header.length;
      
      for (let y = 0; y < yHeight; y++) {
        for (let x = 0; x < xBytes; x++) {
          let bVal = 0;
          for (let b = 0; b < 8; b++) {
            const px = x * 8 + b;
            if (px < width) {
              const idx = (y * width + px) * 4;
              // Pixel negro (0) en imagen binarizada
              if (d[idx] < 128) {
                bVal |= (1 << (7 - b));
              }
            }
          }
          imgBuf[offset++] = bVal;
        }
      }
      chunks.push(imgBuf);
      
      // Avance de papel + Corte de papel para cada factura:
      // ESC d 5: Avanzar 5 líneas para que el final de la factura pase la cuchilla
      // GS V 65 0: Cortar papel (Full cut con alimentación de cabezal)
      // GS V 0: Cortar papel estándar
      // ESC @: Reiniciar estado para la siguiente factura
      chunks.push(new Uint8Array([
        0x1B, 0x64, 0x05,
        0x1D, 0x56, 0x41, 0x00,
        0x1D, 0x56, 0x00,
        0x1B, 0x40
      ]));
    }
    
    // Unir todos los buffers en un solo Uint8Array
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const combined = new Uint8Array(totalLen);
    let curOffset = 0;
    for (const c of chunks) {
      combined.set(c, curOffset);
      curOffset += c.length;
    }
    
    // Codificación Base64 segura por bloques
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < totalLen; i += chunkSize) {
      const sub = combined.subarray(i, Math.min(i + chunkSize, totalLen));
      binary += String.fromCharCode.apply(null, sub);
    }
    return btoa(binary);
  };

  // Imprime múltiples notas enviando un único stream ESC/POS completo a RawBT con corte entre facturas
  const printMultiple = async () => {
    const toprint = filteredSalidas.filter(s => selectedIds.has(s.id));
    if (toprint.length === 0) return;
    setIsPrintingMultiple(true);

    try {
      // Cargar html2canvas si no está disponible
      let h2c = window.html2canvas;
      if (!h2c) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = () => { h2c = window.html2canvas; resolve(); };
          script.onerror = () => resolve();
          document.head.appendChild(script);
        });
      }

      if (!h2c) {
        setIsPrintingMultiple(false);
        return;
      }

      const canvases = [];

      // Renderizar cada nota a su propio canvas a 576px
      for (const salida of toprint) {
        const printDiv = document.createElement('div');
        printDiv.style.position = 'fixed';
        printDiv.style.left = '-9999px';
        printDiv.style.top = '0';
        printDiv.style.width = '576px';
        printDiv.style.minWidth = '576px';
        printDiv.style.maxWidth = '576px';
        printDiv.style.background = '#ffffff';
        printDiv.style.color = '#000000';
        printDiv.style.padding = '6px 0px';
        printDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
        printDiv.style.boxSizing = 'border-box';
        printDiv.style.lineHeight = '1.35';
        printDiv.innerHTML = buildAndroidInnerHTML(salida);

        document.body.appendChild(printDiv);
        const canvas = await h2c(printDiv, {
          scale: 1, width: 576, windowWidth: 576,
          backgroundColor: '#ffffff', useCORS: true, logging: false
        });
        document.body.removeChild(printDiv);

        // Binarización de alto contraste
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          const val = lum < 210 ? 0 : 255;
          d[i] = val; d[i + 1] = val; d[i + 2] = val; d[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        canvases.push(canvas);
      }

      // Construir stream ESC/POS completo con cortes individuales entre facturas
      const base64EscPos = buildEscPosStream(canvases);
      
      // Enviar a RawBT en un solo Intent directo (Android lo ejecuta completo sin bloquearse)
      window.location.href = `rawbt:base64,${base64EscPos}`;

    } catch (e) {
      console.error('Error en impresión múltiple:', e);
    } finally {
      setIsPrintingMultiple(false);
    }
  };


  const printTicket = async () => {
    if (!lastSalida) return;
    const items = lastSalida.items || [];
    const totalUnits = items.reduce((s, it) => s + parseInt(it.cantidad || 0), 0);
    const cleanFecha = String(lastSalida.fecha || '').split('T')[0];

    // 1. En teléfonos Android, enviar a RawBT a 576px de ancho exacto (ancho nativo del cabezal térmico de 80mm)
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
    if (isAndroid) {
      try {
        let h2c = window.html2canvas;
        if (!h2c) {
          await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => { h2c = window.html2canvas; resolve(); };
            script.onerror = () => resolve();
            document.head.appendChild(script);
          });
        }

        if (h2c) {
          const printDiv = document.createElement('div');
          printDiv.style.position = 'fixed';
          printDiv.style.left = '-9999px';
          printDiv.style.top = '0';
          printDiv.style.width = '576px';
          printDiv.style.minWidth = '576px';
          printDiv.style.maxWidth = '576px';
          printDiv.style.background = '#ffffff';
          printDiv.style.color = '#000000';
          printDiv.style.padding = '6px 0px';
          printDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
          printDiv.style.boxSizing = 'border-box';
          printDiv.style.lineHeight = '1.35';

          printDiv.innerHTML = `
            <div style="text-align:center; font-weight:800; font-size:32px; margin-bottom:3px; letter-spacing:0.5px;">BESTEDA 2, C.A.</div>
            <div style="text-align:center; font-weight:700; font-size:20px; margin:2px 0;">RIF: J-40529263-6</div>
            <div style="text-align:center; font-size:17.5px; margin:1px 0;">Calle Principal Casa Nº A-13, Urb. Alto de Fenix II</div>
            <div style="text-align:center; font-size:17.5px; margin:1px 0;">San Juan de los Morros - Estado Guárico</div>
            <div style="text-align:center; font-size:17.5px; margin:1px 0;">Tlfs: 0424-313.68.05 / 0424-300.48.02</div>
            
            <hr style="border:none; border-top:3px solid #000; margin:12px 0;" />
            
            <div style="text-align:center; font-weight:800; font-size:27px; letter-spacing:0.8px;">NOTA DE ENTREGA</div>
            <div style="text-align:center; font-weight:800; font-size:27px; margin-top:2px;">Nº ${lastSalida.factura_number}</div>
            
            <hr style="border:none; border-top:2.5px dashed #000; margin:12px 0;" />
            
            <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>FECHA:</b><span>${cleanFecha}</span></div>
            ${(lastSalida.vendedor_name || lastSalida.vendedorName) ? `<div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>VENDEDOR:</b><span style="font-weight:700;">${lastSalida.vendedor_name || lastSalida.vendedorName}</span></div>` : ''}
            <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>CLIENTE:</b><span style="font-weight:700;">${lastSalida.cliente_name || ''}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>C.I./RIF:</b><span>${lastSalida.cedula_rif || '—'}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>TELF:</b><span>${lastSalida.telefono || '—'}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:20.5px; padding:3px 0;"><b>DIR:</b><span>${lastSalida.direccion || '—'}</span></div>
            
            <hr style="border:none; border-top:2.5px dashed #000; margin:12px 0;" />
            
            <table style="width:100%; border-collapse:collapse; font-size:20.5px; margin:12px 0; table-layout:fixed;">
              <thead>
                <tr style="border-bottom:3px solid #000;">
                  <th style="text-align:left; width:12%; padding:6px 0; font-size:19.5px; font-weight:800;">CANT</th>
                  <th style="text-align:left; width:46%; padding:6px 0; font-size:19.5px; font-weight:800;">DESCRIPCIÓN</th>
                  <th style="text-align:right; width:21%; padding:6px 0; font-size:19.5px; font-weight:800;">P/U</th>
                  <th style="text-align:right; width:21%; padding:6px 0; font-size:19.5px; font-weight:800;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(it => {
                  const pu = Number(it.precioUnitario || it.precio_unitario || 0);
                  const cant = Number(it.cantidad || 0);
                  const tot = pu * cant;
                  return `
                    <tr style="border-bottom:1.5px dashed #000;">
                      <td style="padding:8px 0; vertical-align:top; font-size:20.5px; font-weight:700;">${cant}</td>
                      <td style="padding:8px 0; vertical-align:top; font-size:20.5px; font-weight:700; word-break:break-word;">${it.productoNombre || it.producto_nombre}</td>
                      <td style="text-align:right; padding:8px 0; vertical-align:top; font-size:20.5px;">$${pu.toFixed(2)}</td>
                      <td style="text-align:right; padding:8px 0; vertical-align:top; font-size:20.5px; font-weight:800;">$${tot.toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            
            <hr style="border:none; border-top:3px solid #000; margin:12px 0;" />
            
            <div style="display:flex; justify-content:space-between; font-weight:800; font-size:26px; margin:14px 0;">
              <span>UND: ${totalUnits}</span>
              <span>TOTAL: $${Number(lastSalida.total_factura || 0).toFixed(2)}</span>
            </div>
            
            <div style="border:2.5px solid #000; border-radius:8px; padding:12px 10px; margin:14px 0 8px 0; background:#fff; font-size:17.5px; line-height:1.45; color:#000;">
              <div style="font-weight:800; font-size:19px; text-align:center; margin-bottom:8px;">— PAGO MÓVIL BDV —</div>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3136805</strong> &nbsp;|&nbsp; C.I. 10.668.263</div>
                <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3004802</strong> &nbsp;|&nbsp; C.I. 28.012.615</div>
              </div>
              <div style="border-top:2px dashed #000; margin:10px 0;"></div>
              <div style="font-weight:800; font-size:19px; text-align:center; margin-bottom:8px;">— DEPÓSITO BANCARIO BDV —</div>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <div>• <strong>0102 0467 4501 0162 8166</strong> <span style="font-size:15px;">(JUAN MORA)</span></div>
                <div>• <strong>0102 0467 4500 0096 7787</strong> <span style="font-size:15px;">(JORGE FLORES)</span></div>
              </div>
              <div style="border-top:2px dashed #000; margin:10px 0;"></div>
              <div style="font-size:18px; font-weight:400; text-align:center; color:#000; line-height:1.35; padding-top:2px;">
                NOTA: Los pagos en Bs. emitidos en fines de semana o feriados se calculan a la tasa oficial BCV fijada para el siguiente d\u00eda h\u00e1bil (Art. 25 Ley del IVA).
              </div>
            </div>
          `;

          document.body.appendChild(printDiv);

          const canvas = await h2c(printDiv, {
            scale: 1,
            width: 576,
            windowWidth: 576,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
          });

          document.body.removeChild(printDiv);

          // Binarización de contraste puro (1-bit): texto negro sólido y nítido
          const ctx = canvas.getContext('2d');
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            const val = lum < 210 ? 0 : 255;
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
            d[i + 3] = 255;
          }
          ctx.putImageData(imgData, 0, 0);

          const base64Png = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
          window.location.href = `rawbt:data:image/png;base64,${base64Png}`;
          return;
        }
      } catch (e) {
        console.error('Error enviando a RawBT:', e);
      }
    }

    // 2. En PC / Escritorio, abrir diálogo normal
    const desktopStyles = `
    * { box-sizing: border-box; }
    @page { size: 76mm auto; margin: 0; }
    @media print { body { width: 72mm; margin: 0 auto; padding: 2mm 1mm; -webkit-print-color-adjust: exact; } }
    body { width: 72mm; margin: 0 auto; padding: 2mm 1mm; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; line-height: 1.35; }
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
    .payment-box { border: 1.5px solid #000; border-radius: 8px; padding: 8px 10px; margin: 10px 0 4px 0; background: #fff; font-size: 9.5px; line-height: 1.45; color: #000; }
    .payment-title { font-weight: 800; font-size: 10.5px; text-align: center; margin-bottom: 4px; color: #000; }
    .payment-data { text-align: left; padding-left: 2px; display: flex; flex-direction: column; gap: 2px; color: #000; }
    `;

    const desktopBody = `
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
    ${(lastSalida.vendedor_name || lastSalida.vendedorName) ? `<tr><td class="info-label">VENDEDOR:</td><td class="info-val">${lastSalida.vendedor_name || lastSalida.vendedorName}</td></tr>` : ''}
    <tr><td class="info-label">CLIENTE:</td><td class="info-val">${lastSalida.cliente_name || ''}</td></tr>
    <tr><td class="info-label">C.I./RIF:</td><td class="info-val">${lastSalida.cedula_rif || '—'}</td></tr>
    <tr><td class="info-label">TELF:</td><td class="info-val">${lastSalida.telefono || '—'}</td></tr>
    <tr><td class="info-label">DIR:</td><td class="info-val">${lastSalida.direccion || '—'}</td></tr>
  </table>
  <hr class="divider-dashed" />
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 12%;">CANT</th>
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
    <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
    <div class="payment-title">— DEPÓSITO BANCARIO BDV —</div>
    <div class="payment-data">
      <div>• <strong>0102 0467 4501 0162 8166</strong> <span style="font-size: 8.5px; color: #000;">(JUAN MORA)</span></div>
      <div>• <strong>0102 0467 4500 0096 7787</strong> <span style="font-size: 8.5px; color: #000;">(JORGE FLORES)</span></div>
    </div>
    <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
    <div style="font-size: 11.5px; font-weight: 400; text-align: center; color: #000; line-height: 1.35; padding-top: 2px;">
      NOTA: Los pagos en Bs. emitidos en fines de semana o feriados se calculan a la tasa oficial BCV fijada para el siguiente día hábil (Art. 25 Ley del IVA).
    </div>
  </div>`;

    const desktopHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nota de Entrega Nº ${lastSalida.factura_number}</title><style>${desktopStyles}</style></head><body>${desktopBody}
    <script>
      window.onload = function() { setTimeout(function() { try { window.print(); } catch(e){} }, 200); };
      window.onafterprint = function() { try { window.close(); } catch(e){} };
    </script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(desktopHtml);
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
            {selectedIds.size > 0 && (
              <button
                className="btn btn-primary btn-sm"
                style={{background:'#0284c7', color:'#fff', fontWeight:700, display:'flex', alignItems:'center', gap:'0.4rem'}}
                onClick={printMultiple}
                disabled={isPrintingMultiple}
                title={`Imprimir ${selectedIds.size} nota(s) seleccionada(s)`}
              >
                {isPrintingMultiple ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Preparando ({selectedIds.size})...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-print"></i> Imprimir seleccionadas ({selectedIds.size})
                  </>
                )}
              </button>
            )}
            <select
              className="form-control"
              style={{maxWidth: 180, minHeight: 36, fontSize: '0.85rem', fontWeight: 600, borderColor: selectedVendedorFilter ? '#0284c7' : undefined}}
              value={selectedVendedorFilter}
              onChange={e => setSelectedVendedorFilter(e.target.value)}
              title="Filtrar por Vendedor"
            >
              <option value="">Todos los vendedores</option>
              {Array.from(new Set([...vendedores.map(v => v.nombre), ...salidas.map(s => s.vendedor_name).filter(Boolean)])).sort().map((vend, idx) => (
                <option key={idx} value={vend}>{vend}</option>
              ))}
            </select>
            <input type="date" className="form-control" style={{minHeight:36, width:'auto', fontSize:'0.85rem'}} value={filterFecha} onChange={e=>setFilterFecha(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={()=>{ setFilterFecha(''); setSelectedVendedorFilter(''); }} title="Limpiar filtros"><i className="fa-solid fa-xmark"></i></button>
            <input type="text" className="form-control" placeholder="🔍 Buscar cliente, Nº factura, vendedor..." style={{maxWidth:220, minHeight:36, fontSize:'0.85rem'}} value={searchText} onChange={e=>setSearchText(e.target.value)} />
          </div>
        </div>

        {selectedVendedorFilter && (
          <div style={{background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem', color: '#166534'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <i className="fa-solid fa-user-check" style={{color: '#16a34a', fontSize: '1rem'}}></i>
              <span>Vendedor: <strong>{selectedVendedorFilter}</strong></span>
              <span style={{background: '#dcfce7', padding: '2px 8px', borderRadius: 6, fontWeight: 700}}>
                {filteredSalidas.length} venta(s)
              </span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: 700}}>
              <span>Total Ventas: <strong style={{color: '#15803d'}}>${filteredSalidas.reduce((s, r) => s + parseFloat(r.total_factura || 0), 0).toFixed(2)}</strong></span>
              <span style={{color: '#64748b', fontWeight: 600}}>(Bs. {(filteredSalidas.reduce((s, r) => s + parseFloat(r.total_factura || 0), 0) * bcvTasa).toLocaleString('es-VE', {minimumFractionDigits: 2})})</span>
            </div>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th style={{width:36, textAlign:'center'}}>
                <input
                  type="checkbox"
                  title="Seleccionar todas"
                  checked={filteredSalidas.length > 0 && filteredSalidas.every(s => selectedIds.has(s.id))}
                  onChange={e => {
                    if (e.target.checked) setSelectedIds(new Set(filteredSalidas.map(s => s.id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </th>
              <th>Tipo</th><th>Nº Documento</th><th>Fecha</th><th>Vendedor</th><th>Cliente</th>
              <th>Total ($)</th><th>Total (Bs.)</th><th>Saldo Pendiente</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSalidas.length === 0 ? (
              <tr><td colSpan={10} style={{textAlign:'center', padding:'2.5rem', color:'var(--text-muted)'}}>
                {searchText || filterFecha || selectedVendedorFilter ? 'Sin resultados para los filtros' : 'Sin ventas registradas'}
              </td></tr>
            ) : filteredSalidas.map(s => (
              <tr key={s.id} style={selectedIds.has(s.id) ? {background:'#f0f9ff'} : {}}>
                <td style={{textAlign:'center', verticalAlign:'middle'}}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={e => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      });
                    }}
                  />
                </td>
                <td><span className="badge badge-primary" style={{fontSize:'0.7rem'}}>NOTA DE ENTREGA</span></td>
                <td style={{fontWeight:600}}>Nº {s.factura_number}</td>
                <td>{s.fecha ? String(s.fecha).split('T')[0] : '—'}</td>
                <td>
                  <div style={{fontWeight:600, fontSize:'0.85rem', color:'#334155'}}>{s.vendedor_name || '—'}</div>
                </td>
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
                      <>
                        <button className="btn btn-sm" style={{background:'#ecfdf5', color:'#059669', borderColor:'#a7f3d0'}} title="Saldar Factura Completa (1 Clic)"
                          onClick={()=>handleQuickPagarTodo(s)}>
                          <i className="fa-solid fa-circle-check"></i>
                        </button>
                        <button className="btn btn-secondary btn-sm" title="Registrar abono parcial / personalizado"
                          onClick={()=>{
                            const saldo = parseFloat(s.saldo_adeudado || 0);
                            setAbonoForm({
                              salidaId: s.id,
                              clienteName: s.cliente_name,
                              facturaNumber: s.factura_number,
                              totalFactura: parseFloat(s.total_factura || 0),
                              saldoAdeudado: saldo,
                              montoUSD: '',
                              montoVES: '',
                              referencia: '',
                              fecha: today()
                            });
                            setShowAbonoModal(true);
                          }}>
                          <i className="fa-solid fa-dollar-sign"></i>
                        </button>
                      </>
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
            {/* Selector de Cliente Frecuente / Existente */}
            <div style={{marginBottom:'0.85rem', background:'#f0f9ff', padding:'0.75rem 0.9rem', borderRadius:10, border:'1.5px solid #bae6fd'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.4rem'}}>
                <label style={{fontSize:'0.82rem', fontWeight:800, color:'#0369a1', margin:0, display:'flex', alignItems:'center', gap:'0.4rem'}}>
                  <i className="fa-solid fa-users"></i> Cliente Frecuente Guardado:
                </label>
                {(form.clienteName || form.cedulaRif) && (
                  <button type="button" style={{background:'#e0f2fe', border:'1px solid #7dd3fc', color:'#0284c7', fontSize:'0.75rem', cursor:'pointer', fontWeight:700, padding:'2px 8px', borderRadius:6}} onClick={() => { setSelectedClienteKey(''); setForm(f => ({ ...f, clienteName:'', cedulaRif:'', telefono:'', direccion:'' })); }}>
                    + Nuevo / Limpiar
                  </button>
                )}
              </div>
              <select 
                className="form-control" 
                style={{fontSize:'0.85rem', minHeight:38, background:'#fff', borderColor:'#93c5fd', color:'#0f172a', fontWeight:600}}
                value={selectedClienteKey}
                onChange={e => handleSelectClienteFrecuente(e.target.value)}
              >
                <option value="">-- Seleccionar cliente frecuente ({clientes.length}) o escribir datos abajo --</option>
                {clientes.map((c, idx) => {
                  const key = c.cedula_rif ? `CI:${c.cedula_rif}` : `NAME:${c.cliente_name}`;
                  return (
                    <option key={idx} value={key}>
                      {c.cliente_name} {c.cedula_rif ? `— CI/RIF: ${c.cedula_rif}` : ''} {c.telefono ? `(${c.telefono})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selector de Vendedor Guardado / Nuevo */}
            <div style={{marginBottom:'0.85rem', background:'#f8fafc', padding:'0.75rem 0.9rem', borderRadius:10, border:'1.5px solid #cbd5e1'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.4rem'}}>
                <label style={{fontSize:'0.82rem', fontWeight:800, color:'#334155', margin:0, display:'flex', alignItems:'center', gap:'0.4rem'}}>
                  <i className="fa-solid fa-user-tie" style={{color:'#0284c7'}}></i> Vendedor Asignado:
                </label>
                {form.vendedorName && (
                  <button type="button" style={{background:'#f1f5f9', border:'1px solid #cbd5e1', color:'#475569', fontSize:'0.75rem', cursor:'pointer', fontWeight:700, padding:'2px 8px', borderRadius:6}} onClick={() => setForm(f => ({ ...f, vendedorName:'' }))}>
                    + Limpiar / Escribir Nuevo
                  </button>
                )}
              </div>
              <div style={{display:'grid', gridTemplateColumns: vendedores.length > 0 ? '1fr 1fr' : '1fr', gap:'0.5rem'}}>
                {vendedores.length > 0 && (
                  <select 
                    className="form-control" 
                    style={{fontSize:'0.85rem', minHeight:38, background:'#fff', borderColor:'#94a3b8', color:'#0f172a', fontWeight:600}}
                    value={form.vendedorName}
                    onChange={e => setForm(f => ({ ...f, vendedorName: e.target.value }))}
                  >
                    <option value="">-- Seleccionar vendedor ({vendedores.length}) --</option>
                    {vendedores.map((v, idx) => (
                      <option key={v.id || idx} value={v.nombre}>
                        {v.nombre}
                      </option>
                    ))}
                  </select>
                )}
                <input 
                  type="text" 
                  className="form-control" 
                  style={{fontSize:'0.85rem', minHeight:38, fontWeight:600}} 
                  placeholder={vendedores.length > 0 ? "O escribe nombre de vendedor..." : "Nombre del vendedor (se guardará)"} 
                  value={form.vendedorName} 
                  onChange={e=>setForm(f=>({...f, vendedorName:e.target.value}))} 
                />
              </div>
            </div>

            {/* Formulario Cliente y Factura Adaptado a Móvil */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'0.75rem', marginBottom:'0.75rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Nombre del Cliente *</label>
                <input type="text" className="form-control" required style={{fontSize:'0.85rem'}} placeholder="Nombre del cliente" value={form.clienteName} onChange={e=>setForm(f=>({...f,clienteName:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700, color:'#0284c7'}}>C.I. / RIF (Identificador Único) *</label>
                <input type="text" className="form-control" style={{fontSize:'0.85rem', fontWeight:600, borderColor:'#93c5fd'}} placeholder="C.I. / RIF" value={form.cedulaRif} onChange={e=>handleCedulaChange(e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Teléfono</label>
                <input type="text" className="form-control" style={{fontSize:'0.85rem'}} placeholder="Teléfono" value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} />
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'0.75rem', marginBottom:'1rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Dirección del Cliente</label>
                <input type="text" className="form-control" style={{fontSize:'0.85rem'}} placeholder="Dirección del cliente" value={form.direccion} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Nº Nota de Entrega</label>
                <input type="text" className="form-control" style={{fontSize:'0.85rem'}} placeholder="Nº Nota" value={form.facturaNumber} onChange={e=>setForm(f=>({...f,facturaNumber:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Fecha</label>
                <input type="date" className="form-control" style={{fontSize:'0.85rem'}} value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} />
              </div>
            </div>

            {/* Productos a Despachar — layout adaptado a móvil */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem'}}>
              <h3 style={{fontSize:'0.9rem', fontWeight:700}}><i className="fa-solid fa-box-open"></i> Productos a Despachar</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setForm(f=>({...f, items:[...f.items, emptyItem()]}))}>+ Agregar Producto</button>
            </div>

            <div style={{border:'1px solid #cbd5e1', borderRadius:10, background:'#f8fafc', padding:'0.5rem', marginBottom:'1rem', maxHeight:360, overflowY:'auto'}}>
              {form.items.length === 0 ? (
                <div style={{padding:'1rem', textAlign:'center', color:'#64748b', fontSize:'0.85rem'}}>No hay productos agregados. Haz clic en <strong>+ Agregar Producto</strong>.</div>
              ) : form.items.map((item, i) => (
                <div key={i} style={{background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:10, padding:'0.65rem 0.75rem', marginBottom:'0.6rem', boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                  {/* Fila 1: selector de producto (ancho completo) + botón eliminar */}
                  <div style={{display:'flex', gap:'0.4rem', alignItems:'center', marginBottom:'0.5rem'}}>
                    <select className="form-control" style={{fontSize:'0.82rem', padding:'0.35rem 0.5rem', minHeight:38, flex:1}} value={item.productoId} onChange={e=>selectProduct(i, e.target.value)}>
                      <option value="">-- Seleccionar producto --</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} (Stock: {p.cantidad} | P1: ${Number(p.precio_venta1||0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-danger btn-sm" style={{width:38, height:38, minHeight:38, minWidth:38, padding:0, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}} title="Eliminar renglón" onClick={()=>setForm(f=>({...f, items:f.items.filter((_,j)=>j!==i)}))}>
                      <i className="fa-solid fa-trash" style={{fontSize:'0.85rem'}}></i>
                    </button>
                  </div>
                  {/* Fila 2: Tipo Precio | Cantidad | P. Unitario | Subtotal */}
                  <div style={{display:'grid', gridTemplateColumns:'85px 60px 80px 1fr', gap:'0.4rem', alignItems:'center', background:'#f8fafc', padding:'0.4rem 0.6rem', borderRadius:8, border:'1px solid #f1f5f9'}}>
                    <div>
                      <span style={{fontSize:'0.7rem', fontWeight:600, color:'#64748b', display:'block', marginBottom:2}}>Precio:</span>
                      <select className="form-control" style={{fontSize:'0.78rem', padding:'0.25rem 0.3rem', minHeight:34}} value={item.precioOpcion || '1'} onChange={e=>selectPrecio(i, e.target.value)}>
                        <option value="1">P1</option>
                        <option value="2">P2</option>
                        <option value="3">P3</option>
                        <option value="custom">Manual</option>
                      </select>
                    </div>
                    <div>
                      <span style={{fontSize:'0.7rem', fontWeight:600, color:'#64748b', display:'block', marginBottom:2}}>Cant:</span>
                      <input type="number" className="form-control" style={{fontSize:'0.85rem', padding:'0.25rem 0.3rem', minHeight:34, textAlign:'center', fontWeight:600}} min="1" value={item.cantidad} onChange={e=>updateItem(i, {cantidad:e.target.value})} placeholder="1" />
                    </div>
                    <div>
                      <span style={{fontSize:'0.7rem', fontWeight:600, color:'#64748b', display:'block', marginBottom:2}}>P. Unit $:</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="0.00"
                        readOnly={item.precioOpcion !== 'custom'}
                        style={{
                          fontSize:'0.85rem',
                          padding:'0.25rem 0.4rem',
                          minHeight:34,
                          fontWeight:600,
                          backgroundColor: item.precioOpcion === 'custom' ? '#fff' : '#f1f5f9',
                          color: item.precioOpcion === 'custom' ? '#0284c7' : '#334155',
                          borderColor: item.precioOpcion === 'custom' ? '#0284c7' : '#cbd5e1',
                          cursor: item.precioOpcion === 'custom' ? 'text' : 'not-allowed'
                        }}
                        value={item.precioUnitario}
                        onChange={e => { if (item.precioOpcion === 'custom') updateItem(i, { precioUnitario: e.target.value }); }}
                        title={item.precioOpcion !== 'custom' ? 'Precio de catálogo (selecciona "Manual" para modificar)' : 'Precio libre'}
                      />
                    </div>
                    <div style={{textAlign:'right'}}>
                      <span style={{fontSize:'0.7rem', fontWeight:700, color:'#0284c7', display:'block', marginBottom:2}}>Subtotal:</span>
                      <div style={{fontWeight:800, color:'var(--primary)', fontSize:'0.95rem', whiteSpace:'nowrap'}}>
                        ${Number(item.subtotal||0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                  {(lastSalida.vendedor_name || lastSalida.vendedorName) && (
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>VENDEDOR:</b><span>{lastSalida.vendedor_name || lastSalida.vendedorName}</span></div>
                  )}
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>CLIENTE:</b><span>{lastSalida.cliente_name || ''}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>C.I./RIF:</b><span>{lastSalida.cedula_rif || '—'}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>TELF:</b><span>{lastSalida.telefono || '—'}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', padding:'1.5px 0'}}><b>DIR:</b><span>{lastSalida.direccion || '—'}</span></div>
                  
                  <hr style={{border:'none', borderTop:'1px dashed #444', margin:'8px 0'}} />
                  
                  <table style={{width:'100%', minWidth:0, borderCollapse:'collapse', fontSize:'11px', margin:'6px 0', tableLayout:'fixed'}}>
                    <thead>
                      <tr style={{borderBottom:'1.5px solid #000'}}>
                        <th style={{textAlign:'left', width:'12%', padding:'3px 0', background:'transparent', color:'#000', fontSize:'10.5px', fontWeight:800}}>CANT</th>
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
                  
                  <div style={{border:'1.5px solid #000', borderRadius:'8px', padding:'8px 10px', margin:'10px 0 4px 0', background:'#fff', fontSize:'9.5px', lineHeight:1.45, color:'#000'}}>
                    <div style={{fontWeight:800, fontSize:'10.5px', textAlign:'center', color:'#000', marginBottom:'4px'}}>— PAGO MÓVIL BDV —</div>
                    <div style={{textAlign:'left', paddingLeft:'2px', display:'flex', flexDirection:'column', gap:'2px', color:'#000'}}>
                      <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3136805</strong> &nbsp;|&nbsp; C.I. 10.668.263</div>
                      <div>• <strong>0102</strong> &nbsp;|&nbsp; <strong>0424-3004802</strong> &nbsp;|&nbsp; C.I. 28.012.615</div>
                    </div>
                    <div style={{borderTop:'1px dashed #000', margin:'6px 0'}}></div>
                    <div style={{fontWeight:800, fontSize:'10.5px', textAlign:'center', color:'#000', marginBottom:'4px'}}>— DEPÓSITO BANCARIO BDV —</div>
                    <div style={{textAlign:'left', paddingLeft:'2px', display:'flex', flexDirection:'column', gap:'2px', color:'#000'}}>
                      <div>• <strong>0102 0467 4501 0162 8166</strong> <span style={{fontSize:'8.5px', color:'#000'}}>(JUAN MORA)</span></div>
                      <div>• <strong>0102 0467 4500 0096 7787</strong> <span style={{fontSize:'8.5px', color:'#000'}}>(JORGE FLORES)</span></div>
                    </div>
                    <div style={{borderTop:'1px dashed #000', margin:'6px 0'}}></div>
                    <div style={{fontSize:'11.5px', fontWeight:400, textAlign:'center', color:'#000', lineHeight:1.35, paddingTop:'2px'}}>
                      NOTA: Los pagos en Bs. emitidos en fines de semana o feriados se calculan a la tasa oficial BCV fijada para el siguiente día hábil (Art. 25 Ley del IVA).
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
          <div className="modal-content" style={{maxWidth:520}}>
            <div className="modal-header">
              <div>
                <h2><i className="fa-solid fa-hand-holding-dollar" style={{color:'#0284c7'}}></i> Registrar Abono de Cliente</h2>
                <p style={{fontSize:'0.82rem', color:'var(--text-secondary)', fontWeight:600, margin:0}}>{abonoForm.clienteName}</p>
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowAbonoModal(false)}>&times;</button>
            </div>

            {/* Tarjeta Informativa de Deuda y Botón de Pago Total */}
            <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'0.85rem 1rem', marginBottom:'1.1rem'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #e2e8f0', paddingBottom:'0.5rem', marginBottom:'0.65rem'}}>
                <div>
                  <span style={{fontSize:'0.72rem', color:'#64748b', fontWeight:700, textTransform:'uppercase'}}>Documento</span>
                  <div style={{fontWeight:800, fontSize:'0.95rem', color:'#0f172a'}}>Nota de Entrega Nº {abonoForm.facturaNumber || '—'}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <span style={{fontSize:'0.72rem', color:'#64748b', fontWeight:700, textTransform:'uppercase'}}>Total Factura</span>
                  <div style={{fontWeight:700, fontSize:'0.95rem', color:'#334155'}}>${Number(abonoForm.totalFactura || 0).toFixed(2)} USD</div>
                </div>
              </div>

              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'0.7rem 0.9rem', gap:'0.75rem', flexWrap:'wrap'}}>
                <div>
                  <span style={{fontSize:'0.7rem', color:'#dc2626', fontWeight:800, textTransform:'uppercase', display:'block'}}>Saldo Pendiente por Cobrar</span>
                  <div style={{fontSize:'1.25rem', fontWeight:800, color:'#b91c1c', lineHeight:1.1}}>
                    ${Number(abonoForm.saldoAdeudado || 0).toFixed(2)} <span style={{fontSize:'0.85rem'}}>USD</span>
                  </div>
                  <div style={{fontSize:'0.75rem', fontWeight:600, color:'#dc2626', marginTop:'2px'}}>
                    ≈ Bs. {(Number(abonoForm.saldoAdeudado || 0) * bcvTasa).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{background:'#16a34a', color:'#fff', border:'none', fontWeight:700, padding:'0.55rem 0.85rem', borderRadius:6, fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem', boxShadow:'0 2px 5px rgba(22,163,74,0.25)', cursor:'pointer'}}
                  title="Autocompletar el monto total adeudado"
                  onClick={() => {
                    const saldo = parseFloat(abonoForm.saldoAdeudado || 0);
                    const ves = (saldo * bcvTasa).toFixed(2);
                    setAbonoForm(f => ({ ...f, montoUSD: saldo.toFixed(2), montoVES: ves, referencia: f.referencia || 'Pago Total Factura' }));
                  }}
                >
                  <i className="fa-solid fa-bolt"></i> Pagar Saldo Total
                </button>
              </div>
            </div>

            <form onSubmit={handleAbonoSave}>
              <div style={{background:'#f0f9ff', border:'1px solid #bae6fd', padding:'0.5rem 0.75rem', borderRadius:6, marginBottom:'1rem', fontSize:'0.8rem', color:'#0369a1', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span><i className="fa-solid fa-coins"></i> Tasa BCV de Conversión:</span>
                <strong style={{color:'#0284c7', fontSize:'0.9rem'}}>Bs. {bcvTasa.toFixed(2)} / $</strong>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'0.5rem'}}>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700}}>Monto a Abonar en USD ($)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="0.00" required style={{fontSize:'1rem', fontWeight:700, color:'#166534'}}
                    value={abonoForm.montoUSD} onChange={e=>setAbonoForm(f=>({...f,montoUSD:e.target.value,montoVES:(parseFloat(e.target.value||0)*bcvTasa).toFixed(2)}))} />
                  <small style={{fontSize:'0.72rem', color:'#0284c7', fontWeight:600, display:'block', marginTop:3}}>= Bs. {(parseFloat(abonoForm.montoUSD||0)*bcvTasa).toLocaleString('es-VE',{minimumFractionDigits:2})}</small>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700}}>Monto a Abonar en BS (VES)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="0.00" style={{fontSize:'1rem', fontWeight:700, color:'#0284c7'}}
                    value={abonoForm.montoVES} onChange={e=>setAbonoForm(f=>({...f,montoVES:e.target.value, montoUSD: (parseFloat(e.target.value||0)/bcvTasa).toFixed(2)}))} />
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
                  <input type="text" className="form-control" placeholder="Ej: Pago Móvil / Efectivo" style={{fontSize:'0.85rem'}} value={abonoForm.referencia} onChange={e=>setAbonoForm(f=>({...f,referencia:e.target.value}))} />
                </div>
              </div>
              <div style={{marginTop:'1.25rem'}}>
                <button type="submit" className="btn btn-primary" style={{width:'100%', padding:'0.7rem', fontSize:'0.95rem', fontWeight:700}}>
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
                  <option value="">-- Cargar Lista de Clientes ({clientes.length}) --</option>
                  {clientes.map((c,i) => {
                    const key = c.cedula_rif ? `CI:${c.cedula_rif}` : `NAME:${c.cliente_name}`;
                    return (
                      <option key={i} value={key}>
                        {c.cliente_name} {c.cedula_rif ? `(C.I: ${c.cedula_rif})` : '(Sin Cédula)'} — Saldo: ${Number(c.saldo_pendiente_usd||0).toFixed(2)}
                      </option>
                    );
                  })}
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

        {/* Modal Elegante de Confirmación y Alertas */}
        <ConfirmModal
          {...confirmDialog}
          onCancel={() => setConfirmDialog(cd => ({ ...cd, isOpen: false }))}
        />
      </>
    );
}
