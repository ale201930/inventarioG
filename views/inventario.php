<?php
// views/inventario.php
?>
<main class="main-content">
    <div class="page-header">
        <div>
            <h1 class="page-title"><i class="fa-solid fa-box" style="color: var(--primary);"></i> Gestión de Inventario</h1>
            <p class="page-subtitle">Listado de productos, existencias en almacén y precios</p>
        </div>
        <button class="btn btn-primary" id="btnNuevoProducto">
            <i class="fa-solid fa-plus"></i> Nuevo Producto
        </button>
    </div>

    <!-- Barra de Búsqueda -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
        <div style="display: flex; gap: 1rem; align-items: center;">
            <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted);"></i>
            <input type="text" id="searchProducto" class="form-control" placeholder="Buscar producto por nombre..." style="border: none; box-shadow: none;">
        </div>
    </div>

    <!-- Tabla de Productos -->
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Stock</th>
                    <th>Costo Compra ($)</th>
                    <th>Precio 1 ($)</th>
                    <th>Precio 2 ($)</th>
                    <th>Precio 3 ($)</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody id="inventarioTableBody">
                <tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Cargando inventario...</td></tr>
            </tbody>
        </table>
    </div>
</main>

<!-- Modal Nuevo / Editar Producto -->
<div class="modal-overlay" id="productoModal">
    <div class="modal-content" style="max-width: 550px;">
        <div class="modal-header">
            <h2 id="modalTitle">Nuevo Producto</h2>
            <button class="modal-close" id="btnModalClose">&times;</button>
        </div>
        <form id="productoForm">
            <input type="hidden" id="prodId">
            <div class="form-group">
                <label class="form-label">Nombre del Producto</label>
                <input type="text" id="prodNombre" class="form-control" placeholder="Ej: Lucky Cosmic 20 Cig x 10 Cajetillas" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div class="form-group">
                    <label class="form-label">Cantidad / Stock</label>
                    <input type="number" id="prodCantidad" class="form-control" value="0" min="0" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Costo de Compra ($)</label>
                    <input type="number" step="0.01" id="prodCosto" class="form-control" value="0.00" min="0" required>
                </div>
            </div>
            <!-- Nivel de Precios de Venta -->
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.75rem; margin-top: 0.5rem; margin-bottom: 1rem;">
                <h4 style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase; margin-bottom: 0.5rem;">Precios de Venta de Salida</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 0.75rem;">Precio 1 ($)</label>
                        <input type="number" step="0.01" id="prodPrecio1" class="form-control" value="0.00" min="0" placeholder="0.00" required>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 0.75rem;">Precio 2 ($)</label>
                        <input type="number" step="0.01" id="prodPrecio2" class="form-control" value="0.00" min="0" placeholder="0.00">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 0.75rem;">Precio 3 ($)</label>
                        <input type="number" step="0.01" id="prodPrecio3" class="form-control" value="0.00" min="0" placeholder="0.00">
                    </div>
                </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
                <button type="submit" class="btn btn-primary" style="width: 100%;">Guardar Producto</button>
            </div>
        </form>
    </div>
</div>
