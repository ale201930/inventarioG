// assets/js/salidas_v2.js - Facturación, Stock, Impresión 80mm, Filtros, Eliminar

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('salidasTableBody');
  if (!tableBody) return;

  const modalSalida  = document.getElementById('salidaModal');
  const modalTicket  = document.getElementById('ticketModal');
  const modalAbono   = document.getElementById('abonoSalidaModal');
  const itemsContainer   = document.getElementById('salidaItemsContainer');
  const ticketPreviewArea = document.getElementById('ticketPreviewArea');
  const searchInput  = document.getElementById('searchSalida');
  const filterFecha  = document.getElementById('filterFecha');
  const btnClearFecha = document.getElementById('btnClearFecha');

  let salidas = [];
  let productos = [];
  let currentTicketData = null;

  // ── Parseo seguro de números (acepta coma o punto) ──────────────────────
  function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    const n = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  // ── Formateador de Bolívares ─────────────────────────────────────────────
  function formatBs(val) {
    const n = parseNum(val);
    return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Inicialización ──────────────────────────────────────────────────────
  async function init() {
    const r = await API.get('api/inventario.php');
    if (r.success) productos = r.data;
    await loadSalidas();
  }

  async function loadSalidas() {
    const r = await API.get('api/salidas.php');
    if (r.success) {
      salidas = r.data;
      applyFilters();
    }
  }

  // ── Filtros ─────────────────────────────────────────────────────────────
  function applyFilters() {
    const term  = (searchInput?.value || '').toLowerCase().trim();
    const fecha = filterFecha?.value || '';

    const filtered = salidas.filter(s => {
      const matchText = !term ||
        (s.cliente_name || '').toLowerCase().includes(term) ||
        (s.factura_number || '').toLowerCase().includes(term) ||
        (s.cedula_rif || '').toLowerCase().includes(term);

      const matchFecha = !fecha || s.fecha === fecha;

      return matchText && matchFecha;
    });

    renderTable(filtered);
  }

  searchInput?.addEventListener('input', applyFilters);
  filterFecha?.addEventListener('change', applyFilters);
  btnClearFecha?.addEventListener('click', () => {
    if (filterFecha) filterFecha.value = '';
    applyFilters();
  });

  // ── Tabla ────────────────────────────────────────────────────────────────
  function renderTable(list) {
    if (!list || list.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">
        <i class="fa-solid fa-inbox" style="font-size:2rem;opacity:.3;display:block;margin-bottom:.5rem;"></i>
        No hay facturas registradas
      </td></tr>`;
      return;
    }

    tableBody.innerHTML = list.map(s => `
      <tr>
        <td><span class="badge badge-primary" style="font-size:.75rem;">${s.tipo_documento || 'ORDEN'}</span></td>
        <td><strong>Nº ${s.factura_number || '-'}</strong></td>
        <td>${s.fecha || '-'}</td>
        <td><strong>${s.cliente_name}</strong><br>
            <span style="font-size:.78rem;color:var(--text-secondary);">${s.telefono || ''}</span></td>
        <td>${s.cedula_rif || '-'}</td>
        <td><strong>$${parseNum(s.total_factura).toFixed(2)}</strong></td>
        <td>
          <span class="badge ${parseNum(s.saldo_adeudado) > 0 ? 'badge-warning' : 'badge-success'}">
            $${parseNum(s.saldo_adeudado).toFixed(2)}
          </span>
        </td>
        <td style="white-space:nowrap;">
          <button type="button" class="btn btn-secondary btn-sm print-row-btn" data-id="${s.id}" title="Reimprimir ticket">
            <i class="fa-solid fa-print"></i>
          </button>
          <button type="button" class="btn btn-secondary btn-sm abono-btn" data-id="${s.id}" data-cliente="${s.cliente_name}" data-saldo="${s.saldo_adeudado}" title="Registrar abono">
            <i class="fa-solid fa-hand-holding-dollar"></i>
          </button>
          <button type="button" class="btn btn-secondary btn-sm ec-btn" data-cliente="${s.cliente_name}" title="Ver Estado de Cuenta de este cliente" style="background:#0284c7; color:#fff; border:none;">
            <i class="fa-solid fa-file-invoice-dollar"></i>
          </button>
          <button type="button" class="btn btn-danger btn-sm delete-salida-btn" data-id="${s.id}" data-num="${s.factura_number}" title="Eliminar factura">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.print-row-btn').forEach(b =>
      b.addEventListener('click', () => openTicketById(b.dataset.id)));

    document.querySelectorAll('.abono-btn').forEach(b =>
      b.addEventListener('click', () => openAbonoModal(b.dataset.id, b.dataset.cliente, b.dataset.saldo)));

    document.querySelectorAll('.ec-btn').forEach(b =>
      b.addEventListener('click', async () => {
        await populateClientesDropdown();
        selectClienteEstadoCuenta.value = b.dataset.cliente;
        await loadAndRenderEstadoCuenta(b.dataset.cliente);
        modalEstadoCuenta.classList.add('active');
      }));

    document.querySelectorAll('.delete-salida-btn').forEach(b =>
      b.addEventListener('click', () => deleteSalida(b.dataset.id, b.dataset.num)));
  }

  // ── Eliminar Factura ────────────────────────────────────────────────────
  async function deleteSalida(id, numero) {
    if (!confirm(`¿Eliminar la factura Nº ${numero}?\n\nSe repondrá el stock de los productos. Esta acción no se puede deshacer.`)) return;

    const r = await API.delete(`api/salidas.php`, { id });
    if (r.success) {
      await loadSalidas();
    } else {
      alert('Error al eliminar: ' + (r.error || 'Error desconocido'));
    }
  }

  // ── Cálculo de totales en tiempo real ───────────────────────────────────
  function calculateAllTotals() {
    let totalUnd = 0, totalMonto = 0;
    itemsContainer.querySelectorAll('.item-row').forEach(row => {
      const cant   = parseInt(row.querySelector('.item-cant')?.value)  || 0;
      const precio = parseNum(row.querySelector('.item-precio')?.value);
      const sub    = cant * precio;
      const subEl  = row.querySelector('.item-subtotal');
      if (subEl) subEl.value = sub > 0 ? `$${sub.toFixed(2)}` : '';
      totalUnd   += cant;
      totalMonto += sub;
    });
    const elU = document.getElementById('salTotalUnidadesText');
    const elM = document.getElementById('salTotalMontoText');
    if (elU) elU.textContent = totalUnd;
    if (elM) elM.textContent = `$${totalMonto.toFixed(2)}`;
  }

  // ── Agregar renglón de producto ─────────────────────────────────────────
  function addItemRow(prodIdDef = '', cantDef = 1, precioDef = '') {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.style.cssText = 'display:grid;grid-template-columns:2.5fr 0.8fr 1fr 1fr auto;gap:.5rem;margin-bottom:.4rem;';

    div.innerHTML = `
      <select class="form-control item-prod" required>
        <option value="">Seleccionar producto...</option>
        ${productos.map(p => `
          <option value="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precio_unitario}" data-stock="${p.cantidad}"
            ${p.id === prodIdDef ? 'selected' : ''}>
            ${p.nombre} (Stock: ${p.cantidad})
          </option>`).join('')}
      </select>
      <div style="position:relative;">
        <input type="number" class="form-control item-cant" placeholder="Cant." min="1" value="${cantDef}" required
          style="padding-right: 2.5rem;">
        <span class="stock-badge" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);
          font-size:0.68rem;background:#e2e8f0;color:#475569;border-radius:4px;padding:1px 4px;pointer-events:none;">
          máx ?
        </span>
      </div>
      <input type="text" inputmode="decimal" class="form-control item-precio" placeholder="0.00" value="${precioDef}" required>
      <input type="text" class="form-control item-subtotal" placeholder="$0.00" readonly
        style="background:#f8fafc;font-weight:700;text-align:right;color:var(--success);">
      <button type="button" class="btn btn-danger btn-sm remove-item" style="padding:.3rem .6rem;">&times;</button>
    `;

    const sel      = div.querySelector('.item-prod');
    const inCant   = div.querySelector('.item-cant');
    const inPrec   = div.querySelector('.item-precio');
    const stockBdg = div.querySelector('.stock-badge');

    function getStock() {
      const opt = sel.options[sel.selectedIndex];
      return parseInt(opt?.dataset.stock || '0');
    }

    function validateStock() {
      const stock = getStock();
      const cant  = parseInt(inCant.value) || 0;
      stockBdg.textContent = `máx ${stock}`;
      if (stock === 0) {
        inCant.style.borderColor = '#ef4444';
        inCant.style.background  = '#fef2f2';
        inCant.title = 'Sin stock disponible';
      } else if (cant > stock) {
        inCant.value = stock;
        inCant.style.borderColor = '#f97316';
        inCant.style.background  = '#fff7ed';
        inCant.title = `Máximo disponible: ${stock}`;
      } else if (cant > 0) {
        inCant.style.borderColor = '';
        inCant.style.background  = '';
        inCant.title = '';
      }
      calculateAllTotals();
    }

    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      if (opt?.dataset.precio) inPrec.value = parseNum(opt.dataset.precio).toFixed(2);
      validateStock();
    });
    ['input','keyup','change','blur'].forEach(e => {
      inCant.addEventListener(e, validateStock);
      inPrec.addEventListener(e, calculateAllTotals);
    });
    div.querySelector('.remove-item').addEventListener('click', () => {
      div.remove(); calculateAllTotals();
    });

    itemsContainer.appendChild(div);
    calculateAllTotals();
  }

  // ── Modales: abrir / cerrar ──────────────────────────────────────────────
  document.getElementById('btnNuevaSalida')?.addEventListener('click', () => {
    document.getElementById('salidaForm').reset();
    itemsContainer.innerHTML = '';
    addItemRow();
    modalSalida.classList.add('active');
  });
  document.getElementById('btnSalidaAddItem')?.addEventListener('click', () => addItemRow());
  document.getElementById('btnCloseSalidaModal')?.addEventListener('click', () => modalSalida.classList.remove('active'));
  document.getElementById('btnCloseTicketModal')?.addEventListener('click', () => modalTicket.classList.remove('active'));
  document.getElementById('btnCloseAbonoSalidaModal')?.addEventListener('click', () => modalAbono.classList.remove('active'));

  // ── Procesar Factura ─────────────────────────────────────────────────────
  async function processSalida(shouldPrint) {
    const cliente = document.getElementById('salCliente').value.trim();
    const cedula  = document.getElementById('salCedula').value.trim();
    if (!cliente) { alert('Ingresa el nombre del cliente.'); document.getElementById('salCliente').focus(); return; }
    if (!cedula)  { alert('Ingresa la Cédula / RIF.'); document.getElementById('salCedula').focus(); return; }

    const items = [];
    itemsContainer.querySelectorAll('.item-row').forEach(row => {
      const sel  = row.querySelector('.item-prod');
      const id   = sel.value;
      const nom  = sel.options[sel.selectedIndex]?.dataset.nombre || '';
      const cant = parseInt(row.querySelector('.item-cant').value) || 0;
      const prec = parseNum(row.querySelector('.item-precio').value);
      if (id && cant > 0) items.push({ productoId: id, productoNombre: nom, cantidad: cant, precioUnitario: prec });
    });
    if (items.length === 0) { alert('Selecciona al menos un producto con cantidad válida.'); return; }

    const payload = {
      tipoDocumento: document.querySelector('input[name="salTipoDoc"]:checked')?.value || 'ORDEN DE ENTREGA',
      clienteName:  cliente,
      cedulaRif:    cedula,
      telefono:     document.getElementById('salTelefono').value.trim(),
      direccion:    document.getElementById('salDireccion').value.trim(),
      vendedorName: 'JUAN MORA',
      fecha:        document.getElementById('salFecha').value,
      items
    };

    const r = await API.post('api/salidas.php', payload);
    if (r.success) {
      modalSalida.classList.remove('active');
      currentTicketData = r.data;
      await loadSalidas();
      if (shouldPrint) {
        renderTicketPreview(r.data);
        modalTicket.classList.add('active');
        printTicket80mm(r.data);
      } else {
        alert('✅ Factura guardada. Stock descontado correctamente.');
      }
    } else {
      alert('Error: ' + (r.error || 'Error desconocido'));
    }
  }

  document.getElementById('salidaForm')?.addEventListener('submit', e => { e.preventDefault(); processSalida(true); });
  document.getElementById('btnOnlySaveSalida')?.addEventListener('click', () => processSalida(false));

  // ── Generador del HTML del ticket (Elegante + Ajustado a impresora de 80mm) ──
  function generateTicketHTML(data) {
    const items      = data.items || [];
    const totalUnits = data.total_unidades || items.reduce((a,b) => a + parseInt(b.cantidad || 0), 0);
    const totalUSD   = parseNum(data.total_factura);

    const TBL  = 'width:100%;border-collapse:collapse;table-layout:fixed;margin:6px 0;font-size:10.5px;';
    const TH_BASE = 'border-top:1px solid #000;border-bottom:1px solid #000;font-size:9.5px;font-weight:700;text-transform:uppercase;padding:4px 2px;';
    const TD_BASE = 'padding:4px 2px;font-size:10.5px;vertical-align:top;border-bottom:1px solid #f1f5f9;';

    const filas = items.map(i => {
      const cant = parseInt(i.cantidad || 0);
      const prec = parseNum(i.precio_unitario);
      const sub  = cant * prec;
      const nom  = (i.producto_nombre || i.productoNombre || '').substring(0, 24);
      return `<tr>
        <td style="${TD_BASE}text-align:center;width:28px;">${cant}</td>
        <td style="${TD_BASE}text-align:left;word-break:break-word;">${nom}</td>
        <td style="${TD_BASE}text-align:right;width:55px;">$${prec.toFixed(2)}</td>
        <td style="${TD_BASE}text-align:right;width:58px;">$${sub.toFixed(2)}</td>
      </tr>`;
    }).join('');

    return `
<div style="text-align:center;margin-bottom:6px;padding-top:2px;">
  <span style="font-size:15px;font-weight:800;text-transform:uppercase;display:block;letter-spacing:0.5px;color:#0f172a;">BESTEDA 2, C.A.</span>
  <span style="font-size:11px;font-weight:700;display:block;margin-top:2px;">RIF: J-40529263-6</span>
  <span style="font-size:9.5px;color:#334155;display:block;margin-top:2px;line-height:1.25;">Calle Principal Casa Nº A-13, Urb. Alto de Fenix II</span>
  <span style="font-size:9.5px;color:#334155;display:block;line-height:1.25;">San Juan de los Morros - Estado Guárico</span>
  <span style="font-size:9.5px;color:#334155;display:block;line-height:1.25;">Tlfs: 0424-313.68.05 / 0424-300.48.02</span>
</div>

<div style="border-top:2px solid #000;margin:6px 0;"></div>
<div style="text-align:center;font-weight:800;font-size:12px;letter-spacing:0.8px;padding:2px 0;text-transform:uppercase;">NOTA DE ENTREGA</div>
<div style="text-align:center;font-weight:800;font-size:13px;color:#dc2626;margin-bottom:4px;">Nº ${data.factura_number || ''}</div>
<div style="border-top:1px dashed #94a3b8;margin:5px 0;"></div>

<div style="padding:0 2px;">
  <div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:3px;gap:4px;">
    <span style="font-weight:700;white-space:nowrap;color:#1e293b;">FECHA:</span>
    <span style="text-align:right;font-weight:500;">${data.fecha || ''}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:3px;gap:4px;">
    <span style="font-weight:700;white-space:nowrap;color:#1e293b;">CLIENTE:</span>
    <span style="text-align:right;font-weight:600;">${data.cliente_name || ''}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:3px;gap:4px;">
    <span style="font-weight:700;white-space:nowrap;color:#1e293b;">C.I./RIF:</span>
    <span style="text-align:right;font-weight:500;">${data.cedula_rif || 'N/A'}</span>
  </div>
  ${data.telefono ? `<div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:3px;gap:4px;"><span style="font-weight:700;color:#1e293b;">TELF:</span><span style="text-align:right;">${data.telefono}</span></div>` : ''}
  ${data.direccion ? `<div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:3px;gap:4px;"><span style="font-weight:700;color:#1e293b;">DIR:</span><span style="text-align:right;word-break:break-word;">${data.direccion}</span></div>` : ''}
</div>

<div style="border-top:1px dashed #94a3b8;margin:6px 0;"></div>

<table style="${TBL}">
  <thead>
    <tr>
      <th style="${TH_BASE}text-align:center;width:28px;">CAN</th>
      <th style="${TH_BASE}text-align:left;">DESCRIPCIÓN</th>
      <th style="${TH_BASE}text-align:right;width:55px;">P/U</th>
      <th style="${TH_BASE}text-align:right;width:58px;">TOTAL</th>
    </tr>
  </thead>
  <tbody>${filas}</tbody>
</table>

<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;border-top:2px solid #000;padding-top:6px;margin-top:4px;">
  <span>UND: ${totalUnits}</span>
  <span>TOTAL: $${totalUSD.toFixed(2)}</span>
</div>

<div style="margin-top:10px;font-size:9px;line-height:1.5;border:1px solid #cbd5e1;border-radius:4px;padding:6px;background:#f8fafc;">
  <span style="font-weight:800;text-align:center;display:block;color:#0f172a;margin-bottom:2px;">— PAGO MÓVIL BDV —</span>
  0102 | 0424 3136805 | C.I. 10668263<br>
  0102 | 0424 3004802 | C.I. 28012615
  <span style="font-weight:800;text-align:center;display:block;margin-top:5px;color:#0f172a;margin-bottom:2px;">— DEPÓSITO BANCARIO BDV —</span>
  01020467450101628166 (JUAN MORA)<br>
  01020467450000967787 (JORGE FLORES)
</div>

<div style="margin-top:24px;text-align:center;font-size:9.5px;border-top:1px solid #000;padding-top:4px;width:70%;margin-left:auto;margin-right:auto;">
  Firma del Cliente
</div>`;
  }

  // ── Documento HTML completo del ticket (para iframe — CSS aislado, sin conflictos) ──
  function getTicketDoc(data) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 76mm;
    margin: 0 auto;
    padding: 2mm 1.5mm 4mm 2mm;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 11px;
    color: #0f172a;
    line-height: 1.35;
    background: #fff;
    -webkit-print-color-adjust: exact;
  }
  table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 3px 0; }
</style>
</head>
<body>${generateTicketHTML(data)}</body>
</html>`;
  }

  // ── Vista previa en modal usando iframe (100% aislado de main.css) ────────
  function renderTicketPreview(data) {
    currentTicketData = data;
    ticketPreviewArea.innerHTML = '';                   // limpiar

    const iframe = document.createElement('iframe');
    iframe.id    = 'ticketIframe';
    iframe.scrolling = 'no';
    iframe.style.cssText = [
      'display:block',
      'border:none',
      'width:302px',          // ≈ 80mm a 96dpi
      'min-height:500px',
      'background:#fff',
      'box-shadow:0 4px 20px rgba(0,0,0,.18)',
      'margin:0 auto'
    ].join(';');

    ticketPreviewArea.appendChild(iframe);

    // Escribir el documento dentro del iframe
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(getTicketDoc(data));
    doc.close();

    // Ajustar altura al contenido real una vez cargado
    iframe.onload = () => {
      try {
        const h = iframe.contentDocument.body.scrollHeight;
        iframe.style.height = (h + 16) + 'px';
        iframe.style.minHeight = '0';
      } catch(e) { /* cross-origin guard */ }
    };
  }

  // ── Imprimir desde el iframe — sin abrir ninguna ventana nueva ────────────
  function printFromIframe() {
    const iframe = document.getElementById('ticketIframe');
    if (!iframe) return;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }

  document.getElementById('btnPrintTicketTrigger')?.addEventListener('click', printFromIframe);


  // ── Reimprimir desde tabla ────────────────────────────────────────────────
  async function openTicketById(id) {
    const r = await API.get(`api/salidas.php?id=${id}`);
    if (r.success && r.data) {
      renderTicketPreview(r.data);
      modalTicket.classList.add('active');
    }
  }

  // ── Abono con Conversión Bidireccional Automática (USD <-> VES) ───────────
  const abonoUSDInp = document.getElementById('abonoSalMontoUSD');
  const abonoVESInp = document.getElementById('abonoSalMontoVES');
  const abonoHelperUSD = document.getElementById('abonoHelperUSD');
  const abonoHelperVES = document.getElementById('abonoHelperVES');
  const abonoBCVRateDisplay = document.getElementById('abonoBCVDisplayRate');

  function getActiveRate() {
    return window.BCV_RATE?.tasaHoy || 794.99;
  }

  function updateAbonoRateBadge() {
    const rate = getActiveRate();
    if (abonoBCVRateDisplay) abonoBCVRateDisplay.textContent = `Bs. ${rate.toFixed(2)} / $`;
  }

  // Al escribir en USD -> calcular VES automáticamente
  abonoUSDInp?.addEventListener('input', () => {
    const rate = getActiveRate();
    const usd = parseNum(abonoUSDInp.value);
    if (usd > 0) {
      const ves = (usd * rate).toFixed(2);
      if (document.activeElement === abonoUSDInp) {
        abonoVESInp.value = ves;
      }
      if (abonoHelperUSD) abonoHelperUSD.textContent = `= Bs. ${formatBs(ves)}`;
      if (abonoHelperVES) abonoHelperVES.textContent = `= $${usd.toFixed(2)} USD`;
    } else {
      if (document.activeElement === abonoUSDInp) abonoVESInp.value = '';
      if (abonoHelperUSD) abonoHelperUSD.textContent = '= Bs. 0.00';
      if (abonoHelperVES) abonoHelperVES.textContent = '= $0.00 USD';
    }
  });

  // Al escribir en VES -> calcular USD automáticamente
  abonoVESInp?.addEventListener('input', () => {
    const rate = getActiveRate();
    const ves = parseNum(abonoVESInp.value);
    if (ves > 0) {
      const usd = (ves / rate).toFixed(2);
      if (document.activeElement === abonoVESInp) {
        abonoUSDInp.value = usd;
      }
      if (abonoHelperVES) abonoHelperVES.textContent = `= $${usd} USD`;
      if (abonoHelperUSD) abonoHelperUSD.textContent = `= Bs. ${formatBs(ves)}`;
    } else {
      if (document.activeElement === abonoVESInp) abonoUSDInp.value = '';
      if (abonoHelperUSD) abonoHelperUSD.textContent = '= Bs. 0.00';
      if (abonoHelperVES) abonoHelperVES.textContent = '= $0.00 USD';
    }
  });

  function openAbonoModal(salidaId, clienteName, saldoPendienteUSD = 0) {
    document.getElementById('abonoSalidaForm').reset();
    document.getElementById('abonoClienteName').value = clienteName;
    document.getElementById('abonoSalidaId').value = salidaId;

    const headerName = document.getElementById('abonoClienteHeaderName');
    if (headerName) headerName.textContent = `Cliente: ${clienteName} | Saldo Pendiente: $${parseNum(saldoPendienteUSD).toFixed(2)} USD`;

    updateAbonoRateBadge();

    // Precargar saldo pendiente en USD y calcular equivalente en VES
    if (saldoPendienteUSD > 0) {
      abonoUSDInp.value = parseNum(saldoPendienteUSD).toFixed(2);
      abonoUSDInp.dispatchEvent(new Event('input'));
    }

    modalAbono.classList.add('active');
  }

  document.getElementById('abonoSalidaForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      salidaId:    document.getElementById('abonoSalidaId').value,
      clienteName: document.getElementById('abonoClienteName').value,
      montoUSD:    parseNum(document.getElementById('abonoSalMontoUSD').value),
      montoVES:    parseNum(document.getElementById('abonoSalMontoVES').value),
      referencia:  document.getElementById('abonoSalRef').value,
      fecha:       document.getElementById('abonoSalFecha').value
    };

    if (payload.montoUSD <= 0) {
      alert('Ingresa un monto válido para el abono.');
      return;
    }

    const r = await API.post('api/abonos_salidas.php', payload);
    if (r.success) {
      modalAbono.classList.remove('active');
      await loadSalidas();
    } else {
      alert('Error al registrar abono: ' + (r.error || 'Error desconocido'));
    }
  });

  // ── MÓDULO DE ESTADO DE CUENTA POR CLIENTE ────────────────────────────────
  const modalEstadoCuenta = document.getElementById('modalEstadoCuentaCliente');
  const btnOpenEstadoCuenta = document.getElementById('btnOpenEstadoCuentaModal');
  const btnCloseEstadoCuenta = document.getElementById('btnCloseEstadoCuentaModal');
  const selectClienteEstadoCuenta = document.getElementById('selectEstadoCuentaCliente');
  const btnRefreshEstadoCuenta = document.getElementById('btnRefreshEstadoCuenta');
  const printableAreaEstadoCuenta = document.getElementById('estadoCuentaPrintableArea');
  const btnPrintEstadoCuentaDoc = document.getElementById('btnPrintEstadoCuentaDoc');
  const btnShareWhatsAppEC = document.getElementById('btnShareWhatsAppEstadoCuenta');

  let currentEstadoCuentaData = null;

  btnOpenEstadoCuenta?.addEventListener('click', async () => {
    modalEstadoCuenta.classList.add('active');
    await populateClientesDropdown();
    if (selectClienteEstadoCuenta && selectClienteEstadoCuenta.options.length > 1) {
      selectClienteEstadoCuenta.selectedIndex = 1;
      const firstVal = selectClienteEstadoCuenta.value;
      if (firstVal) await loadAndRenderEstadoCuenta(firstVal);
    }
  });

  btnCloseEstadoCuenta?.addEventListener('click', () => modalEstadoCuenta.classList.remove('active'));

  async function populateClientesDropdown(targetCliente = '') {
    if (!selectClienteEstadoCuenta) return;
    try {
      const res = await API.get('api/salidas.php?action=clientes');
      if (res.success && res.data && res.data.length > 0) {
        selectClienteEstadoCuenta.innerHTML = '<option value="">-- Seleccionar Cliente --</option>' +
          res.data.map(c => {
            const deudaUSD = parseFloat(c.saldo_pendiente_usd) || 0;
            const badge = deudaUSD > 0 ? ` (Deuda: $${deudaUSD.toFixed(2)})` : ' (Al día)';
            return `<option value="${c.cliente_name.replace(/"/g, '&quot;')}">${c.cliente_name}${badge}</option>`;
          }).join('');

        if (targetCliente) {
          const opts = Array.from(selectClienteEstadoCuenta.options);
          const match = opts.find(o => o.value.trim().toLowerCase() === targetCliente.trim().toLowerCase());
          if (match) selectClienteEstadoCuenta.value = match.value;
        }
      } else {
        selectClienteEstadoCuenta.innerHTML = '<option value="">No hay clientes registrados</option>';
      }
    } catch (e) {
      console.warn('Error cargando lista de clientes:', e);
    }
  }

  selectClienteEstadoCuenta?.addEventListener('change', async () => {
    const clienteName = selectClienteEstadoCuenta.value;
    if (clienteName) {
      await loadAndRenderEstadoCuenta(clienteName);
    }
  });

  btnRefreshEstadoCuenta?.addEventListener('click', async () => {
    const curVal = selectClienteEstadoCuenta.value;
    await populateClientesDropdown(curVal);
    if (selectClienteEstadoCuenta.value) await loadAndRenderEstadoCuenta(selectClienteEstadoCuenta.value);
  });

  async function loadAndRenderEstadoCuenta(clienteName) {
    if (!clienteName) return;
    printableAreaEstadoCuenta.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando Estado de Cuenta...</div>';
    try {
      const res = await API.get(`api/salidas.php?action=estado_cuenta&cliente=${encodeURIComponent(clienteName.trim())}`);
      if (res.success && res.cliente) {
        currentEstadoCuentaData = res;
        renderEstadoCuentaHTML(res);
      } else {
        printableAreaEstadoCuenta.innerHTML = `<div style="text-align:center; color: #ef4444; padding: 2rem;"><i class="fa-solid fa-triangle-exclamation"></i> ${res.error || 'No se encontraron registros para este cliente.'}</div>`;
      }
    } catch (e) {
      console.error(e);
      printableAreaEstadoCuenta.innerHTML = '<div style="text-align:center; color: #ef4444; padding: 2rem;"><i class="fa-solid fa-triangle-exclamation"></i> Error al conectar con el servidor.</div>';
    }
  }

  const selectFiltroEstadoCuenta = document.getElementById('selectEstadoCuentaFiltro');
  selectFiltroEstadoCuenta?.addEventListener('change', () => {
    if (currentEstadoCuentaData) {
      renderEstadoCuentaHTML(currentEstadoCuentaData);
    }
  });

  function renderEstadoCuentaHTML(res) {
    const filterType = selectFiltroEstadoCuenta?.value || 'todas';
    const c = res.cliente;
    const t = res.totales;
    const allSalidas = res.salidas || [];
    const abonos = res.abonos || [];

    // Filtrar salidas según la selección (Todas, Pendientes, Pagadas)
    let salidas = allSalidas;
    let filterBadge = '';
    let sectionTitle = 'Historial Completo de Notas de Entrega / Compras';

    if (filterType === 'pendientes') {
      salidas = allSalidas.filter(s => (parseFloat(s.saldo_adeudado) || 0) > 0);
      filterBadge = '<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; margin-left:6px;">FILTRADO: SOLO PENDIENTES</span>';
      sectionTitle = 'Notas de Entrega PENDIENTES (Por Cobrar)';
    } else if (filterType === 'pagadas') {
      salidas = allSalidas.filter(s => (parseFloat(s.saldo_adeudado) || 0) === 0);
      filterBadge = '<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; margin-left:6px;">FILTRADO: SOLO PAGADAS</span>';
      sectionTitle = 'Notas de Entrega PAGADAS (Historial al Día)';
    }

    // Recalcular totales según las notas filtradas
    const calcTotalComprasUSD = salidas.reduce((a, b) => a + (parseFloat(b.total_factura) || 0), 0);
    const calcSaldoUSD = salidas.reduce((a, b) => a + (parseFloat(b.saldo_adeudado) || 0), 0);
    const calcAbonadoUSD = Math.max(0, calcTotalComprasUSD - calcSaldoUSD);

    const calcTotalComprasVES = calcTotalComprasUSD * t.tasa_bcv;
    const calcAbonadoVES = calcAbonadoUSD * t.tasa_bcv;
    const calcSaldoVES = calcSaldoUSD * t.tasa_bcv;

    const saldoColor = calcSaldoUSD > 0 ? '#dc2626' : '#16a34a';
    const statusText = calcSaldoUSD > 0 ? '🔴 SALDO PENDIENTE' : '✅ AL DÍA (SIN DEUDA)';

    let salidasRows = salidas.map(s => {
      const saldo = parseFloat(s.saldo_adeudado) || 0;
      const stBadge = saldo > 0 ? '<span style="color:#b91c1c; font-weight:700;">Pendiente</span>' : '<span style="color:#15803d; font-weight:700;">Pagado</span>';
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.82rem;">
          <td style="padding: 6px 8px;">${s.fecha || ''}</td>
          <td style="padding: 6px 8px; font-weight: 700;">${s.tipo_documento || 'NOTA DE ENTREGA'} Nº ${s.factura_number || ''}</td>
          <td style="padding: 6px 8px; text-align: right;">$${parseFloat(s.total_factura).toFixed(2)}</td>
          <td style="padding: 6px 8px; text-align: right; color: #15803d;">$${(parseFloat(s.total_factura) - saldo).toFixed(2)}</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: ${saldo > 0 ? '#b91c1c' : '#15803d'};">$${saldo.toFixed(2)}</td>
          <td style="padding: 6px 8px; text-align: center;">${stBadge}</td>
        </tr>
      `;
    }).join('');

    let abonosRows = abonos.map(a => {
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.82rem;">
          <td style="padding: 6px 8px;">${a.fecha || ''}</td>
          <td style="padding: 6px 8px;">Nota Nº ${a.factura_number || 'General'}</td>
          <td style="padding: 6px 8px;">${a.referencia || 'Efectivo / Transferencia'}</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #166534;">$${parseFloat(a.monto_usd).toFixed(2)}</td>
          <td style="padding: 6px 8px; text-align: right; color: #0284c7;">Bs. ${formatBs(a.monto_ves)}</td>
        </tr>
      `;
    }).join('');

    printableAreaEstadoCuenta.innerHTML = `
      <div id="estadoCuentaDocument" style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 0.5rem;">
        <!-- Encabezado de Empresa -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 0.75rem; margin-bottom: 1rem;">
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0;">BESTEDA 2, C.A.</h2>
            <p style="font-size: 0.8rem; font-weight: 700; color: #475569; margin: 2px 0 0 0;">RIF: J-40529263-6</p>
            <p style="font-size: 0.75rem; color: #64748b; margin: 2px 0 0 0;">San Juan de los Morros - Estado Guárico | Tlfs: 0424-313.68.05</p>
          </div>
          <div style="text-align: right;">
            <span style="background: #0f172a; color: #fff; padding: 4px 10px; border-radius: 4px; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.5px;">ESTADO DE CUENTA DE CLIENTE</span>
            <p style="font-size: 0.75rem; color: #64748b; margin-top: 6px;">Fecha Emisión: ${new Date().toLocaleDateString('es-VE')}</p>
          </div>
        </div>

        <!-- Ficha del Cliente -->
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 1rem; display: grid; grid-template-columns: 1.5fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
          <div>
            <div><span style="color: #64748b; font-weight: 600;">CLIENTE:</span> <strong>${c.name}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">C.I. / RIF:</span> <strong>${c.cedula_rif || 'N/A'}</strong></div>
          </div>
          <div>
            <div><span style="color: #64748b; font-weight: 600;">TELÉFONO:</span> <strong>${c.telefono || 'N/A'}</strong></div>
            <div><span style="color: #64748b; font-weight: 600;">DIRECCIÓN:</span> <strong>${c.direccion || 'N/A'}</strong></div>
          </div>
        </div>

        <!-- Banner de Deuda Resumen -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 0.75rem; margin-bottom: 1.25rem;">
          <div style="background: #f1f5f9; padding: 0.75rem; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0;">
            <span style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Compras</span>
            <div style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">$${calcTotalComprasUSD.toFixed(2)}</div>
            <div style="font-size: 0.73rem; color: #64748b;">Bs. ${formatBs(calcTotalComprasVES)}</div>
          </div>
          <div style="background: #f0fdf4; padding: 0.75rem; border-radius: 6px; text-align: center; border: 1px solid #bbf7d0;">
            <span style="font-size: 0.75rem; color: #166534; font-weight: 700; text-transform: uppercase;">Total Abonado</span>
            <div style="font-size: 1.15rem; font-weight: 800; color: #15803d;">$${calcAbonadoUSD.toFixed(2)}</div>
            <div style="font-size: 0.73rem; color: #166534;">Bs. ${formatBs(calcAbonadoVES)}</div>
          </div>
          <div style="background: ${calcSaldoUSD > 0 ? '#fef2f2' : '#f0fdf4'}; padding: 0.75rem; border-radius: 6px; text-align: center; border: 2px solid ${saldoColor};">
            <span style="font-size: 0.75rem; color: ${saldoColor}; font-weight: 800; text-transform: uppercase;">${statusText}</span>
            <div style="font-size: 1.3rem; font-weight: 800; color: ${saldoColor};">$${calcSaldoUSD.toFixed(2)} USD</div>
            <div style="font-size: 0.8rem; font-weight: 700; color: ${saldoColor};">Bs. ${formatBs(calcSaldoVES)}</div>
            <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">Tasa BCV Ref: Bs. ${t.tasa_bcv.toFixed(2)}/$</div>
          </div>
        </div>

        <!-- Tabla de Notas de Entrega / Despachos -->
        <h4 style="font-size: 0.88rem; font-weight: 700; color: #0f172a; margin-bottom: 0.4rem; text-transform: uppercase; display: flex; align-items: center;">
          <i class="fa-solid fa-list" style="margin-right:6px;"></i> ${sectionTitle} ${filterBadge}
        </h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.25rem; background: #fff;">
          <thead>
            <tr style="background: #f1f5f9; font-size: 0.75rem; color: #475569; text-transform: uppercase;">
              <th style="padding: 6px 8px; text-align: left;">Fecha</th>
              <th style="padding: 6px 8px; text-align: left;">Documento</th>
              <th style="padding: 6px 8px; text-align: right;">Total USD</th>
              <th style="padding: 6px 8px; text-align: right;">Abonado USD</th>
              <th style="padding: 6px 8px; text-align: right;">Saldo Pend.</th>
              <th style="padding: 6px 8px; text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${salidasRows || '<tr><td colspan="6" style="text-align:center; padding: 1rem; color:#94a3b8;">No se encontraron notas con la opción seleccionada.</td></tr>'}
          </tbody>
        </table>

        <!-- Tabla de Abonos Realizados -->
        <h4 style="font-size: 0.88rem; font-weight: 700; color: #0f172a; margin-bottom: 0.4rem; text-transform: uppercase;">
          <i class="fa-solid fa-receipt"></i> Historial de Abonos / Pagos Recibidos
        </h4>
        <table style="width: 100%; border-collapse: collapse; background: #fff;">
          <thead>
            <tr style="background: #f1f5f9; font-size: 0.75rem; color: #475569; text-transform: uppercase;">
              <th style="padding: 6px 8px; text-align: left;">Fecha Pago</th>
              <th style="padding: 6px 8px; text-align: left;">Nota Afectada</th>
              <th style="padding: 6px 8px; text-align: left;">Referencia / Método</th>
              <th style="padding: 6px 8px; text-align: right;">Monto USD</th>
              <th style="padding: 6px 8px; text-align: right;">Monto VES</th>
            </tr>
          </thead>
          <tbody>
            ${abonosRows || '<tr><td colspan="5" style="text-align:center; padding: 1rem; color:#94a3b8;">No ha realizado abonos aún.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Generar y Descargar PDF para WhatsApp con 1 Clic ─────────────────────
  const btnDownloadPDF = document.getElementById('btnDownloadPDFEstadoCuenta');
  btnDownloadPDF?.addEventListener('click', () => {
    const docEl = document.getElementById('estadoCuentaDocument');
    if (!docEl) {
      alert('Por favor selecciona un cliente primero.');
      return;
    }

    const clienteName = currentEstadoCuentaData?.cliente?.name || 'Cliente';
    const cleanName = clienteName.replace(/[^a-zA-Z0-9]/g, '_');

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Estado_de_Cuenta_${cleanName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      btnDownloadPDF.disabled = true;
      btnDownloadPDF.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando PDF...';

      html2pdf().set(opt).from(docEl).save().then(() => {
        btnDownloadPDF.disabled = false;
        btnDownloadPDF.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Exportar a PDF';
      }).catch(err => {
        btnDownloadPDF.disabled = false;
        btnDownloadPDF.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Exportar a PDF';
        window.print();
      });
    } else {
      window.print();
    }
  });

  // Imprimir / Guardar PDF del Estado de Cuenta (vía iframe aislado sin bloqueo de ventanas)
  btnPrintEstadoCuentaDoc?.addEventListener('click', () => {
    const docEl = document.getElementById('estadoCuentaDocument');
    if (!docEl) {
      alert('Selecciona un cliente primero.');
      return;
    }

    let iframe = document.getElementById('estadoCuentaPrintIframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'estadoCuentaPrintIframe';
      iframe.style.cssText = 'position:fixed; top:-9999px; left:-9999px; width:0; height:0; border:none;';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Estado de Cuenta - ${currentEstadoCuentaData?.cliente?.name || 'Cliente'}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #fff; color: #000; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #cbd5e1; padding: 6px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${docEl.outerHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  });

  init();
});
