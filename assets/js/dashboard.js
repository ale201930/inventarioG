// assets/js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
  const metricsContainer = document.getElementById('metricsContainer');
  if (!metricsContainer) return;

  const res = await API.get('api/reportes.php');
  if (res.success) {
    const { metrics, recentEntradas, recentSalidas } = res;

    // Actualizar Tarjetas
    document.getElementById('totalCobrar').textContent = `$${parseFloat(metrics.totalCobrar).toFixed(2)}`;
    document.getElementById('totalPagar').textContent = `$${parseFloat(metrics.totalPagar).toFixed(2)}`;
    document.getElementById('totalVentas').textContent = `$${parseFloat(metrics.totalVentas).toFixed(2)}`;
    document.getElementById('totalItems').textContent = `${metrics.totalItems} ítems`;

    // Renderizar Entradas Recientes
    const eTable = document.getElementById('recentEntradasTable');
    if (eTable) {
      if (recentEntradas.length === 0) {
        eTable.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Sin compras recientes</td></tr>`;
      } else {
        eTable.innerHTML = recentEntradas.map(e => `
          <tr>
            <td><strong>${e.factura_number}</strong></td>
            <td>${e.proveedor_name}</td>
            <td>$${parseFloat(e.total_factura).toFixed(2)}</td>
            <td><span class="badge ${parseFloat(e.saldo_adeudado) > 0 ? 'badge-danger' : 'badge-success'}">$${parseFloat(e.saldo_adeudado).toFixed(2)}</span></td>
          </tr>
        `).join('');
      }
    }

    // Renderizar Salidas Recientes
    const sTable = document.getElementById('recentSalidasTable');
    if (sTable) {
      if (recentSalidas.length === 0) {
        sTable.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">Sin ventas recientes</td></tr>`;
      } else {
        sTable.innerHTML = recentSalidas.map(s => `
          <tr>
            <td><strong>${s.factura_number}</strong></td>
            <td>${s.cliente_name}</td>
            <td>$${parseFloat(s.total_factura).toFixed(2)}</td>
            <td><span class="badge ${parseFloat(s.saldo_adeudado) > 0 ? 'badge-warning' : 'badge-success'}">$${parseFloat(s.saldo_adeudado).toFixed(2)}</span></td>
          </tr>
        `).join('');
      }
    }
  }
});
