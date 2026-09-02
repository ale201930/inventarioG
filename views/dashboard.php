<?php
// views/dashboard.php
?>
<main class="main-content">
    <div class="page-header">
        <div>
            <h1 class="page-title"><i class="fa-solid fa-chart-pie" style="color: var(--primary);"></i> Panel de Control</h1>
            <p class="page-subtitle">Resumen del estado de tu inventario, ventas y saldos pendientes</p>
        </div>
    </div>

    <!-- Métricas en Tarjetas -->
    <div class="metrics-grid" id="metricsContainer">
        <div class="card metric-card">
            <div class="metric-icon-box success">
                <i class="fa-solid fa-hand-holding-dollar"></i>
            </div>
            <div class="metric-info">
                <h3>Cuentas por Cobrar</h3>
                <div class="value" id="totalCobrar" style="color: var(--success);">$0.00</div>
            </div>
        </div>

        <div class="card metric-card">
            <div class="metric-icon-box danger">
                <i class="fa-solid fa-money-bill-transfer"></i>
            </div>
            <div class="metric-info">
                <h3>Cuentas por Pagar</h3>
                <div class="value" id="totalPagar" style="color: var(--danger);">$0.00</div>
            </div>
        </div>

        <div class="card metric-card">
            <div class="metric-icon-box primary">
                <i class="fa-solid fa-chart-line"></i>
            </div>
            <div class="metric-info">
                <h3>Total Ventas</h3>
                <div class="value" id="totalVentas">$0.00</div>
            </div>
        </div>

        <div class="card metric-card">
            <div class="metric-icon-box warning">
                <i class="fa-solid fa-boxes-stacked"></i>
            </div>
            <div class="metric-info">
                <h3>Stock Productos</h3>
                <div class="value" id="totalItems">0 ítems</div>
            </div>
        </div>
    </div>

    <!-- Acceso Rápido -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <div class="card">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                <i class="fa-solid fa-cart-plus" style="color: var(--primary); font-size: 1.25rem;"></i>
                <h3 style="font-size: 1.1rem; font-weight: 600;">Entrada de Mercancía</h3>
            </div>
            <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1rem;">
                Registra compras de mercancía a proveedores y actualiza el stock automáticamente.
            </p>
            <a href="index.php?route=entradas" class="btn btn-primary btn-sm">Ir a Entradas <i class="fa-solid fa-arrow-right"></i></a>
        </div>

        <div class="card">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                <i class="fa-solid fa-truck-dispatch" style="color: var(--success); font-size: 1.25rem;"></i>
                <h3 style="font-size: 1.1rem; font-weight: 600;">Despacho / Salida</h3>
            </div>
            <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1rem;">
                Registra ventas a clientes, deduce productos del inventario y gestiona cuentas por cobrar.
            </p>
            <a href="index.php?route=salidas" class="btn btn-primary btn-sm" style="background-color: var(--success);">Ir a Salidas <i class="fa-solid fa-arrow-right"></i></a>
        </div>
    </div>

    <!-- Tablas de Actividad Reciente -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;">
        <div class="table-container">
            <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); background-color: #fff;">
                <h3 style="font-size: 1rem; font-weight: 600;"><i class="fa-solid fa-clock-rotate-left"></i> Compras Recientes</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Factura</th>
                        <th>Proveedor</th>
                        <th>Total</th>
                        <th>Deuda</th>
                    </tr>
                </thead>
                <tbody id="recentEntradasTable">
                    <tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Cargando...</td></tr>
                </tbody>
            </table>
        </div>

        <div class="table-container">
            <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); background-color: #fff;">
                <h3 style="font-size: 1rem; font-weight: 600;"><i class="fa-solid fa-clock-rotate-left"></i> Ventas Recientes</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Factura</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Pendiente</th>
                    </tr>
                </thead>
                <tbody id="recentSalidasTable">
                    <tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Cargando...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</main>
