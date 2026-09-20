'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import ConfirmModal from '@/components/ConfirmModal';

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
  const [imgRotation, setImgRotation] = useState(0);

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
    proveedorName:'', proveedorRif:'', proveedorTelf:'', proveedorDir:'',
    tipoDoc:'NOTA DE ENTREGA', facturaNum:'', fecha:today(), fechaVenc:todayPlus7(),
    tasaBCV:798.33, totalUSD:0, totalVES:0, observaciones:'',
    items:[emptyItem()]
  });
  const [abonoForm, setAbonoForm] = useState({ entradaId:'', montoUSD:0, montoVES:0, referencia:'', fecha:today() });

  const [inventarioList, setInventarioList] = useState([]);
  const load = () => {
    setLoading(true);
    fetch('/api/entradas')
      .then(r => r.json())
      .then(d => { if (d.success) setEntradas(d.data); })
      .finally(() => setLoading(false));
    fetch('/api/inventario')
      .then(r => r.json())
      .then(d => { if (d.success && Array.isArray(d.data)) setInventarioList(d.data); })
      .catch(e => console.error(e));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    fetch('/api/bcv').then(r=>r.json()).then(d => {
      if(d.success && d.data?.tasaHoy) {
        setBcvTasa(d.data.tasaHoy);
        setForm(f => ({ ...f, tasaBCV: d.data.tasaHoy }));
      }
    });
  }, []);

  // Bloquear scroll de fondo cuando cualquier modal esté abierto
  useEffect(() => {
    const isModalOpen = showModal || showAbonoModal || showPreviewModal;
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
  }, [showModal, showAbonoModal, showPreviewModal]);

  const filteredEntradas = entradas.filter(e => {
    const q = searchText.toLowerCase();
    const matchText = !q || e.proveedor_name.toLowerCase().includes(q) || (e.factura_number||'').toLowerCase().includes(q);
    const matchFecha = !filterFecha || e.fecha === filterFecha;
    return matchText && matchFecha;
  });

  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    const c = parseFloat(items[i].cantidad || 0);
    const tasa = parseFloat(form.tasaBCV || 798.33);

    if (field === 'cantidad' || field === 'costoUSD') {
      const u = parseFloat(items[i].costoUSD || 0);
      const totUSD = c * u;
      items[i].totalUSD = totUSD > 0 ? totUSD.toFixed(2) : items[i].totalUSD;
      items[i].totalVES = ((parseFloat(items[i].totalUSD) || totUSD) * tasa).toFixed(2);
    } else if (field === 'totalUSD') {
      const tot = parseFloat(val || 0);
      items[i].totalUSD = val;
      if (c > 0 && tot >= 0) {
        items[i].costoUSD = (tot / c).toFixed(2);
      }
      items[i].totalVES = (tot * tasa).toFixed(2);
    }

    const totalUSD = items.reduce((s, it) => s + parseFloat(it.totalUSD || 0), 0);
    setForm(f => ({
      ...f,
      items,
      totalUSD: totalUSD.toFixed(2),
      totalVES: (totalUSD * parseFloat(f.tasaBCV || 798.33)).toFixed(2)
    }));
  };

  const resetModalForm = () => {
    setForm({
      proveedorName: '',
      proveedorRif: '',
      proveedorTelf: '',
      proveedorDir: '',
      tipoDoc: 'NOTA DE ENTREGA',
      facturaNum: '',
      fecha: today(),
      fechaVenc: todayPlus7(),
      tasaBCV: bcvTasa || 798.33,
      totalUSD: 0,
      totalVES: 0,
      observaciones: '',
      items: [emptyItem()]
    });
    setFacturaImg(null);
    setOcrText('');
    setShowModal(false);
    setShowPreviewModal(false);
  };

  const openNewModal = () => {
    resetModalForm();
    setShowModal(true);
  };

  const handleSave = async (confirmed, skipDuplicateCheck = false) => {
    if (!skipDuplicateCheck && form.facturaNum) {
      const docTrim = form.facturaNum.toString().trim().toLowerCase();
      const docExiste = entradas.find(e => (e.factura_number || '').toString().trim().toLowerCase() === docTrim);
      if (docExiste) {
        setConfirmDialog({
          isOpen: true,
          title: '⚠️ Documento Ya Registrado',
          message: (
            <div>
              <p style={{marginBottom:'0.5rem', color:'#334155'}}>
                Ya existe un documento registrado con el Nº <strong>"{form.facturaNum}"</strong>:
              </p>
              <div style={{background:'#f8fafc', padding:'0.65rem 0.85rem', borderRadius:10, border:'1.5px solid #fed7aa', fontSize:'0.84rem', textAlign:'left', marginBottom:'0.75rem', color:'#1e293b'}}>
                <div><strong>🏢 Proveedor:</strong> {docExiste.proveedor_name}</div>
                <div><strong>📅 Fecha:</strong> {docExiste.fecha ? String(docExiste.fecha).split('T')[0] : '—'}</div>
                <div><strong>💵 Total:</strong> ${Number(docExiste.total_factura||0).toFixed(2)}</div>
              </div>
              <p style={{margin:0, color:'#b45309', fontWeight:700, fontSize:'0.9rem'}}>
                ¿Deseas registrar esta compra de todos modos?
              </p>
            </div>
          ),
          confirmText: 'Sí, Registrar de Todos Modos',
          cancelText: 'Corregir Número',
          variant: 'warning',
          icon: 'fa-triangle-exclamation',
          onConfirm: () => {
            setConfirmDialog(d => ({ ...d, isOpen: false }));
            handleSave(confirmed, true);
          },
          onCancel: () => setConfirmDialog(d => ({ ...d, isOpen: false }))
        });
        return;
      }
    }

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
          codigoProducto: it.codigo,
          productoNombre: it.nombre,
          cantidad: parseInt(it.cantidad||0),
          costoUnitarioUSD: parseFloat(it.costoUSD||0),
          costoUnitarioVES: parseFloat(it.costoUSD||0) * parseFloat(form.tasaBCV||798.33)
        })).filter(it => it.productoNombre && it.cantidad > 0)
      };
      const res = await fetch('/api/entradas', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const d = await res.json();
      if (d.success) {
        resetModalForm();
        load();
      } else {
        setConfirmDialog({
          isOpen: true,
          title: 'Error al Guardar',
          message: d.error || 'No se pudo registrar la compra.',
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
    const ent = entradas.find(e => e.id === id);
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar esta Compra?',
      message: (
        <div>
          <p style={{marginBottom:'0.5rem', color:'#334155'}}>
            ¿Deseas eliminar la compra <strong>{ent ? `Nº ${ent.factura_number} (${ent.proveedor_name})` : ''}</strong>?
          </p>
          <p style={{margin:0, color:'#dc2626', fontSize:'0.82rem', fontWeight:600}}>
            ⚠️ El stock ingresado con esta compra será revertido del inventario.
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
          const res = await fetch(`/api/entradas?id=${id}`, { method:'DELETE' });
          const d = await res.json();
          if (d.success) {
            setConfirmDialog(cd => ({ ...cd, isOpen: false }));
            load();
          } else {
            setConfirmDialog({
              isOpen: true,
              title: 'Error al Eliminar',
              message: d.error || 'No se pudo eliminar la compra.',
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
    const res = await fetch('/api/abonos-entradas', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ entradaId:abonoForm.entradaId, montoUSD:parseFloat(abonoForm.montoUSD||0),
        montoVES:parseFloat(abonoForm.montoVES||0), referencia:abonoForm.referencia, fecha:abonoForm.fecha })
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

  // Preprocesar imagen en canvas para OCR nítido con escala óptima
  const preprocessImage = (imageElement, angle) => {
    return new Promise((resolve) => {
      try {
        if (!imageElement || !imageElement.naturalWidth) {
          resolve(null);
          return;
        }
        let w = imageElement.naturalWidth;
        let h = imageElement.naturalHeight;

        // Limitar resolución para que Tesseract procese con máxima precisión y rapidez (max 2200px)
        const maxDim = 2200;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (angle === 90 || angle === 270) {
          canvas.width = h;
          canvas.height = w;
        } else {
          canvas.width = w;
          canvas.height = h;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(imageElement, -w / 2, -h / 2, w, h);

        resolve(canvas);
      } catch (err) {
        resolve(null);
      }
    });
  };

  const calculateOCRScore = (text) => {
    if (!text) return 0;
    const t = text.toLowerCase();
    let score = 0;
    const keywords = [
      'distribuidora', 'transporte', 'entrega', 'factura', 'rif', 'nota',
      'sub-total', 'total', 'cantidad', 'precio', 'descripcion', 'cajetillas',
      'cig', 'bcv', 'cambio', 'tasa', 'bolivares', 'dolar', 'cliente', 'belmont', 'consul', 'viceroy', 'pall mall'
    ];
    keywords.forEach(kw => { if (t.includes(kw)) score += 5; });
    const numMatches = t.match(/\d+[.,]\d{2}/g);
    if (numMatches) score += numMatches.length * 2;
    return score;
  };

  const extractInvoiceLineNumbers = (line) => {
    // Limpiar menciones de empaques o presentaciones que no sean cantidades ni precios
    const cleanLine = line
      .replace(/\b\d+\s*cig(?:arrillos)?\b/gi, '')
      .replace(/\b\d+\s*caj(?:etillas?)?\b/gi, '')
      .replace(/\b\d+\s*und(?:ades)?\b/gi, '')
      .replace(/\b\d+\s*pk\b/gi, '')
      .replace(/[%$]/g, '');

    const rawMatches = cleanLine.match(/\b\d{1,3}(?:\.\d{3})*,\d{1,2}\b|\b\d{1,3}(?:,\d{3})*\.\d{1,2}\b|\b\d+[.,]\d{1,2}\b|\b\d+\b/g) || [];
    
    const nums = [];
    rawMatches.forEach(m => {
      let s = m.trim();
      if (/\d+\.\d{3},\d+/.test(s)) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else if (/\d+,\d{3}\.\d+/.test(s)) {
        s = s.replace(/,/g, '');
      } else if (/\d+,\d+/.test(s)) {
        s = s.replace(',', '.');
      }
      const val = parseFloat(s);
      if (!isNaN(val) && val > 0) {
        nums.push(val);
      }
    });

    return nums;
  };

  const defaultKnownCatalog = [
    { id: 'bes20', nombre: 'Belmont 20 Cig x 10 Cajetillas (E)', keywords: ['belmont 20', 'bes20', 'bes 20', 'beszo'] },
    { id: 'bes10', nombre: 'Belmont 10 Cig x 12 Cajetillas (E)', keywords: ['belmont 10', 'bes10', 'bes 10', 'besio'] },
    { id: 'pal20', nombre: 'Pall Mall 20 Cig x 10 Cajetillas (E)', keywords: ['pall mall', 'pal20', 'pal 20', 'palzo'] },
    { id: 'c20', nombre: 'Consul Cig x 10 Cajetillas (E)', keywords: ['consul', 'c20', 'c 20', 'czo'] },
    { id: 'vic20', nombre: 'Viceroy 20 Cig x 10 Cajetillas (E)', keywords: ['viceroy', 'vic20', 'vic 20', 'viczo'] },
    { id: 'univ20', nombre: 'Universal 20 Cig x 10 Cajetillas (E)', keywords: ['universal', 'univ20', 'univ 20', 'uni20'] },
    { id: 'lnv', nombre: 'Lucky Nova 20 Cig x 10 Cajetillas (E)', keywords: ['lucky nova', 'lnv', 'inv', '1nv'] },
    { id: 'icc', nombre: 'Lucky Cosmic 20 Cig x 10 Cajetillas (E)', keywords: ['lucky cosmic', 'icc', '1cc'] },
    { id: 'ice', nombre: 'Lucky Eclipse 20 Cig x 10 Cajetillas (E)', keywords: ['lucky eclipse', 'ice', '1ce'] },
    { id: 'lcr', nombre: 'Lucky Strike Red 20 Cig x 10 Cajetillas (E)', keywords: ['lucky strike red', 'lucky strike', 'lcr', '1cr', 'ler', 'isr', 'lsr'] },
    { id: 'bol-02', nombre: 'Boligrafos BIC Azul 12 UND (E)', keywords: ['boligrafo', 'bic', 'bol-02', 'bol02'] }
  ];

  const parseAndFillOCRText = (fullText, currentTasa) => {
    const textClean = fullText.replace(/\r/g, '');
    const lines = textClean.split('\n').map(l => l.trim()).filter(Boolean);

    let headerLines = [];
    let tableLines = [];
    let footerLines = [];
    let currentSection = 'header'; // 'header' | 'table' | 'footer'

    const isTableHeaderRow = (line) => {
      const l = line.toLowerCase();
      const count = ['código', 'codigo', 'descrip', 'cant', 'precio', 'total', 'p.unit', 'costo'].filter(k => l.includes(k)).length;
      return count >= 2;
    };

    const isTableFooterRow = (line) => {
      const l = line.toLowerCase();
      return /sub-?total|base imponible|exento|i\.v\.a|total operaci|total general|total usd|tasa de cambio|ley de impuesto/i.test(l);
    };

    lines.forEach(line => {
      if (currentSection === 'header') {
        if (isTableHeaderRow(line)) {
          currentSection = 'table';
          return;
        }
        // Si la línea contiene un código evidente de catálogo junto a números, inicia la tabla
        const hasDirectProduct = defaultKnownCatalog.some(p => new RegExp(`\\b${p.id}\\b`, 'i').test(line) || p.keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(line)));
        if (hasDirectProduct && extractInvoiceLineNumbers(line).length >= 2) {
          currentSection = 'table';
          tableLines.push(line);
          return;
        }
        headerLines.push(line);
      } else if (currentSection === 'table') {
        if (isTableFooterRow(line)) {
          currentSection = 'footer';
          footerLines.push(line);
          return;
        }
        tableLines.push(line);
      } else {
        footerLines.push(line);
      }
    });

    const headerText = headerLines.join('\n');
    const footerText = footerLines.join('\n');

    let proveedorName = form.proveedorName || '';
    let proveedorRif = form.proveedorRif || '';
    let proveedorTelf = form.proveedorTelf || '';
    let proveedorDir = form.proveedorDir || '';
    let facturaNum = form.facturaNum || '';
    let fecha = form.fecha || today();
    let fechaVenc = form.fechaVenc || todayPlus7();
    let tasaBCV = form.tasaBCV || currentTasa;

    // 1. Proveedor & RIF (Detectar en cabecera)
    if (/SOSACRUZ|Sosa\s*CRUZ/i.test(textClean)) {
      proveedorName = 'DISTRIBUIDORA Y TRANSPORTE SOSACRUZ, C.A.';
      proveedorRif = 'J-50273341-8';
      proveedorTelf = '(0244)419.26.46';
      proveedorDir = 'Calle 8, Casa Nro. 04, Turmero - Edo. Aragua';
    } else {
      const rifMatch = headerText.match(/[JVGjvg]-?\d{7,9}-?\d/i);
      if (rifMatch) proveedorRif = rifMatch[0].toUpperCase();
      const provLine = headerLines.find(l => /DISTRIBUIDORA|TRANSPORTE|COMERCIAL|INVERSIONES|C\.A\.|S\.A\./i.test(l));
      if (provLine) proveedorName = provLine;
    }

    // 2. Nº Documento / Nota de Entrega (Búsqueda global y en cabecera)
    let facturaNum = '';
    const docPatterns = [
      /(?:Nota\s*(?:de\s*)?Entrega|Factura|Doc(?:umento)?)[^\d\n]{0,15}(\d{4,10})/i,
      /N[°ºo\.]*\s*([0-9]{4,10})/i,
      /\b(000\d{4,6}|033\d{3,6}|\d{7,8})\b/
    ];
    for (const pat of docPatterns) {
      const m = (headerText + '\n' + textClean).match(pat);
      if (m && m[1]) {
        facturaNum = m[1];
        break;
      }
    }

    // 2.1 Fechas
    const dateMatch = (headerText + '\n' + textClean).match(/Fecha:\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/i) ||
                      (headerText + '\n' + textClean).match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/);
    if (dateMatch) {
      let day = dateMatch[1].padStart(2, '0');
      let month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3];
      if (year.length === 2) year = '20' + year;
      fecha = `${year}-${month}-${day}`;
    }

    const vencMatch = (headerText + '\n' + textClean).match(/Vence:\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/i);
    if (vencMatch) {
      let day = vencMatch[1].padStart(2, '0');
      let month = vencMatch[2].padStart(2, '0');
      let year = vencMatch[3];
      if (year.length === 2) year = '20' + year;
      fechaVenc = `${year}-${month}-${day}`;
    }

    // 3. Tasa BCV (Exclusivamente de pie de página o texto explícito de tasa)
    const tasaMatch = (footerText + '\n' + textClean).match(/(?:tasa\s*(?:de\s*cambio)?|cambio\s*:?|BCV\s*:?)\s*([\d.,]{3,8})/i);
    if (tasaMatch) {
      let rawTasa = tasaMatch[1].replace(/\./g, '').replace(',', '.');
      const v = parseFloat(rawTasa);
      if (v > 10 && v < 5000) tasaBCV = v;
    }

    // 4. Mapeo dinámico de productos contra inventario y catálogo
    const activeCatalog = [...defaultKnownCatalog];
    if (inventarioList && inventarioList.length > 0) {
      inventarioList.forEach(inv => {
        if (inv.id && !activeCatalog.some(c => c.id.toLowerCase() === inv.id.toLowerCase())) {
          activeCatalog.push({
            id: inv.id,
            nombre: inv.nombre,
            keywords: [inv.id.toLowerCase(), (inv.nombre || '').toLowerCase()]
          });
        }
      });
    }

    let itemsExtraidos = [];
    const processedCodes = new Set();

    // Recorrer ÚNICAMENTE las líneas de la sección de la tabla de productos
    tableLines.forEach(line => {
      const nums = extractInvoiceLineNumbers(line);

      if (nums.length >= 2) {
        const lLower = line.toLowerCase();
        const parts = line.split(/\s+/);
        const rawCode = parts[0] ? parts[0].toLowerCase().replace(/[^a-z0-9]/gi, '') : '';
        
        // 1. Coincidencia exacta por código
        let matched = activeCatalog.find(p => p.id.toLowerCase() === rawCode);
        
        // 2. Coincidencia por palabra clave completa
        if (!matched) {
          matched = activeCatalog.find(p => p.keywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lLower)));
        }

        let code = matched ? matched.id : rawCode;
        let name = matched ? matched.nombre : '';

        // Si aún no tiene nombre, extraer descripción limpia de la línea
        if (!name) {
          let desc = line;
          if (rawCode) desc = desc.replace(parts[0], '');
          desc = desc.replace(/[\d.,]+\s*$/g, '').replace(/[\d.,]+/g, '').replace(/cajetillas|und|cig/gi, '').trim();
          if (desc.length > 3) name = desc;
        }

        if (name || code.length >= 2) {
          let cant = nums[0];
          let cost = nums[1];
          let lineTotal = nums.length >= 3 ? nums[2] : 0;

          // Recuperar cantidades donde la coma decimal ',00' no se leyó (ej: 10,00 leído como 1000, 70,00 como 7000)
          if (cant >= 100 && cant % 100 === 0 && (lineTotal === 0 || Math.abs((cant / 100) * cost - lineTotal) < 5 || (cant / 100) * cost < 10000)) {
            cant = cant / 100;
          } else if (cant >= 500 && cant % 50 === 0 && lineTotal > 0 && Math.abs((cant / 100) * cost - lineTotal) < 5) {
            cant = cant / 100;
          }

          cant = Math.round(cant);

          // Si el total de línea vino distorsionado o no vino, calcular exactamente cant * cost
          if (lineTotal <= 0 || (lineTotal < cost && cant > 1) || Math.abs(cant * cost - lineTotal) > 10) {
            lineTotal = cant * cost;
          }

          if (cant > 0 && cost > 0) {
            itemsExtraidos.push({
              codigo: code || `item-${itemsExtraidos.length + 1}`,
              nombre: name || line,
              cantidad: cant,
              costoUSD: Number(cost).toFixed(2),
              totalUSD: Number(lineTotal > 0 ? lineTotal : cant * cost).toFixed(2),
              totalVES: (Number(lineTotal > 0 ? lineTotal : cant * cost) * parseFloat(tasaBCV)).toFixed(2)
            });
            if (code) processedCodes.add(code.toLowerCase());
          }
        }
      }
    });

    if (itemsExtraidos.length === 0) {
      itemsExtraidos = [emptyItem()];
    }

    const calcTotalUSD = itemsExtraidos.reduce((s, it) => s + parseFloat(it.totalUSD || 0), 0);
    const calcTotalVES = calcTotalUSD * parseFloat(tasaBCV);

    setForm(f => ({
      ...f,
      proveedorName,
      proveedorRif,
      proveedorTelf,
      proveedorDir,
      facturaNum: facturaNum || f.facturaNum,
      fecha,
      fechaVenc,
      tasaBCV: parseFloat(tasaBCV).toFixed(2),
      items: itemsExtraidos,
      totalUSD: calcTotalUSD.toFixed(2),
      totalVES: calcTotalVES.toFixed(2)
    }));
  };

  const handleOCR = async (file) => {
    if (!file) return;
    const imgUrl = URL.createObjectURL(file);
    setFacturaImg(imgUrl);
    setImgRotation(0);
    setOcrRunning(true);
    setOcrText('Cargando imagen e iniciando motor OCR...');

    const tempImg = new Image();
    tempImg.src = imgUrl;
    await new Promise(r => { tempImg.onload = r; });

    try {
      if (typeof window !== 'undefined') {
        if (!window.Tesseract) {
          setOcrText('Cargando motor de reconocimiento OCR en segundo plano...');
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }

        // Evaluar orientaciones: 0° primero, luego 270°, 90°, 180°
        const anglesToTest = [0, 270, 90, 180];
        let bestText = '';
        let bestAngle = 0;
        let highestScore = -1;

        for (const angle of anglesToTest) {
          setOcrText(`Digitalizando factura (${angle}°)...`);
          const canvas = await preprocessImage(tempImg, angle);
          const imageSource = canvas ? canvas.toDataURL('image/jpeg', 0.95) : file;

          const result = await window.Tesseract.recognize(imageSource, 'spa+eng', {
            logger: m => {
              if (m.status === 'recognizing text') {
                const pct = Math.round(m.progress * 100);
                setOcrText(`Leyendo factura (${angle}°): ${pct}%`);
              }
            }
          });

          const txt = result.data.text || '';
          const score = calculateOCRScore(txt);
          if (score > highestScore) {
            highestScore = score;
            bestText = txt;
            bestAngle = angle;
          }
          if (score >= 40) break;
        }

        setImgRotation(bestAngle);
        setOcrText('Extrayendo datos de la factura: proveedor, RIF, número, tasa BCV, precios y renglones...');
        parseAndFillOCRText(bestText, bcvTasa);
        setOcrText('✅ Factura digitalizada correctamente. Todos los datos han sido cargados.');
      } else {
        setOcrText('⚠️ Motor OCR aún cargando. Puedes ingresar los datos manualmente.');
      }
    } catch (err) {
      console.warn('OCR error:', err);
      setOcrText('⚠️ Nota: ' + (err.message || 'No se pudo digitalizar automáticamente.') + ' Puedes ingresar los datos manualmente.');
    } finally {
      setOcrRunning(false);
    }
  };

  const demoSosacruz = () => {
    const tasa = parseFloat(bcvTasa || 848.55);
    const items = [
      { codigo: 'bes20', nombre: 'Belmont 20 Cig x 10 Cajetillas (E)', cantidad: 70, costoUSD: '25.12', totalUSD: '1758.40', totalVES: (1758.40 * tasa).toFixed(2) },
      { codigo: 'bes10', nombre: 'Belmont 10 Cig x 12 Cajetillas (E)', cantidad: 10, costoUSD: '15.14', totalUSD: '151.40', totalVES: (151.40 * tasa).toFixed(2) },
      { codigo: 'pal20', nombre: 'Pall Mall 20 Cig x 10 Cajetillas (E)', cantidad: 12, costoUSD: '8.00', totalUSD: '96.00', totalVES: (96.00 * tasa).toFixed(2) },
      { codigo: 'c20', nombre: 'Consul Cig x 10 Cajetillas (E)', cantidad: 280, costoUSD: '13.04', totalUSD: '3651.20', totalVES: (3651.20 * tasa).toFixed(2) },
      { codigo: 'vic20', nombre: 'Viceroy 20 Cig x 10 Cajetillas (E)', cantidad: 30, costoUSD: '15.97', totalUSD: '479.10', totalVES: (479.10 * tasa).toFixed(2) },
      { codigo: 'univ20', nombre: 'Universal 20 Cig x 10 Cajetillas (E)', cantidad: 10, costoUSD: '15.85', totalUSD: '158.50', totalVES: (158.50 * tasa).toFixed(2) },
      { codigo: 'lnv', nombre: 'Lucky Nova 20 Cig x 10 Cajetillas (E)', cantidad: 50, costoUSD: '28.90', totalUSD: '1445.00', totalVES: (1445.00 * tasa).toFixed(2) },
      { codigo: 'icc', nombre: 'Lucky Cosmic 20 Cig x 10 Cajetillas (E)', cantidad: 5, costoUSD: '28.90', totalUSD: '144.50', totalVES: (144.50 * tasa).toFixed(2) },
      { codigo: 'lcr', nombre: 'Lucky Strike Red 20 Cig x 10 Cajetillas (E)', cantidad: 10, costoUSD: '28.05', totalUSD: '280.45', totalVES: (280.45 * tasa).toFixed(2) }
    ];
    const totalUSD = items.reduce((s, it) => s + parseFloat(it.totalUSD), 0);
    setForm(f => ({
      ...f,
      proveedorName: 'DISTRIBUIDORA Y TRANSPORTE SOSACRUZ, C.A.',
      proveedorRif: 'J-50273341-8',
      proveedorTelf: '(0244)419.26.46',
      proveedorDir: 'Calle 8, Casa Nro. 04, Turmero - Edo. Aragua',
      tipoDoc: 'NOTA DE ENTREGA',
      facturaNum: '00033015',
      tasaBCV: tasa.toFixed(2),
      fecha: '2026-09-18',
      fechaVenc: '2026-09-25',
      items: items,
      totalUSD: totalUSD.toFixed(2),
      totalVES: (totalUSD * tasa).toFixed(2)
    }));
  };

  return (
    <>
      {/* Tesseract.js OCR */}
      <Script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" strategy="afterInteractive" />

      <div className="page-header" style={{ marginBottom: '1.75rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
            <i className="fa-solid fa-truck-loading" style={{ color: '#0284c7' }}></i> Entradas / Compras a Proveedores
          </h1>
          <p className="page-subtitle" style={{ color: '#475569', fontSize: '0.92rem', fontWeight: 500, margin: 0 }}>
            Carga de facturas/notas de entrega, escaneo OCR automático, control dual ($ / Bs.) e incremento de inventario
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}><i className="fa-solid fa-plus"></i> Registrar Nueva Compra</button>
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
          <div className="modal-content" style={{maxWidth:950}}>
            <div className="modal-header">
              <div>
                <h2><i className="fa-solid fa-file-circle-plus"></i> Cargar Factura de Proveedor / Entrada</h2>
                <p style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>Toma una foto de la factura o sube la imagen para escaneo automático OCR</p>
              </div>
              <button type="button" className="modal-close" onClick={resetModalForm}>&times;</button>
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
          {ocrText && (
            <div style={{
              background: ocrRunning ? '#fef3c7' : (ocrText.includes('✅') ? '#dcfce7' : '#f0f9ff'),
              border: `1px solid ${ocrRunning ? '#f59e0b' : (ocrText.includes('✅') ? '#22c55e' : '#bae6fd')}`,
              color: ocrRunning ? '#92400e' : (ocrText.includes('✅') ? '#15803d' : '#0369a1'),
              padding: '0.65rem 0.9rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {ocrRunning && <i className="fa-solid fa-spinner fa-spin"></i>}
              <span>{ocrText}</span>
            </div>
          )}

          {facturaImg && (
            <div style={{marginBottom:'1rem', padding:'0.75rem', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, textAlign:'center'}}>
              <div style={{overflow:'hidden', maxHeight:280, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <img src={facturaImg} alt="Factura" style={{maxWidth:'100%', maxHeight:260, borderRadius:8, objectFit:'contain', transform:`rotate(${imgRotation}deg)`, transition:'transform 0.2s ease'}} />
              </div>
              <div style={{display:'flex', gap:'0.5rem', justifyContent:'center', marginTop:'0.6rem'}}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImgRotation(r => (r + 90) % 360)}>
                  <i className="fa-solid fa-rotate-right"></i> Girar 90°
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => { setFacturaImg(null); setOcrText(''); }}>
                  <i className="fa-solid fa-trash"></i> Quitar Foto
                </button>
              </div>
            </div>
          )}

          {/* Formulario */}
          <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:'0.85rem 1rem', borderRadius:10, marginBottom:'1rem'}}>
            <h4 style={{fontSize:'0.85rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'0.6rem', textTransform:'uppercase'}}><i className="fa-solid fa-building"></i> Datos del Proveedor</h4>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'0.75rem', marginBottom:'0.5rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Nombre o Razón Social *</label>
                <input type="text" className="form-control" placeholder="Nombre o Razón Social" required style={{fontSize:'0.88rem'}} value={form.proveedorName} onChange={e=>setForm(f=>({...f,proveedorName:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>RIF *</label>
                <input type="text" className="form-control" placeholder="J-00000000-0" style={{fontSize:'0.88rem'}} value={form.proveedorRif} onChange={e=>setForm(f=>({...f,proveedorRif:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Teléfono</label>
                <input type="text" className="form-control" placeholder="Teléfono" style={{fontSize:'0.88rem'}} value={form.proveedorTelf} onChange={e=>setForm(f=>({...f,proveedorTelf:e.target.value}))} />
              </div>
            </div>
          </div>

          <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:'0.85rem 1rem', borderRadius:10, marginBottom:'1rem'}}>
            <h4 style={{fontSize:'0.85rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'0.6rem', textTransform:'uppercase'}}><i className="fa-solid fa-file-invoice"></i> Datos del Documento y Tasa BCV</h4>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'0.75rem', marginBottom:'0.75rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Tipo Documento</label>
                <select className="form-control" style={{fontSize:'0.85rem'}} value={form.tipoDoc} onChange={e=>setForm(f=>({...f,tipoDoc:e.target.value}))}>
                  <option>NOTA DE ENTREGA</option><option>FACTURA</option><option>ORDEN DE COMPRA</option>
                </select>
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem'}}>Nº Documento *</label>
                <input type="text" className="form-control" placeholder="Nº Documento" required style={{fontSize:'0.88rem'}} value={form.facturaNum} onChange={e=>setForm(f=>({...f,facturaNum:e.target.value}))} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label" style={{fontSize:'0.8rem', fontWeight:700, color:'#0284c7'}}>🇻🇪 Tasa BCV (Bs./$)</label>
                <input type="number" step="0.0001" className="form-control" placeholder="0.00" required style={{fontSize:'0.92rem', fontWeight:700, color:'#0284c7'}} value={form.tasaBCV} onChange={e=>setForm(f=>({...f,tasaBCV:e.target.value}))} />
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'0.75rem'}}>
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

          {/* Renglones de la Factura — layout adaptado a móvil */}
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem'}}>
            <h3 style={{fontSize:'0.95rem', fontWeight:700}}><i className="fa-solid fa-boxes-stacked"></i> Renglones de la Factura / Nota de Entrega</h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setForm(f=>({...f, items:[...f.items, emptyItem()]}))}>+ Agregar Renglón</button>
          </div>

          <div style={{border:'1px solid #cbd5e1', borderRadius:10, background:'#f8fafc', padding:'0.5rem', marginBottom:'1rem', maxHeight:360, overflowY:'auto'}}>
            {form.items.length === 0 ? (
              <div style={{padding:'1.2rem', textAlign:'center', color:'#64748b', fontSize:'0.85rem'}}>No hay renglones. Haz clic en <strong>+ Agregar Renglón</strong> o escanea una factura.</div>
            ) : form.items.map((item, i) => (
              <div key={i} style={{background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:10, padding:'0.65rem 0.75rem', marginBottom:'0.6rem', boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                {/* Fila 1: Código + Descripción + Eliminar */}
                <div style={{display:'flex', gap:'0.4rem', alignItems:'center', marginBottom:'0.5rem'}}>
                  <input type="text" className="form-control" style={{width:80, fontSize:'0.8rem', padding:'0.35rem 0.45rem', minHeight:38, flexShrink:0}} placeholder="Código" value={item.codigo} onChange={e=>updateItem(i,'codigo',e.target.value)} />
                  <input type="text" className="form-control" style={{flex:1, fontSize:'0.85rem', padding:'0.35rem 0.5rem', minHeight:38}} placeholder="Descripción del producto" required value={item.nombre} onChange={e=>updateItem(i,'nombre',e.target.value)} />
                  <button type="button" className="btn btn-danger btn-sm" style={{width:38, height:38, minHeight:38, minWidth:38, padding:0, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}} onClick={()=>setForm(f=>({...f, items:f.items.filter((_,j)=>j!==i)}))} title="Eliminar renglón">
                    <i className="fa-solid fa-trash" style={{fontSize:'0.85rem'}}></i>
                  </button>
                </div>
                {/* Fila 2: Cantidad | Costo Unitario $ | Total Renglón $ */}
                <div style={{display:'grid', gridTemplateColumns:'85px 1fr 1.3fr', gap:'0.5rem', alignItems:'center', background:'#f8fafc', padding:'0.4rem 0.6rem', borderRadius:8, border:'1px solid #f1f5f9'}}>
                  <div>
                    <span style={{fontSize:'0.7rem', fontWeight:600, color:'#64748b', display:'block', marginBottom:2}}>Cant:</span>
                    <input type="number" className="form-control" style={{fontSize:'0.88rem', padding:'0.25rem 0.4rem', minHeight:34, textAlign:'center', fontWeight:600}} min="1" placeholder="Cant." value={item.cantidad} onChange={e=>updateItem(i,'cantidad',e.target.value)} />
                  </div>
                  <div>
                    <span style={{fontSize:'0.7rem', fontWeight:600, color:'#64748b', display:'block', marginBottom:2}}>Costo Unit $:</span>
                    <input type="number" step="0.01" className="form-control" style={{fontSize:'0.88rem', padding:'0.25rem 0.4rem', minHeight:34, fontWeight:600}} placeholder="0.00" value={item.costoUSD} onChange={e=>updateItem(i,'costoUSD',e.target.value)} title="Precio unitario USD $" />
                  </div>
                  <div>
                    <span style={{fontSize:'0.7rem', fontWeight:700, color:'#0284c7', display:'block', marginBottom:2}}>Total $:</span>
                    <input type="number" step="0.01" className="form-control" style={{fontSize:'0.95rem', padding:'0.25rem 0.5rem', minHeight:34, fontWeight:800, color:'#0284c7', borderColor:'#38bdf8', background:'#f0f9ff'}} placeholder="0.00" value={item.totalUSD} onChange={e=>updateItem(i,'totalUSD',e.target.value)} title="Total renglón USD $" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totales adaptados a móvil */}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0f172a', color:'#fff', padding:'0.85rem 1rem', borderRadius:10, marginTop:'1rem', flexWrap:'wrap', gap:'0.75rem'}}>
            <div style={{fontSize:'0.85rem'}}>Unidades: <strong style={{color:'#fbbf24', fontSize:'1.05rem'}}>{form.items.reduce((s,it)=>s+parseInt(it.cantidad||0),0)}</strong></div>
            <div style={{display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap', width:'100%', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:'0.4rem', flex:'1 1 180px'}}>
                <label style={{fontSize:'0.8rem', color:'#38bdf8', fontWeight:700, margin:0, whiteSpace:'nowrap'}}>Total USD $:</label>
                <input type="number" step="0.01" className="form-control" style={{flex:1, minWidth:90, fontSize:'1.05rem', fontWeight:800, color:'#38bdf8', background:'#1e293b', border:'1.5px solid #38bdf8', textAlign:'right', padding:'4px 8px'}} value={form.totalUSD} onChange={e=>setForm(f=>({...f, totalUSD:e.target.value, totalVES:(parseFloat(e.target.value||0)*parseFloat(f.tasaBCV||798.33)).toFixed(2)}))} />
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'0.4rem', flex:'1 1 180px'}}>
                <label style={{fontSize:'0.8rem', color:'#a7f3d0', fontWeight:700, margin:0, whiteSpace:'nowrap'}}>(Bs.):</label>
                <input type="number" step="0.01" className="form-control" style={{flex:1, minWidth:110, fontSize:'1rem', fontWeight:800, color:'#a7f3d0', background:'#1e293b', border:'1.5px solid #a7f3d0', textAlign:'right', padding:'4px 8px'}} value={form.totalVES} onChange={e=>setForm(f=>({...f, totalVES:e.target.value}))} />
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-primary" style={{width:'100%', fontSize:'1rem', padding:'0.75rem', marginTop:'1.25rem'}} onClick={()=>handleSave(false)}>
            <i className="fa-solid fa-eye"></i> Previsualizar antes de Guardar
          </button>
        </div>
      </div>
      )}

      {/* Modal Preview / Inspección Visual Completa de la Factura */}
      {showPreviewModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth:950}}>
            <div className="modal-header" style={{marginBottom:'0.75rem', borderBottom:'2px solid var(--primary-light)', paddingBottom:'0.5rem'}}>
              <div>
                <h2><i className="fa-solid fa-clipboard-check" style={{color:'var(--success)'}}></i> Inspección Visual Completa de la Factura</h2>
                <p style={{fontSize:'0.82rem', color:'var(--text-secondary)'}}>Verifica todos los datos de la factura/nota de entrega antes de ingresar al inventario</p>
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowPreviewModal(false)}>&times;</button>
            </div>

            {/* Cabecera Datos Factura y Proveedor */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'1rem', background:'#f8fafc', padding:'1rem', borderRadius:8, border:'1px solid #e2e8f0'}}>
              <div>
                <h4 style={{fontSize:'0.85rem', color:'var(--primary)', marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.5px'}}>
                  <i className="fa-solid fa-building"></i> Datos del Proveedor
                </h4>
                <div style={{fontSize:'0.88rem', fontWeight:700}}>{form.proveedorName || '—'}</div>
                <div style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>RIF: <strong>{form.proveedorRif || '—'}</strong> | Telf: <strong>{form.proveedorTelf || '—'}</strong></div>
                {form.proveedorDir && <div style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>{form.proveedorDir}</div>}
              </div>
              <div>
                <h4 style={{fontSize:'0.85rem', color:'var(--primary)', marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.5px'}}>
                  <i className="fa-solid fa-file-invoice"></i> Datos del Documento
                </h4>
                <div style={{fontSize:'0.88rem', fontWeight:700}}>{form.tipoDoc} N° {form.facturaNum || '—'}</div>
                <div style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>Emisión: <strong>{form.fecha}</strong> | Vencimiento: <strong>{form.fechaVenc}</strong></div>
                <div style={{fontSize:'0.82rem', color:'#0284c7', fontWeight:700, marginTop:'0.2rem'}}>
                  🇻🇪 Tasa BCV de la Factura: <span style={{fontSize:'0.95rem'}}>{Number(form.tasaBCV||0).toFixed(2)} Bs./$</span>
                </div>
              </div>
            </div>

            {/* Tabla de Productos / Renglones */}
            <div style={{overflowX:'auto', marginBottom:'1rem'}}>
              <table style={{width:'100%', minWidth:650}}>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th>Precio USD $</th>
                    <th>Total USD $</th>
                    <th>Total Bs.</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.filter(it=>it.nombre&&parseInt(it.cantidad||0)>0).map((it,i) => (
                    <tr key={i}>
                      <td style={{fontWeight:600, fontSize:'0.82rem'}}>{it.codigo || '—'}</td>
                      <td><strong>{it.nombre}</strong></td>
                      <td><span className="badge badge-primary">{it.cantidad}</span></td>
                      <td>${Number(it.costoUSD||0).toFixed(2)}</td>
                      <td style={{fontWeight:800, color:'var(--primary)'}}>${Number(it.totalUSD||0).toFixed(2)}</td>
                      <td style={{color:'var(--text-secondary)'}}>Bs. {Number((parseFloat(it.totalUSD||0))*parseFloat(form.tasaBCV||798.33)).toLocaleString('es-VE',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen Totales de la Factura */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0f172a', color:'#fff', padding:'0.85rem 1.25rem', borderRadius:10, flexWrap:'wrap', gap:'0.75rem'}}>
              <div style={{fontSize:'0.85rem'}}>
                Unidades Totales: <strong style={{color:'#fbbf24', fontSize:'1.05rem'}}>{form.items.reduce((s,it)=>s+parseInt(it.cantidad||0),0)}</strong>
              </div>
              <div style={{display:'flex', gap:'1.5rem', alignItems:'center'}}>
                <div>
                  <span style={{fontSize:'0.78rem', color:'#94a3b8', display:'block'}}>TOTAL OPERACIÓN USD $</span>
                  <span style={{fontSize:'1.2rem', fontWeight:800, color:'#38bdf8'}}>${Number(form.totalUSD||0).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </div>
                <div>
                  <span style={{fontSize:'0.78rem', color:'#94a3b8', display:'block'}}>TOTAL OPERACIÓN (BS.)</span>
                  <span style={{fontSize:'1.15rem', fontWeight:800, color:'#a7f3d0'}}>Bs. {Number(form.totalVES||0).toLocaleString('es-VE',{minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </div>
              </div>
            </div>

            {form.observaciones && (
              <div style={{marginTop:'0.75rem', fontSize:'0.82rem', color:'var(--text-secondary)', background:'#f1f5f9', padding:'0.5rem 0.75rem', borderRadius:6}}>
                <strong>Observaciones:</strong> {form.observaciones}
              </div>
            )}

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
          <div className="modal-content">
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

      {/* Modal Elegante de Confirmación y Alertas */}
      <ConfirmModal
        {...confirmDialog}
        onCancel={() => setConfirmDialog(cd => ({ ...cd, isOpen: false }))}
      />
    </>
  );
}
