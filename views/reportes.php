<?php
// views/reportes.php
?>
<main class="main-content">
    <div class="page-header">
        <div>
            <h1 class="page-title"><i class="fa-solid fa-chart-line" style="color: var(--primary);"></i> Panel Financiero · Ganancias y Pérdidas</h1>
            <p class="page-subtitle">Balance de utilidad real, margen de ganancias, ingresos por ventas y cuentas por cobrar/pagar</p>
        </div>
        <button class="btn btn-primary" id="btnExportCSV" style="background: #0284c7; border: none; font-weight: 700;">
            <i class="fa-solid fa-file-excel"></i> Exportar Informe Financiero
        </button>
    </div>

    <!-- Malla de Tarjetas Métricas de Ganancias y Balance -->
    <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
        
        <!-- Tarjeta 1: Ganancia Bruta Real (PROFIT) -->
        <div class="card metric-card" style="border-left: 5px solid #16a34a; background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);">
            <div class="metric-icon-box success" style="background: #dcfce7; color: #15803d;">
                <i class="fa-solid fa-hand-holding-dollar"></i>
            </div>
            <div class="metric-info">
                <h3 style="color: #166534; font-weight: 800; font-size: 0.85rem; text-transform: uppercase;">Utilidad / Ganancia Real</h3>
                <div class="value" id="repGananciaTotal" style="color: #15803d; font-size: 1.5rem; font-weight: 800;">$0.00</div>
                <div style="font-size: 0.75rem; font-weight: 700; color: #166534;" id="repGananciaTotalVES">Bs. 0.00</div>
            </div>
        </div>

        <!-- Tarjeta 2: Margen de Utilidad % -->
        <div class="card metric-card" style="border-left: 5px solid #0284c7; background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);">
            <div class="metric-icon-box primary" style="background: #e0f2fe; color: #0369a1;">
                <i class="fa-solid fa-percent"></i>
            </div>
            <div class="metric-info">
                <h3 style="color: #0369a1; font-weight: 800; font-size: 0.85rem; text-transform: uppercase;">Margen de Ganancia</h3>
                <div class="value" id="repMargenPercent" style="color: #0284c7; font-size: 1.5rem; font-weight: 800;">0.00%</div>
                <div style="font-size: 0.75rem; color: #64748b;">Rendimiento s/Ventas</div>
            </div>
        </div>

        <!-- Tarjeta 3: Total Ventas -->
        <div class="card metric-card" style="border-left: 5px solid #6366f1;">
            <div class="metric-icon-box primary" style="background: #e0e7ff; color: #4338ca;">
                <i class="fa-solid fa-cash-register"></i>
            </div>
            <div class="metric-info">
                <h3 style="font-size: 0.85rem; text-transform: uppercase;">Ventas Totales</h3>
                <div class="value" id="repVentasTotal" style="color: #4338ca; font-size: 1.4rem; font-weight: 800;">$0.00</div>
                <div style="font-size: 0.75rem; color: #64748b;" id="repVentasTotalVES">Bs. 0.00</div>
            </div>
        </div>

        <!-- Tarjeta 4: Costo de Mercancía Vendida -->
        <div class="card metric-card" style="border-left: 5px solid #f59e0b;">
            <div class="metric-icon-box warning" style="background: #fef3c7; color: #b45309;">
                <i class="fa-solid fa-boxes-packing"></i>
            </div>
            <div class="metric-info">
                <h3 style="font-size: 0.85rem; text-transform: uppercase;">Costo de lo Vendido</h3>
                <div class="value" id="repCostosTotal" style="color: #b45309; font-size: 1.4rem; font-weight: 800;">$0.00</div>
                <div style="font-size: 0.75rem; color: #64748b;" id="repCostosTotalVES">Bs. 0.00</div>
            </div>
        </div>

        <!-- Tarjeta 5: Por Cobrar (Clientes) -->
        <div class="card metric-card" style="border-left: 5px solid #dc2626;">
            <div class="metric-icon-box danger" style="background: #fee2e2; color: #b91c1c;">
                <i class="fa-solid fa-users-rectangle"></i>
            </div>
            <div class="metric-info">
                <h3 style="font-size: 0.85rem; text-transform: uppercase;">Cuentas por Cobrar</h3>
                <div class="value" id="repCobrarTotal" style="color: #dc2626; font-size: 1.4rem; font-weight: 800;">$0.00</div>
                <div style="font-size: 0.75rem; color: #64748b;" id="repCobrarTotalVES">Bs. 0.00</div>
            </div>
        </div>

        <!-- Tarjeta 6: Por Pagar (Proveedores) -->
        <div class="card metric-card" style="border-left: 5px solid #8b5cf6;">
            <div class="metric-icon-box danger" style="background: #f3e8ff; color: #6d28d9;">
                <i class="fa-solid fa-truck-ramp-box"></i>
            </div>
            <div class="metric-info">
                <h3 style="font-size: 0.85rem; text-transform: uppercase;">Cuentas por Pagar</h3>
                <div class="value" id="repPagarTotal" style="color: #6d28d9; font-size: 1.4rem; font-weight: 800;">$0.00</div>
                <div style="font-size: 0.75rem; color: #64748b;" id="repPagarTotalVES">Bs. 0.00</div>
            </div>
        </div>
    </div>

    <!-- Sección Estados de Cuenta y Lista de Deudores -->
    <div class="table-container" style="margin-top: 1.5rem; background: #fff; border-radius: 8px; border: 1px solid var(--border-color);">
        <div style="padding: 1rem 1.25rem; background: #f8fafc; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <h3 style="font-size: 1rem; font-weight: 800; color: #0f172a;"><i class="fa-solid fa-users-rectangle" style="color: #0284c7;"></i> Histórico de Cuentas por Cobrar a Clientes</h3>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">Métricas acumuladas e información de deudas activas</span>
        </div>
        <table>
            <thead>
                <tr style="background: #f1f5f9; font-size: 0.8rem; text-transform: uppercase;">
                    <th>Cliente</th>
                    <th>C.I. / RIF</th>
                    <th>Teléfono</th>
                    <th>Notas de Entrega</th>
                    <th>Total Compras ($)</th>
                    <th>Saldo Deudor ($)</th>
                    <th>Saldo Deudor (Bs.)</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody id="reporteClientesTableBody">
                <tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">Cargando reporte de deudas...</td></tr>
            </tbody>
        </table>
    </div>
</main>
