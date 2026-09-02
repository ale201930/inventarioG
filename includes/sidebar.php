<?php
// includes/sidebar.php
$route = $_GET['route'] ?? 'dashboard';
?>
<aside class="sidebar">
    <div class="sidebar-brand" style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem;">
        <img src="public/logo.png" alt="Logo InvG" style="width: 38px; height: 38px; border-radius: 8px; object-fit: cover; box-shadow: 0 2px 8px rgba(2,132,199,0.3);">
        <div class="brand-title" style="font-weight: 800; font-size: 1.2rem; color: var(--text-primary);">
            Inv<span style="color: #0284c7;">G</span> <small style="font-size: 0.65rem; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 2px;">PRO</small>
        </div>
    </div>

    <ul class="nav-menu">
        <li class="nav-item <?= $route === 'dashboard' ? 'active' : '' ?>">
            <a href="index.php?route=dashboard">
                <i class="fa-solid fa-chart-pie"></i>
                <span>Panel Principal</span>
            </a>
        </li>
        <li class="nav-item <?= $route === 'inventario' ? 'active' : '' ?>">
            <a href="index.php?route=inventario">
                <i class="fa-solid fa-box"></i>
                <span>Inventario</span>
            </a>
        </li>
        <li class="nav-item <?= $route === 'entradas' ? 'active' : '' ?>">
            <a href="index.php?route=entradas">
                <i class="fa-solid fa-arrow-down-left-and-arrow-up-right-to-inside"></i>
                <span>Entradas / Compras</span>
            </a>
        </li>
        <li class="nav-item <?= $route === 'salidas' ? 'active' : '' ?>">
            <a href="index.php?route=salidas">
                <i class="fa-solid fa-truck-ramp-box"></i>
                <span>Salidas / Ventas</span>
            </a>
        </li>
        <li class="nav-item <?= $route === 'reportes' ? 'active' : '' ?>">
            <a href="index.php?route=reportes">
                <i class="fa-solid fa-file-invoice-dollar"></i>
                <span>Reportes</span>
            </a>
        </li>
    </ul>

    <!-- Widget de Tasa BCV Oficial -->
    <div id="bcvWidgetSidebar"></div>

    <div class="sidebar-footer">
        <a href="index.php?route=login&action=logout" class="btn btn-secondary" style="width: 100%; justify-content: flex-start;">
            <i class="fa-solid fa-right-from-bracket"></i>
            <span>Cerrar Sesión</span>
        </a>
    </div>
</aside>
