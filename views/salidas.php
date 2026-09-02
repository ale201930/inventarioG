<?php
// views/salidas.php - Facturación y Despachos (Sustitución de Talonario BESTEDA 2, C.A.)
?>
<link rel="stylesheet" href="assets/css/ticket80mm.css?v=<?= time() ?>">

<main class="main-content">
    <div class="page-header">
        <div>
            <h1 class="page-title"><i class="fa-solid fa-receipt" style="color: var(--primary);"></i> Facturación y Despachos (Salidas)</h1>
            <p class="page-subtitle">Facturación digital compatible con impresoras de ticket de 80mm · Sustitución de talonario</p>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btnOpenEstadoCuentaModal" style="background: #0284c7; color: #fff; border-color: #0284c7;">
                <i class="fa-solid fa-file-invoice-dollar"></i> 📋 Estado de Cuenta Cliente
            </button>
            <button class="btn btn-primary" id="btnNuevaSalida">
                <i class="fa-solid fa-plus"></i> Nueva Nota / Despacho
            </button>
        </div>
    </div>

    <!-- Historial con Filtros -->
    <div class="table-container">
        <div style="padding: 1rem 1.25rem; background: #fff; border-bottom: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;">
            <h3 style="font-size: 1rem; font-weight: 600;"><i class="fa-solid fa-list-check"></i> Historial de Facturas</h3>
            <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center;">
                <!-- Filtro por fecha específica -->
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <label style="font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap;">
                        <i class="fa-solid fa-calendar-day"></i> Filtrar día:
                    </label>
                    <input type="date" id="filterFecha" class="form-control" style="min-height: 36px; width: auto; font-size: 0.85rem;">
                    <button class="btn btn-secondary btn-sm" id="btnClearFecha" title="Limpiar filtro de fecha">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <!-- Buscar por texto -->
                <input type="text" id="searchSalida" class="form-control" placeholder="🔍 Buscar cliente, Nº factura..." style="max-width: 220px; min-height: 36px; font-size: 0.85rem;">
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Documento</th>
                    <th>Nº Factura</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>C.I. / RIF</th>
                    <th>Total ($)</th>
                    <th>Saldo Pendiente</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody id="salidasTableBody">
                <tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">Cargando facturas...</td></tr>
            </tbody>
        </table>
    </div>
</main>

<!-- Modal Nueva Factura / Talonario 80mm -->
<div class="modal-overlay" id="salidaModal">
    <div class="modal-content" style="max-width: 750px;">
        <div class="modal-header">
            <div>
                <h2><i class="fa-solid fa-file-invoice"></i> Nueva Factura (BESTEDA 2, C.A.)</h2>
                <p style="font-size: 0.8rem; color: var(--text-secondary);">RIF: J-40529263-6 | San Juan de los Morros</p>
            </div>
            <button class="modal-close" id="btnCloseSalidaModal">&times;</button>
        </div>

        <form id="salidaForm">
            <!-- Tipo de Documento: NOTA DE ENTREGA -->
            <input type="hidden" name="salTipoDoc" id="salTipoDoc" value="NOTA DE ENTREGA">
            <div style="margin-bottom: 1rem; background: #e0f2fe; padding: 0.6rem 1rem; border-radius: var(--radius-md); border: 1px solid #bae6fd; font-weight: 700; color: #0369a1; font-size: 0.88rem; display: flex; align-items: center; justify-content: space-between;">
                <span><i class="fa-solid fa-file-invoice"></i> DOCUMENTO: NOTA DE ENTREGA</span>
                <span class="badge badge-primary" style="background:#0284c7; color:#fff;">Talonario 80mm</span>
            </div>

            <!-- Datos del Cliente -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">Cliente (Nombre y Apellido) *</label>
                    <input type="text" id="salCliente" class="form-control" placeholder="Ej: Pedro Pérez" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Cédula / RIF *</label>
                    <input type="text" id="salCedula" class="form-control" placeholder="Ej: V-12345678" required>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">Teléfono</label>
                    <input type="text" id="salTelefono" class="form-control" placeholder="Ej: 0412-1234567">
                </div>
                <div class="form-group">
                    <label class="form-label">Fecha</label>
                    <input type="date" id="salFecha" class="form-control" value="<?= date('Y-m-d') ?>" required>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Dirección</label>
                <input type="text" id="salDireccion" class="form-control" placeholder="Ej: Av. Bolívar Edif. Central Piso 1">
            </div>

            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--border-color);">

            <!-- Productos -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                <h3 style="font-size: 0.95rem; font-weight: 600;"><i class="fa-solid fa-cart-shopping"></i> Productos a Facturar</h3>
                <button type="button" class="btn btn-secondary btn-sm" id="btnSalidaAddItem">+ Agregar Renglón</button>
            </div>

            <!-- Cabecera de columnas -->
            <div style="display: grid; grid-template-columns: 2.2fr 1.4fr 0.7fr 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.25rem; padding: 0 0.25rem;">
                <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">PRODUCTO</span>
                <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">OPCION PRECIO</span>
                <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">CANT.</span>
                <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">PRECIO $</span>
                <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">SUBTOTAL</span>
                <span></span>
            </div>

            <div id="salidaItemsContainer"></div>

            <!-- Totales -->
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; padding: 1rem; border-radius: var(--radius-md); margin-top: 1rem;">
                <div>
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">Total Unidades:</span>
                    <strong id="salTotalUnidadesText" style="font-size: 1.1rem; color: var(--primary); margin-left: 0.5rem;">0</strong>
                </div>
                <div>
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">TOTAL FACTURA:</span>
                    <strong id="salTotalMontoText" style="font-size: 1.4rem; color: var(--success); margin-left: 0.5rem;">$0.00</strong>
                </div>
            </div>

            <!-- Botones -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem;">
                <button type="button" id="btnOnlySaveSalida" class="btn btn-secondary" style="width: 100%;">
                    <i class="fa-solid fa-floppy-disk"></i> Solo Guardar
                </button>
                <button type="submit" class="btn btn-primary" style="width: 100%;">
                    <i class="fa-solid fa-print"></i> Guardar e Imprimir Ticket (80mm)
                </button>
            </div>
        </form>
    </div>
</div>

<!-- Modal Preview Ticket 80mm -->
<div class="modal-overlay" id="ticketModal">
    <div class="modal-content" style="max-width: 480px; padding: 1.25rem;">
        <div class="modal-header" style="margin-bottom: 0.75rem;">
            <h2><i class="fa-solid fa-receipt"></i> Vista Previa · Ticket 80mm</h2>
            <button class="modal-close" id="btnCloseTicketModal">&times;</button>
        </div>
        <div id="ticketPreviewArea"></div>
        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
            <button class="btn btn-primary" id="btnPrintTicketTrigger" style="width: 100%; font-size: 1rem; padding: 0.75rem;">
                <i class="fa-solid fa-print"></i> Enviar a Impresora 80mm
            </button>
        </div>
    </div>
</div>

<!-- Modal Abono de Cliente (Con Conversión Bidireccional Automática) -->
<div class="modal-overlay" id="abonoSalidaModal">
    <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
            <div>
                <h2><i class="fa-solid fa-hand-holding-dollar"></i> Registrar Abono de Cliente</h2>
                <p id="abonoClienteHeaderName" style="font-size: 0.82rem; color: var(--text-secondary); font-weight: 600; margin: 0;"></p>
            </div>
            <button class="modal-close" id="btnCloseAbonoSalidaModal">&times;</button>
        </div>
        <form id="abonoSalidaForm">
            <input type="hidden" id="abonoClienteName">
            <input type="hidden" id="abonoSalidaId">

            <!-- Card de Tasa BCV Oficial -->
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.8rem; color: #0369a1; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-coins"></i> Tasa BCV de Conversión:</span>
                <strong id="abonoBCVDisplayRate" style="color: #0284c7; font-size: 0.9rem;">Bs. 794.99 / $</strong>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 0.5rem;">
                <div class="form-group" style="margin: 0;">
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Monto en USD ($)</label>
                    <input type="number" step="0.01" id="abonoSalMontoUSD" class="form-control" placeholder="0.00" required style="font-size: 1rem; font-weight: 700; color: #166534;">
                    <small id="abonoHelperUSD" style="font-size: 0.72rem; color: #0284c7; font-weight: 600; display: block; margin-top: 3px;">= Bs. 0.00</small>
                </div>
                <div class="form-group" style="margin: 0;">
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Monto en BS (VES)</label>
                    <input type="number" step="0.01" id="abonoSalMontoVES" class="form-control" placeholder="0.00" style="font-size: 1rem; font-weight: 700; color: #0284c7;">
                    <small id="abonoHelperVES" style="font-size: 0.72rem; color: #166534; font-weight: 600; display: block; margin-top: 3px;">= $0.00 USD</small>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-top: 0.85rem;">
                <div class="form-group" style="margin: 0;">
                    <label class="form-label" style="font-size: 0.8rem;">Fecha de Pago</label>
                    <input type="date" id="abonoSalFecha" class="form-control" value="<?= date('Y-m-d') ?>" required style="font-size: 0.85rem;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label class="form-label" style="font-size: 0.8rem;">Nº Referencia / Método</label>
                    <input type="text" id="abonoSalRef" class="form-control" placeholder="Ej: Pago Móvil 583920" style="font-size: 0.85rem;">
                </div>
            </div>

            <div style="margin-top: 1.25rem;">
                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.7rem; font-size: 0.95rem;">
                    <i class="fa-solid fa-check"></i> Procesar Abono de Cliente
                </button>
            </div>
        </form>
    </div>
</div>

<!-- Modal Estado de Cuenta de Cliente (Para imprimir o compartir por WhatsApp) -->
<div class="modal-overlay" id="modalEstadoCuentaCliente">
    <div class="modal-content" style="max-width: 850px; padding: 1.25rem;">
        <div class="modal-header">
            <div>
                <h2><i class="fa-solid fa-file-invoice-dollar" style="color: #0284c7;"></i> Estado de Cuenta del Cliente</h2>
                <p style="font-size: 0.8rem; color: var(--text-secondary);">Resumen detallado de compras, abonos y saldo deudor pendiente</p>
            </div>
            <button class="modal-close" id="btnCloseEstadoCuentaModal">&times;</button>
        </div>

        <!-- Selector de Cliente y Filtros -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem; border-radius: 8px; margin-bottom: 1rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 220px;">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Seleccionar o Buscar Cliente:</label>
                <select id="selectEstadoCuentaCliente" class="form-control" style="font-size: 0.9rem;">
                    <option value="">-- Cargar Lista de Clientes --</option>
                </select>
            </div>
            <div style="min-width: 200px;">
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Filtrar Notas del Documento:</label>
                <select id="selectEstadoCuentaFiltro" class="form-control" style="font-size: 0.9rem; font-weight: 700; color: #0284c7;">
                    <option value="todas">📋 Todas (Ver todo el historial)</option>
                    <option value="pendientes">🔴 Solo Pendientes (Por cobrar)</option>
                    <option value="pagadas">🟢 Solo Pagadas (Historial al día)</option>
                </select>
            </div>
            <button class="btn btn-secondary" id="btnRefreshEstadoCuenta" style="margin-top: 1.3rem;">
                <i class="fa-solid fa-arrows-rotate"></i> Actualizar
            </button>
        </div>

        <!-- Vista Previa Imprimible del Estado de Cuenta -->
        <div id="estadoCuentaPrintableArea" style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1.25rem; max-height: 60vh; overflow-y: auto;">
            <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
                <i class="fa-solid fa-user-tag" style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #94a3b8;"></i>
                <p>Selecciona un cliente arriba para generar su Estado de Cuenta oficial.</p>
            </div>
        </div>

        <!-- Acciones: Exportar PDF / Imprimir -->
        <div style="display: flex; gap: 0.75rem; margin-top: 1.25rem; justify-content: flex-end; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btnDownloadPDFEstadoCuenta" style="background: #0284c7; color: #fff; border: none; font-weight: 700;">
                <i class="fa-solid fa-file-pdf" style="font-size: 1.1rem;"></i> Exportar a PDF
            </button>
            <button class="btn btn-secondary" id="btnPrintEstadoCuentaDoc" style="background: #475569; color: #fff; border: none; font-weight: 700;">
                <i class="fa-solid fa-print" style="font-size: 1.1rem;"></i> Imprimir Documento
            </button>
        </div>
    </div>
</div>

<div id="ticketPrintContainer"></div>
