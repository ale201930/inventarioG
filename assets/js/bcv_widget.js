// assets/js/bcv_widget.js - Widget Global de Tasa BCV (Hoy, Mañana, Edición Manual)
window.BCV_RATE = {
  tasaHoy: 794.99,
  tasaManana: null,
  fecha: new Date().toISOString().split('T')[0],
  fuente: 'BCV'
};

document.addEventListener('DOMContentLoaded', async () => {
  await fetchAndRenderBCVRate();
});

async function fetchAndRenderBCVRate() {
  try {
    const res = await API.get('api/bcv.php');
    if (res.success && res.data) {
      window.BCV_RATE = {
        tasaHoy: parseFloat(res.data.tasaHoy) || 794.99,
        tasaManana: res.data.tasaManana ? parseFloat(res.data.tasaManana) : null,
        fecha: res.data.fecha,
        fuente: res.data.fuente || 'BCV'
      };
      renderBCVWidget();
    }
  } catch (e) {
    console.warn('No se pudo actualizar la Tasa BCV automáticamente:', e);
    renderBCVWidget();
  }
}

function renderBCVWidget() {
  const containerSidebar = document.getElementById('bcvWidgetSidebar');
  const containerMobile  = document.getElementById('bcvWidgetMobile');

  const hoyFormatted = window.BCV_RATE.tasaHoy.toFixed(2);
  const mananaText   = window.BCV_RATE.tasaManana ? ` | Mañana: Bs. ${window.BCV_RATE.tasaManana.toFixed(2)}` : '';

  const htmlContent = `
    <div class="bcv-badge-card" style="
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #fff;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      margin: 0.75rem;
      font-size: 0.8rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid rgba(255,255,255,0.1);
      display: flex;
      flex-direction: column;
      gap: 3px;
      cursor: pointer;
    " id="btnEditBCVRate" title="Hacer clic para modificar la Tasa BCV">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; color: #fbbf24; display: flex; align-items: center; gap: 4px;">
          🇻🇪 Tasa BCV ${window.BCV_RATE.tasaManana ? '(Hoy/Mañana)' : ''}
        </span>
        <i class="fa-solid fa-pen-to-square" style="font-size: 0.75rem; opacity: 0.8;"></i>
      </div>
      <div style="font-size: 1.05rem; font-weight: 800; color: #38bdf8; letter-spacing: 0.3px;">
        Bs. ${hoyFormatted} <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 400;">/ USD</span>
      </div>
      ${window.BCV_RATE.tasaManana ? `
        <div style="font-size: 0.73rem; color: #a7f3d0; font-weight: 600;">
          🌅 Mañana: Bs. ${window.BCV_RATE.tasaManana.toFixed(2)}
        </div>
      ` : ''}
      <div style="font-size: 0.68rem; color: #64748b; margin-top: 1px;">
        Fuente: ${window.BCV_RATE.fuente}
      </div>
    </div>
  `;

  if (containerSidebar) containerSidebar.innerHTML = htmlContent;

  if (containerMobile) {
    containerMobile.innerHTML = `
      <div id="btnEditBCVRateMobile" style="font-size: 0.75rem; background: #0f172a; color: #38bdf8; padding: 4px 8px; border-radius: 6px; font-weight: 700; cursor: pointer;">
        🇻🇪 BCV: Bs. ${hoyFormatted} ${window.BCV_RATE.tasaManana ? `(Mañana Bs. ${window.BCV_RATE.tasaManana.toFixed(2)})` : ''}
      </div>
    `;
  }

  // Event Listener para abrir modal de ajuste manual
  document.getElementById('btnEditBCVRate')?.addEventListener('click', openEditBCVModal);
  document.getElementById('btnEditBCVRateMobile')?.addEventListener('click', openEditBCVModal);
}

function openEditBCVModal() {
  let modal = document.getElementById('bcvModalEdit');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bcvModalEdit';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 420px; padding: 1.25rem;">
        <div class="modal-header">
          <h2>🇻🇪 Ajustar Tasa BCV</h2>
          <button class="modal-close" id="btnCloseBCVModal">&times;</button>
        </div>
        <form id="bcvEditForm">
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label">Tasa BCV Oficial de Hoy (Bs. / USD)</label>
            <input type="number" step="0.0001" id="bcvInpHoy" class="form-control" required style="font-size: 1.1rem; font-weight: 700; color: #0284c7;">
          </div>
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label">Tasa BCV para Mañana (Opcional)</label>
            <input type="number" step="0.0001" id="bcvInpManana" class="form-control" placeholder="Ej: 796.50" style="font-size: 1rem; font-weight: 600; color: #059669;">
          </div>
          <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem;">
            <button type="button" class="btn btn-secondary" id="btnRefreshBCVOnline" style="width: 50%;">
              <i class="fa-solid fa-arrows-rotate"></i> Consultar BCV
            </button>
            <button type="submit" class="btn btn-primary" style="width: 50%;">
              <i class="fa-solid fa-floppy-disk"></i> Guardar Tasa
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btnCloseBCVModal')?.addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnRefreshBCVOnline')?.addEventListener('click', async () => {
      await fetchAndRenderBCVRate();
      document.getElementById('bcvInpHoy').value = window.BCV_RATE.tasaHoy;
      document.getElementById('bcvInpManana').value = window.BCV_RATE.tasaManana || '';
    });

    document.getElementById('bcvEditForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hoyVal = parseFloat(document.getElementById('bcvInpHoy').value);
      const mananaVal = parseFloat(document.getElementById('bcvInpManana').value) || null;

      if (isNaN(hoyVal) || hoyVal <= 0) {
        alert('Ingresa una tasa válida.');
        return;
      }

      const res = await API.post('api/bcv.php', {
        tasaHoy: hoyVal,
        tasaManana: mananaVal,
        fuente: 'BCV (Ajuste Manual)'
      });

      if (res.success) {
        window.BCV_RATE.tasaHoy = hoyVal;
        window.BCV_RATE.tasaManana = mananaVal;
        window.BCV_RATE.fuente = 'BCV (Ajuste Manual)';
        renderBCVWidget();
        modal.classList.remove('active');
        
        // Notificar a las páginas si están escuchando el cambio de tasa
        window.dispatchEvent(new CustomEvent('bcvRateChanged', { detail: window.BCV_RATE }));
      }
    });
  }

  document.getElementById('bcvInpHoy').value = window.BCV_RATE.tasaHoy;
  document.getElementById('bcvInpManana').value = window.BCV_RATE.tasaManana || '';
  modal.classList.add('active');
}
