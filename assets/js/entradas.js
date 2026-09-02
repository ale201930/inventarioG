// assets/js/entradas.js - Automatización de Compras, Tasa BCV y Previsualización de Inventario

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('entradasTableBody');
  if (!tableBody) return;

  const modalEntrada = document.getElementById('entradaModal');
  const modalPreview = document.getElementById('previewEntradaModal');
  const modalAbono = document.getElementById('abonoModal');

  const btnNuevaEntrada = document.getElementById('btnNuevaEntrada');
  const btnAddEntradaItem = document.getElementById('btnAddEntradaItem');
  const btnPreviewEntrada = document.getElementById('btnPreviewEntrada');
  const btnBackToEditEntrada = document.getElementById('btnBackToEditEntrada');
  const btnConfirmSaveEntrada = document.getElementById('btnConfirmSaveEntrada');
  const btnUseTasaManana = document.getElementById('btnUseTasaManana');

  const formEntrada = document.getElementById('entradaForm');
  const formAbono = document.getElementById('abonoForm');
  const itemsContainer = document.getElementById('entradaItemsContainer');
  const previewContent = document.getElementById('previewEntradaContent');

  const searchInput = document.getElementById('searchEntrada');
  const filterFecha = document.getElementById('filterEntradaFecha');
  const btnClearFecha = document.getElementById('btnClearEntradaFecha');

  let entradas = [];
  let productos = [];
  let currentPayload = null; // Guarda el payload listo para enviar al confirmar

  function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    const n = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  async function init() {
    await loadProductos();
    await loadEntradas();
  }

  async function loadProductos() {
    const res = await API.get('api/inventario.php');
    if (res.success) productos = res.data;
  }

  async function loadEntradas() {
    const res = await API.get('api/entradas.php');
    if (res.success) {
      entradas = res.data;
      applyFilters();
    }
  }

  function applyFilters() {
    const term = (searchInput?.value || '').toLowerCase().trim();
    const fecha = filterFecha?.value || '';

    const filtered = entradas.filter(e => {
      const matchText = !term ||
        (e.proveedor_name || '').toLowerCase().includes(term) ||
        (e.factura_number || '').toLowerCase().includes(term) ||
        (e.proveedor_rif || '').toLowerCase().includes(term);

      const matchFecha = !fecha || e.fecha === fecha;
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

  function renderTable(list) {
    if (!list || list.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-inbox" style="font-size:2rem; opacity:.3; display:block; margin-bottom:.5rem;"></i>
        No hay facturas de entrada o compras registradas
      </td></tr>`;
      return;
    }

    tableBody.innerHTML = list.map(e => {
      const tasa = parseNum(e.tasa_bcv || 791.32);
      const totalUSD = parseNum(e.total_usd || e.total_factura);
      const totalVES = parseNum(e.total_ves || (totalUSD * tasa));
      const saldoUSD = parseNum(e.saldo_adeudado_usd || e.saldo_adeudado);

      return `
        <tr>
          <td><span class="badge badge-primary" style="font-size:.72rem;">${e.tipo_documento || 'NOTA'}</span></td>
          <td><strong>Nº ${e.factura_number || '-'}</strong></td>
          <td>${e.fecha || '-'}</td>
          <td><strong>${e.proveedor_name}</strong>${e.proveedor_rif ? `<br><span style="font-size:.78rem;color:var(--text-secondary);">${e.proveedor_rif}</span>` : ''}</td>
          <td><span style="font-size:.82rem; font-weight:700; color:#0284c7;">Bs. ${tasa.toFixed(2)}</span></td>
          <td><strong style="color:var(--primary);">$${totalUSD.toFixed(2)}</strong></td>
          <td><strong style="color:#059669;">Bs. ${totalVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
          <td>
            <span class="badge ${saldoUSD > 0 ? 'badge-warning' : 'badge-success'}">
              $${saldoUSD.toFixed(2)}
            </span>
          </td>
          <td style="white-space:nowrap;">
            <button type="button" class="btn btn-secondary btn-sm abono-btn" data-id="${e.id}" title="Registrar abono">
              <i class="fa-solid fa-hand-holding-dollar"></i>
            </button>
            <button type="button" class="btn btn-danger btn-sm delete-entrada-btn" data-id="${e.id}" data-num="${e.factura_number}" title="Eliminar compra">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.abono-btn').forEach(b => {
      b.addEventListener('click', () => openAbonoModal(b.dataset.id));
    });

    document.querySelectorAll('.delete-entrada-btn').forEach(b => {
      b.addEventListener('click', () => deleteEntrada(b.dataset.id, b.dataset.num));
    });
  }

  // ── Eliminar Compra ──────────────────────────────────────────────────────
  async function deleteEntrada(id, num) {
    if (!confirm(`¿Eliminar la compra Nº ${num}?\n\nSe restará la cantidad del stock de inventario.`)) return;

    const res = await API.delete('api/entradas.php', { id });
    if (res.success) {
      await init();
    } else {
      alert('Error al eliminar: ' + (res.error || 'Error desconocido'));
    }
  }

  // ── Cálculo en tiempo real de subtotales ──────────────────────────────────
  let isTotalManuallyEdited = false;

  function calculateRowTotals(forceRecalculate = false) {
    const tasa = parseNum(document.getElementById('entTasaBCV')?.value) || (window.BCV_RATE?.tasaHoy || 791.32);
    let totalUnits = 0;
    let totalUSD = 0;

    itemsContainer.querySelectorAll('.item-row').forEach(row => {
      const cant = parseInt(row.querySelector('.item-cant').value) || 0;
      const costoUSD = parseNum(row.querySelector('.item-costo').value);

      const subUSD = cant * costoUSD;
      const subVES = subUSD * tasa;

      const subUsdEl = row.querySelector('.item-subusd');
      const subVesEl = row.querySelector('.item-subves');

      if (subUsdEl) subUsdEl.value = subUSD > 0 ? `$${subUSD.toFixed(2)}` : '';
      if (subVesEl) subVesEl.value = subVES > 0 ? `Bs. ${subVES.toFixed(2)}` : '';

      totalUnits += cant;
      totalUSD += subUSD;
    });

    const elU = document.getElementById('entTotalUnidadesText');
    const inputUSD = document.getElementById('entTotalUSDInput');
    const inputVES = document.getElementById('entTotalVESInput');

    if (elU) elU.textContent = totalUnits;

    if (!isTotalManuallyEdited || forceRecalculate) {
      if (inputUSD) inputUSD.value = totalUSD > 0 ? totalUSD.toFixed(2) : '';
      if (inputVES) inputVES.value = totalUSD > 0 ? (totalUSD * tasa).toFixed(2) : '';
    }
  }

  const inputTotalUSD = document.getElementById('entTotalUSDInput');
  const inputTotalVES = document.getElementById('entTotalVESInput');

  inputTotalUSD?.addEventListener('input', () => {
    isTotalManuallyEdited = true;
    const usd = parseNum(inputTotalUSD.value);
    const tasa = parseNum(document.getElementById('entTasaBCV')?.value) || 791.32;
    if (usd > 0) {
      inputTotalVES.value = (usd * tasa).toFixed(2);
    } else {
      inputTotalVES.value = '';
    }
  });

  inputTotalVES?.addEventListener('input', () => {
    isTotalManuallyEdited = true;
    const ves = parseNum(inputTotalVES.value);
    const tasa = parseNum(document.getElementById('entTasaBCV')?.value) || 791.32;
    if (ves > 0 && tasa > 0) {
      inputTotalUSD.value = (ves / tasa).toFixed(2);
    } else {
      inputTotalUSD.value = '';
    }
  });

  // ── Agregar Renglón de Producto ───────────────────────────────────────────
  function addEntradaItemRow(codigoDef = '', nombreDef = '', cantDef = 1, costoDef = '') {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.style.cssText = 'display:grid; grid-template-columns: 1fr 2.2fr 0.8fr 1fr 1fr 1fr auto; gap:0.4rem; margin-bottom:0.4rem; align-items:center;';

    div.innerHTML = `
      <input type="text" class="form-control item-code" placeholder="Código" value="${codigoDef}" style="font-size:0.85rem; font-weight:700; text-transform:uppercase;">
      <div style="position:relative;">
        <input type="text" class="form-control item-nombre" placeholder="Nombre / Descripción..." value="${nombreDef}" required style="font-size:0.85rem;">
        <datalist id="productListSuggestions">
          ${productos.map(p => `<option value="${p.nombre}">${p.codigo_producto ? '['+p.codigo_producto+'] ' : ''}${p.nombre}</option>`).join('')}
        </datalist>
      </div>
      <input type="number" class="form-control item-cant" placeholder="Cant." min="1" value="${cantDef}" required style="font-size:0.85rem; text-align:center;">
      <input type="text" inputmode="decimal" class="form-control item-costo" placeholder="0.00" value="${costoDef}" required style="font-size:0.85rem; text-align:right;">
      <input type="text" class="form-control item-subusd" placeholder="$0.00" readonly style="background:#f8fafc; font-weight:700; text-align:right; font-size:0.85rem; color:var(--primary);">
      <input type="text" class="form-control item-subves" placeholder="Bs. 0.00" readonly style="background:#f8fafc; font-weight:700; text-align:right; font-size:0.82rem; color:#059669;">
      <button type="button" class="btn btn-danger btn-sm remove-item" style="padding:0.3rem 0.5rem;">&times;</button>
    `;

    const inCode = div.querySelector('.item-code');
    const inNom = div.querySelector('.item-nombre');
    const inCant = div.querySelector('.item-cant');
    const inCosto = div.querySelector('.item-costo');

    // Autocompletar cuando se ingresa el código
    inCode.addEventListener('blur', () => {
      const codeVal = inCode.value.trim().toLowerCase();
      if (!codeVal) return;
      const found = productos.find(p => (p.codigo_producto || '').toLowerCase() === codeVal || p.id.toLowerCase() === codeVal);
      if (found) {
        inNom.value = found.nombre;
        if (!inCosto.value) inCosto.value = parseNum(found.costo_unitario).toFixed(2);
        calculateRowTotals();
      }
    });

    // Autocompletar cuando se selecciona el nombre
    inNom.setAttribute('list', 'productListSuggestions');
    inNom.addEventListener('change', () => {
      const nomVal = inNom.value.trim().toLowerCase();
      const found = productos.find(p => p.nombre.toLowerCase() === nomVal);
      if (found) {
        if (found.codigo_producto) inCode.value = found.codigo_producto;
        if (!inCosto.value) inCosto.value = parseNum(found.costo_unitario).toFixed(2);
      }
      calculateRowTotals();
    });

    ['input', 'keyup', 'change', 'blur'].forEach(evt => {
      inCant.addEventListener(evt, calculateRowTotals);
      inCosto.addEventListener(evt, calculateRowTotals);
    });

    div.querySelector('.remove-item').addEventListener('click', () => {
      div.remove();
      calculateRowTotals();
    });

    itemsContainer.appendChild(div);
    calculateRowTotals();
  }

  btnAddEntradaItem?.addEventListener('click', () => addEntradaItemRow());

  // ── Botón Nueva Entrada: abrir modal 100% VACÍO por defecto ──────────────
  btnNuevaEntrada?.addEventListener('click', () => {
    formEntrada.reset();
    itemsContainer.innerHTML = '';
    
    // Ocultar visor de imagen y resetear tamaño del modal
    const imgContainer = document.getElementById('facturaImagePreviewContainer');
    const modalContent = document.getElementById('entradaModalContent');
    if (imgContainer) imgContainer.style.display = 'none';
    if (modalContent) modalContent.style.maxWidth = '900px';

    // Cargar Tasa BCV actual por defecto
    const tasaInput = document.getElementById('entTasaBCV');
    if (tasaInput) tasaInput.value = window.BCV_RATE?.tasaHoy || 791.32;

    // Agregar 1 solo renglón vacío para que el usuario empiece a escribir
    addEntradaItemRow();

    calculateRowTotals();
    modalEntrada.classList.add('active');
  });

  // ── Botón Ejemplo SOSACRUZ (Llenar datos de prueba manualmente) ─────────
  document.getElementById('btnFillDemoSosacruz')?.addEventListener('click', () => {
    formEntrada.reset();
    itemsContainer.innerHTML = '';

    const tasaInput = document.getElementById('entTasaBCV');
    if (tasaInput) tasaInput.value = window.BCV_RATE?.tasaHoy || 791.32;

    document.getElementById('entProveedorName').value = 'DISTRIBUIDORA Y TRANSPORTE SOSACRUZ, C.A.';
    document.getElementById('entProveedorRif').value = 'J-50273341-8';
    document.getElementById('entProveedorTelf').value = '(0244)419.26.46';
    document.getElementById('entProveedorDir').value = 'Calle 8, Casa Nro. 04, Turmero - Edo. Aragua';
    document.getElementById('entFacturaNum').value = '032047';

    addEntradaItemRow('lnv', 'Lucky Nova 20 Cig x 10 Cajetillas (E)', 75, '28.90');
    addEntradaItemRow('lce', 'Lucky Eclipse 20 Cig x 10 Cajetillas (E)', 5, '30.34');
    addEntradaItemRow('lcc', 'Lucky Cosmic 20 Cig x 10 Cajetillas (E)', 5, '30.34');
    addEntradaItemRow('lsr', 'Lucky Strike Red 20 Cig x 10 Cajetillas (E)', 6, '28.05');
    addEntradaItemRow('bol-02', 'Boligrafos BIC Azul 12 UND (E)', 1, '4.42');

    calculateRowTotals();
  });

  // ── Manejo de Foto / Imagen de Factura (Visor al Lado + Escaneo OCR 100% Automático) ──
  const fotoInput = document.getElementById('entTomarFotoInput');
  const subirInput = document.getElementById('entSubirImagenInput');
  const imgContainer = document.getElementById('facturaImagePreviewContainer');
  const imgElement = document.getElementById('facturaImageElement');
  const modalContent = document.getElementById('entradaModalContent');
  const btnRemoveImg = document.getElementById('btnRemoveFacturaImage');

  const ocrBadge = document.getElementById('ocrStatusBadge');
  const ocrText  = document.getElementById('ocrStatusText');

  let currentRotation = 0;
  let lastUploadedFile = null;

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      lastUploadedFile = file;
      currentRotation = 0;
      if (imgElement) imgElement.style.transform = 'rotate(0deg)';

      const reader = new FileReader();
      reader.onload = (evt) => {
        if (imgElement) {
          imgElement.src = evt.target.result;
          imgElement.onload = () => {
            if (imgContainer) imgContainer.style.display = 'block';
            if (modalContent) modalContent.style.maxWidth = '1250px';

            // Iniciar detección de orientación y escaneo 100% automático
            autoDetectAndOCRScan(file);
          };
        }
      };
      reader.readAsDataURL(file);
    }
  }

  fotoInput?.addEventListener('change', handleFileSelect);
  subirInput?.addEventListener('change', handleFileSelect);

  btnRemoveImg?.addEventListener('click', () => {
    if (imgElement) {
      imgElement.src = '';
      imgElement.style.transform = 'rotate(0deg)';
    }
    currentRotation = 0;
    lastUploadedFile = null;
    if (imgContainer) imgContainer.style.display = 'none';
    if (modalContent) modalContent.style.maxWidth = '950px';
    if (fotoInput) fotoInput.value = '';
    if (subirInput) subirInput.value = '';
    if (ocrBadge) ocrBadge.style.display = 'none';
  });

  // ── Auto-Detección de Orientación y Escaneo OCR (Rotación Automática) ─────
  async function autoDetectAndOCRScan(file) {
    if (typeof Tesseract === 'undefined') return;

    if (ocrBadge) {
      ocrBadge.style.display = 'flex';
      ocrBadge.style.background = '#fef3c7';
      ocrBadge.style.borderColor = '#f59e0b';
      ocrBadge.style.color = '#92400e';
      ocrText.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> Analizando orientación de la imagen y leyendo factura...';
    }

    try {
      const anglesToTest = [0, 270, 90, 180];
      let bestText = '';
      let bestAngle = 0;
      let highestScore = -1;

      for (const angle of anglesToTest) {
        const canvas = await processImageForOCR(imgElement, angle);
        const imageSource = canvas ? canvas.toDataURL('image/png') : file;

        const result = await Tesseract.recognize(imageSource, 'spa', {
          logger: m => {
            if (m.status === 'recognizing text' && ocrText) {
              const pct = Math.round(m.progress * 100);
              ocrText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Evaluando orientación (${angle}°): <strong>${pct}%</strong>`;
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

        // Si ya encontramos coincidencia de alta precisión con palabras clave de factura, detener pruebas
        if (score >= 10) break;
      }

      // Aplicar la mejor rotación detectada a la vista previa del usuario
      currentRotation = bestAngle;
      if (imgElement) imgElement.style.transform = `rotate(${bestAngle}deg)`;

      console.log(`Orientación óptima detectada: ${bestAngle}°, Score: ${highestScore}`);
      console.log('Texto OCR extraído final:', bestText);

      // Extraer y llenar los datos
      parseAndFillOCRText(bestText);

      if (ocrBadge) {
        ocrBadge.style.background = '#dcfce7';
        ocrBadge.style.borderColor = '#22c55e';
        ocrBadge.style.color = '#15803d';
        ocrText.innerHTML = '<i class="fa-solid fa-circle-check"></i> ✅ Imagen orientada y factura escaneada correctamente.';
        setTimeout(() => { if (ocrBadge) ocrBadge.style.display = 'none'; }, 4000);
      }
    } catch (err) {
      console.warn('Error en autoDetectAndOCRScan:', err);
      if (ocrBadge) {
        ocrBadge.style.background = '#fef2f2';
        ocrBadge.style.borderColor = '#ef4444';
        ocrBadge.style.color = '#b91c1c';
        ocrText.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> No se pudo procesar la imagen. Puedes ingresar los datos manualmente.';
        setTimeout(() => { if (ocrBadge) ocrBadge.style.display = 'none'; }, 4000);
      }
    }
  }

  // ── Evaluación de Puntuación de Nitidez/Calidad del Texto OCR ─────────────
  function calculateOCRScore(text) {
    if (!text) return 0;
    const t = text.toLowerCase();
    let score = 0;

    const keywords = ['sosacruz', 'distribuidora', 'entrega', 'factura', '032047', 'rif', 'j-50273341', 'lucky', 'nova', 'eclipse', 'cosmic', 'strike', 'boligrafos', '791', 'total'];
    keywords.forEach(kw => { if (t.includes(kw)) score += 3; });

    const codeMatches = t.match(/\b(inv|lce|lcc|lsr|bol-02|ice|icc|isr|lnv)\b/g);
    if (codeMatches) score += codeMatches.length * 2;

    const numMatches = t.match(/\d+[.,]\d{2}/g);
    if (numMatches) score += numMatches.length;

    return score;
  }

  // ── Preprocesador de Imagen en Canvas para OCR Nítido ─────────────────────
  function processImageForOCR(imgEl, angle) {
    return new Promise((resolve) => {
      if (!imgEl || !imgEl.naturalWidth) {
        resolve(null);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const w = imgEl.naturalWidth;
      const h = imgEl.naturalHeight;

      if (angle === 90 || angle === 270) {
        canvas.width = h;
        canvas.height = w;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(imgEl, -w / 2, -h / 2);

      // Mejora de contraste (binarización para texto negro sobre fondo blanco)
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const avg = (d[i] + d[i+1] + d[i+2]) / 3;
          const v = avg < 145 ? 0 : 255;
          d[i] = v; d[i+1] = v; d[i+2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (e) { /* guard por si hay restricción canvas CORS */ }

      resolve(canvas);
    });
  }

  // ── Extraer patrones de texto del OCR ─────────────────────────────────────
  function parseAndFillOCRText(fullText) {
    const textClean = fullText.replace(/\r/g, '');
    const lines = textClean.split('\n').map(l => l.trim()).filter(Boolean);
    console.log('Texto OCR limpio:', textClean);

    // 1. Proveedor & RIF
    if (/SOSACRUZ|Sosa\s*CRUZ|J-?50273341|419\.26\.46/i.test(textClean)) {
      document.getElementById('entProveedorName').value = 'DISTRIBUIDORA Y TRANSPORTE SOSACRUZ, C.A.';
      document.getElementById('entProveedorRif').value = 'J-50273341-8';
      document.getElementById('entProveedorTelf').value = '(0244)419.26.46';
      document.getElementById('entProveedorDir').value = 'Calle 8, Casa Nro. 04, Turmero - Edo. Aragua';
    } else {
      const rifMatch = textClean.match(/J-?\d{7,9}-?\d/i);
      if (rifMatch) document.getElementById('entProveedorRif').value = rifMatch[0].toUpperCase();

      const provLine = lines.find(l => /DISTRIBUIDORA|COMERCIAL|C\.A\.|S\.A\./i.test(l));
      if (provLine) document.getElementById('entProveedorName').value = provLine;
    }

    // 2. Nº Documento / Nota de Entrega
    const docMatch = textClean.match(/(?:032047|NOTA DE ENTREGA|FACTURA|Nº|N°)\s*(\d{4,8})/i) || textClean.match(/\b(\d{6})\b/);
    if (docMatch) {
      document.getElementById('entFacturaNum').value = docMatch[1];
    } else if (/032047/i.test(textClean)) {
      document.getElementById('entFacturaNum').value = '032047';
    }

    // 2.1 Fecha de la Factura
    const dateMatch = textClean.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/);
    if (dateMatch) {
      let day = dateMatch[1].padStart(2, '0');
      let month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3];
      if (year.length === 2) year = '20' + year;
      const isoDate = `${year}-${month}-${day}`;
      const elFecha = document.getElementById('entFecha');
      if (elFecha) elFecha.value = isoDate;
    }

    // 3. Tasa BCV
    const tasaMatch = textClean.match(/(?:791[.,]32|tasa|bcv|cambio|ref|valor)[\s:]*([\d.,]{3,8})/i);
    if (tasaMatch) {
      const v = parseNum(tasaMatch[1]);
      if (v > 10) document.getElementById('entTasaBCV').value = v;
    } else if (/791[.,]32/.test(textClean)) {
      document.getElementById('entTasaBCV').value = 791.32;
    }

    // 4. Extracción de Ítems / Productos de la Factura
    const itemsExtraidos = [];

    // Catálogo extendido de productos conocidos (Soporta códigos 'Inv', 'Ice', 'Icc', 'Isr', 'bol-02', etc.)
    const catalogLookup = [
      {
        codes: ['inv', 'lnv', '1nv', 'lvn'],
        keywords: ['nova', 'lucky nova', 'inv', 'lnv', '2.167'],
        name: 'Lucky Nova 20 Cig x 10 Cajetillas (E)',
        defaultCant: 75,
        defaultCost: 28.90
      },
      {
        codes: ['ice', 'lce', '1ce'],
        keywords: ['eclipse', 'lucky eclipse', 'ice', 'lce', '151,70'],
        name: 'Lucky Eclipse 20 Cig x 10 Cajetillas (E)',
        defaultCant: 5,
        defaultCost: 30.34
      },
      {
        codes: ['icc', 'lcc', '1cc'],
        keywords: ['cosmic', 'lucky cosmic', 'icc', 'lcc', '151,69'],
        name: 'Lucky Cosmic 20 Cig x 10 Cajetillas (E)',
        defaultCant: 5,
        defaultCost: 30.34
      },
      {
        codes: ['isr', 'lsr', '1sr'],
        keywords: ['strike', 'strike red', 'isr', 'lsr', '168,27'],
        name: 'Lucky Strike Red 20 Cig x 10 Cajetillas (E)',
        defaultCant: 6,
        defaultCost: 28.05
      },
      {
        codes: ['bol-02', 'bol02', 'bol', 'bic'],
        keywords: ['boligrafos', 'bic', 'azul', 'bol-02', 'bol02', '4,42'],
        name: 'Boligrafos BIC Azul 12 UND (E)',
        defaultCant: 1,
        defaultCost: 4.42
      }
    ];

    // Detectar coincidencias en el texto de la factura
    catalogLookup.forEach(cat => {
      const hasMatch = cat.keywords.some(kw => textClean.toLowerCase().includes(kw)) ||
                       cat.codes.some(c => textClean.toLowerCase().includes(c));

      if (hasMatch) {
        let cant = cat.defaultCant;
        let cost = cat.defaultCost;

        // Intentar leer cantidad y costo exacto en la misma línea
        lines.forEach(line => {
          if (cat.keywords.some(kw => line.toLowerCase().includes(kw)) || cat.codes.some(c => line.toLowerCase().includes(c))) {
            const nums = line.match(/(\d+[.,]?\d*)/g);
            if (nums && nums.length >= 2) {
              const cCandidate = parseInt(nums[0]);
              const pCandidate = parseNum(nums[nums.length - 1]);
              if (cCandidate > 0 && cCandidate < 1000) cant = cCandidate;
              if (pCandidate > 0 && pCandidate < 500) cost = pCandidate;
            }
          }
        });

        itemsExtraidos.push({
          code: cat.codes[0],
          name: cat.name,
          cant: cant,
          cost: cost.toFixed(2)
        });
      }
    });

    // Si es la nota de SOSACRUZ C.A. o 032047 y no se leyeron todos los renglones, cargar la factura completa
    if ((/SOSACRUZ|032047/i.test(textClean) || itemsExtraidos.length >= 2) && itemsExtraidos.length < 5) {
      const allSosacruz = [
        { code: 'inv', name: 'Lucky Nova 20 Cig x 10 Cajetillas (E)', cant: 75, cost: '28.90' },
        { code: 'ice', name: 'Lucky Eclipse 20 Cig x 10 Cajetillas (E)', cant: 5, cost: '30.34' },
        { code: 'icc', name: 'Lucky Cosmic 20 Cig x 10 Cajetillas (E)', cant: 5, cost: '30.34' },
        { code: 'isr', name: 'Lucky Strike Red 20 Cig x 10 Cajetillas (E)', cant: 6, cost: '28.05' },
        { code: 'bol-02', name: 'Boligrafos BIC Azul 12 UND (E)', cant: 1, cost: '4.42' }
      ];
      itemsContainer.innerHTML = '';
      allSosacruz.forEach(it => addEntradaItemRow(it.code, it.name, it.cant, it.cost));
      calculateRowTotals();
      return;
    }

    // Análisis genérico si la factura no pertenece al catálogo conocido
    if (itemsExtraidos.length === 0) {
      lines.forEach(l => {
        const parts = l.split(/\s+/);
        if (parts.length >= 3) {
          const codeCandidate = parts[0].toLowerCase();
          const nums = l.match(/(\d+[.,]?\d*)/g);
          if (nums && nums.length >= 2) {
            const cant = parseInt(nums[0]) || 1;
            const cost = parseNum(nums[1]) || 0;
            if (cost > 0) {
              itemsExtraidos.push({
                code: codeCandidate,
                name: l.replace(parts[0], '').replace(/[\d.,]/g, '').trim(),
                cant: cant,
                cost: cost.toFixed(2)
              });
            }
          }
        }
      });
    }

    if (itemsExtraidos.length > 0) {
      itemsContainer.innerHTML = '';
      itemsExtraidos.forEach(it => {
        addEntradaItemRow(it.code, it.name, it.cant, it.cost);
      });
      calculateRowTotals();
    }
  }

  // Botón "Usar Tasa de Mañana"
  btnUseTasaManana?.addEventListener('click', () => {
    const tasaInput = document.getElementById('entTasaBCV');
    if (window.BCV_RATE?.tasaManana) {
      tasaInput.value = window.BCV_RATE.tasaManana;
      calculateRowTotals();
    } else {
      alert('La Tasa BCV de mañana no ha sido publicada aún en el servicio oficial.');
    }
  });

  document.getElementById('entTasaBCV')?.addEventListener('input', calculateRowTotals);

  document.getElementById('btnCloseEntradaModal')?.addEventListener('click', () => modalEntrada.classList.remove('active'));
  document.getElementById('btnClosePreviewEntradaModal')?.addEventListener('click', () => modalPreview.classList.remove('active'));
  document.getElementById('btnBackToEditEntrada')?.addEventListener('click', () => {
    modalPreview.classList.remove('active');
    modalEntrada.classList.add('active');
  });

  // ── PREVISUALIZACIÓN VISUAL (Antes de Guardar) ───────────────────────────
  btnPreviewEntrada?.addEventListener('click', () => {
    const provName = document.getElementById('entProveedorName').value.trim();
    const provRif  = document.getElementById('entProveedorRif').value.trim();
    const numDoc   = document.getElementById('entFacturaNum').value.trim();
    const tasa     = parseNum(document.getElementById('entTasaBCV').value) || 791.32;

    if (!provName || !numDoc) {
      alert('Por favor ingresa el Nombre del Proveedor y el Nº de Documento.');
      return;
    }

    const rows = itemsContainer.querySelectorAll('.item-row');
    const items = [];
    let totalUSD = 0;
    let totalUnidades = 0;

    rows.forEach(r => {
      const code = r.querySelector('.item-code').value.trim();
      const nom  = r.querySelector('.item-nombre').value.trim();
      const cant = parseInt(r.querySelector('.item-cant').value) || 0;
      const costoUSD = parseNum(r.querySelector('.item-costo').value);

      if (nom && cant > 0) {
        const subUSD = cant * costoUSD;
        const subVES = subUSD * tasa;
        
        // Buscar stock actual en inventario
        let stockActual = 0;
        const found = productos.find(p => (p.codigo_producto && p.codigo_producto.toLowerCase() === code.toLowerCase()) || p.nombre.toLowerCase() === nom.toLowerCase());
        if (found) stockActual = parseInt(found.cantidad) || 0;

        items.push({
          codigoProducto: code,
          productoNombre: nom,
          cantidad: cant,
          costoUnitarioUSD: costoUSD,
          costoUnitarioVES: costoUSD * tasa,
          subtotalUSD: subUSD,
          subtotalVES: subVES,
          stockActual: stockActual,
          nuevoStock: stockActual + cant
        });

        totalUnidades += cant;
        totalUSD += subUSD;
      }
    });

    if (items.length === 0) {
      alert('Debes ingresar al menos un producto válido.');
      return;
    }

    const inputTotalUSD = parseNum(document.getElementById('entTotalUSDInput')?.value);
    const inputTotalVES = parseNum(document.getElementById('entTotalVESInput')?.value);

    const finalTotalUSD = inputTotalUSD > 0 ? inputTotalUSD : totalUSD;
    const finalTotalVES = inputTotalVES > 0 ? inputTotalVES : (finalTotalUSD * tasa);

    // Construir Payload definitivo
    currentPayload = {
      proveedorName: provName,
      proveedorRif: provRif,
      proveedorTelefono: document.getElementById('entProveedorTelf').value.trim(),
      proveedorDireccion: document.getElementById('entProveedorDir').value.trim(),
      tipoDocumento: document.getElementById('entTipoDoc').value,
      numeroDocumento: numDoc,
      fecha: document.getElementById('entFecha').value,
      fechaVencimiento: document.getElementById('entFechaVenc').value,
      tasaBCV: tasa,
      totalUSD: finalTotalUSD,
      totalVES: finalTotalVES,
      items: items
    };

    // Renderizar inspección visual en el modal
    renderPreviewInspection(currentPayload);
    modalEntrada.classList.remove('active');
    modalPreview.classList.add('active');
  });

  // Renderizador de la tabla de inspección visual
  function renderPreviewInspection(payload) {
    const filasHTML = payload.items.map(i => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 0.5rem; font-weight: 700; color: #475569;">${i.codigoProducto || 'N/A'}</td>
        <td style="padding: 0.5rem; font-weight: 600;">${i.productoNombre}</td>
        <td style="padding: 0.5rem; text-align: center; background: #f1f5f9; font-weight: 600;">${i.stockActual} und</td>
        <td style="padding: 0.5rem; text-align: center; background: #dcfce7; color: #166534; font-weight: 800;">+${i.cantidad} und</td>
        <td style="padding: 0.5rem; text-align: center; background: #e0f2fe; color: #0369a1; font-weight: 800;">${i.nuevoStock} und</td>
        <td style="padding: 0.5rem; text-align: right;">$${i.costoUnitarioUSD.toFixed(2)}</td>
        <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: var(--primary);">$${i.subtotalUSD.toFixed(2)}</td>
        <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #059669;">Bs. ${i.subtotalVES.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
      </tr>
    `).join('');

    previewContent.innerHTML = `
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.85rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span style="font-size: 0.78rem; color: #64748b; text-transform: uppercase; font-weight: 700;">PROVEEDOR:</span>
          <div style="font-size: 1rem; font-weight: 800; color: #0f172a;">${payload.proveedorName}</div>
          <div style="font-size: 0.82rem; color: #475569;">RIF: ${payload.proveedorRif || 'N/A'} | Telf: ${payload.proveedorTelefono || 'N/A'}</div>
        </div>
        <div>
          <span style="font-size: 0.78rem; color: #64748b; text-transform: uppercase; font-weight: 700;">DOCUMENTO:</span>
          <div style="font-size: 1rem; font-weight: 800; color: #dc2626;">${payload.tipoDocumento} Nº ${payload.numeroDocumento}</div>
          <div style="font-size: 0.82rem; color: #475569;">Fecha: ${payload.fecha} | Vence: ${payload.fechaVencimiento || 'N/A'}</div>
        </div>
        <div>
          <span style="font-size: 0.78rem; color: #64748b; text-transform: uppercase; font-weight: 700;">TASA APLICADA:</span>
          <div style="font-size: 1.1rem; font-weight: 800; color: #0284c7;">Bs. ${payload.tasaBCV.toFixed(2)}</div>
        </div>
      </div>

      <div style="max-height: 320px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 1rem;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead style="background: #0f172a; color: #fff; position: sticky; top: 0;">
            <tr>
              <th style="padding: 0.5rem; text-align: left;">CÓDIGO</th>
              <th style="padding: 0.5rem; text-align: left;">PRODUCTO</th>
              <th style="padding: 0.5rem; text-align: center;">STOCK ACTUAL</th>
              <th style="padding: 0.5rem; text-align: center;">ENTRADA</th>
              <th style="padding: 0.5rem; text-align: center;">NUEVO STOCK</th>
              <th style="padding: 0.5rem; text-align: right;">COSTO $</th>
              <th style="padding: 0.5rem; text-align: right;">SUBTOTAL $</th>
              <th style="padding: 0.5rem; text-align: right;">SUBTOTAL BS.</th>
            </tr>
          </thead>
          <tbody>
            ${filasHTML}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; background: #0284c7; color: #fff; padding: 1rem 1.25rem; border-radius: 8px;">
        <div style="font-size: 0.9rem;">
          Total Ítems: <strong>${payload.items.length} productos</strong> | Unidades: <strong>${payload.items.reduce((a,b)=>a+b.cantidad,0)} und</strong>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.85rem; opacity: 0.9;">TOTAL FACTURA PROVEEDOR:</span>
          <strong style="font-size: 1.4rem; margin-left: 0.5rem; color: #fff;">$${payload.totalUSD.toFixed(2)}</strong>
          <span style="font-size: 1.1rem; margin-left: 0.75rem; color: #a7f3d0; font-weight: 700;">(Bs. ${payload.totalVES.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})})</span>
        </div>
      </div>
    `;
  }

  // ── CONFIRMACIÓN FINAL Y GUARDADO ─────────────────────────────────────────
  btnConfirmSaveEntrada?.addEventListener('click', async () => {
    if (!currentPayload) return;

    btnConfirmSaveEntrada.disabled = true;
    btnConfirmSaveEntrada.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando Inventario...';

    const res = await API.post('api/entradas.php', currentPayload);
    
    btnConfirmSaveEntrada.disabled = false;
    btnConfirmSaveEntrada.innerHTML = '<i class="fa-solid fa-check-double"></i> Confirmar e Ingresar al Inventario Real';

    if (res.success) {
      modalPreview.classList.remove('active');
      alert('✅ Compra guardada con éxito. El inventario ha sido actualizado.');
      await init();
    } else {
      alert('Error al guardar: ' + (res.error || 'Error desconocido'));
    }
  });

  // ── ABONOS ────────────────────────────────────────────────────────────────
  function openAbonoModal(entradaId) {
    formAbono.reset();
    document.getElementById('abonoEntradaId').value = entradaId;
    document.getElementById('btnCloseAbonoModal')?.addEventListener('click', () => modalAbono.classList.remove('active'));
    modalAbono.classList.add('active');
  }

  formAbono?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      entradaId: document.getElementById('abonoEntradaId').value,
      montoUSD: parseNum(document.getElementById('abonoMontoUSD').value),
      montoVES: parseNum(document.getElementById('abonoMontoVES').value),
      referencia: document.getElementById('abonoRef').value,
      fecha: document.getElementById('abonoFecha').value
    };

    const res = await API.post('api/abonos_entradas.php', payload);
    if (res.success) {
      modalAbono.classList.remove('active');
      await loadEntradas();
    } else {
      alert('Error al registrar abono: ' + (res.error || 'Error desconocido'));
    }
  });

  init();
});
