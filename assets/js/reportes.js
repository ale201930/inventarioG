// assets/js/reportes.js
document.addEventListener('DOMContentLoaded', async () => {
  const btnExport = document.getElementById('btnExportCSV');
  if (!btnExport) return;

  function formatBs(val) {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const res = await API.get('api/reportes.php');
  if (res.success) {
    const { metrics } = res;
    const tasa = parseFloat(metrics.tasaBCV) || 798.326;

    document.getElementById('repGananciaTotal').textContent = `$${parseFloat(metrics.gananciaBruta).toFixed(2)}`;
    document.getElementById('repGananciaTotalVES').textContent = `Bs. ${formatBs(metrics.gananciaBrutaVES)}`;

    document.getElementById('repMargenPercent').textContent = `${parseFloat(metrics.margenGanancia).toFixed(2)}%`;

    document.getElementById('repVentasTotal').textContent = `$${parseFloat(metrics.totalVentas).toFixed(2)}`;
    document.getElementById('repVentasTotalVES').textContent = `Bs. ${formatBs(metrics.totalVentasVES)}`;

    document.getElementById('repCostosTotal').textContent = `$${parseFloat(metrics.totalCostosVendidos).toFixed(2)}`;
    document.getElementById('repCostosTotalVES').textContent = `Bs. ${formatBs(metrics.totalCostosVendidosVES)}`;

    document.getElementById('repCobrarTotal').textContent = `$${parseFloat(metrics.totalCobrar).toFixed(2)}`;
    document.getElementById('repCobrarTotalVES').textContent = `Bs. ${formatBs(metrics.totalCobrarVES)}`;

    document.getElementById('repPagarTotal').textContent = `$${parseFloat(metrics.totalPagar).toFixed(2)}`;
    document.getElementById('repPagarTotalVES').textContent = `Bs. ${formatBs(metrics.totalPagarVES)}`;
  }

  // Cargar tabla de deudas por cliente
  const tbodyCl = document.getElementById('reporteClientesTableBody');
  if (tbodyCl) {
    try {
      const resCl = await API.get('api/salidas.php?action=clientes');
      const tasaBCV = res.success ? parseFloat(res.metrics.tasaBCV || 798.326) : 798.326;

      if (resCl.success && resCl.data && resCl.data.length > 0) {
        tbodyCl.innerHTML = resCl.data.map(c => {
          const deudaUSD = parseFloat(c.saldo_pendiente_usd) || 0;
          const deudaVES = deudaUSD * tasaBCV;

          const badgeDeudaUSD = deudaUSD > 0 
            ? `<span class="badge badge-warning" style="background:#fee2e2; color:#b91c1c; font-size:0.85rem; font-weight:700;">$${deudaUSD.toFixed(2)}</span>`
            : `<span class="badge badge-success" style="background:#dcfce7; color:#15803d; font-size:0.85rem; font-weight:700;">Al Día</span>`;

          const badgeDeudaVES = deudaUSD > 0
            ? `<span style="color:#b91c1c; font-weight:700; font-size:0.85rem;">Bs. ${formatBs(deudaVES)}</span>`
            : `<span style="color:#15803d; font-weight:700; font-size:0.85rem;">Bs. 0,00</span>`;

          return `
            <tr>
              <td><strong>${c.cliente_name}</strong></td>
              <td>${c.cedula_rif || '-'}</td>
              <td>${c.telefono || '-'}</td>
              <td><span class="badge badge-primary">${c.total_notas} notas</span></td>
              <td><strong>$${parseFloat(c.total_compras_usd).toFixed(2)}</strong></td>
              <td>${badgeDeudaUSD}</td>
              <td>${badgeDeudaVES}</td>
              <td>
                <a href="index.php?route=salidas" class="btn btn-secondary btn-sm" style="background:#0284c7; color:#fff; font-size:0.75rem; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                  <i class="fa-solid fa-file-invoice-dollar"></i> Estado de Cuenta
                </a>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        tbodyCl.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 1.5rem; color:#94a3b8;">No hay clientes registrados en el sistema.</td></tr>';
      }
    } catch(e) {
      tbodyCl.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 1.5rem; color:#ef4444;">Error cargando informe de clientes.</td></tr>';
    }
  }

  btnExport?.addEventListener('click', () => {
    window.print();
  });
});
