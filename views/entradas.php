<?php
// views/entradas.php - Automatización de Compras/Entradas de Proveedores
?>
<!-- Script Tesseract.js para Escaneo Inteligente OCR de Facturas -->
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>

<main class="main-content">
    <div class="page-header">
        <div>
            <h1 class="page-title"><i class="fa-solid fa-truck-loading" style="color: var(--primary);"></i> Entradas / Compras a Proveedores</h1>
            <p class="page-subtitle">Carga de facturas/notas de entrega, escaneo OCR automático, control dual ($ / Bs.) e incremento de inventario</p>
        </div>
        <button class="btn btn-primary" id="btnNuevaEntrada">
            <i class="fa-solid fa-plus"></i> Registrar Nueva Compra
        </button>
    </div>

    <!-- Tabla Histórica de Entradas -->
    <div class="table-container">
        <div style="padding: 1rem 1.25rem; background: #fff; border-bottom: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;">
            <h3 style="font-size: 1rem; font-weight: 600;"><i class="fa-solid fa-receipt"></i> Historial de Compras y Notas de Entrega</h3>
            <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center;">
                <input type="date" id="filterEntradaFecha" class="form-control" style="min-height: 36px; width: auto; font-size: 0.85rem;" title="Filtrar por fecha">
                <button class="btn btn-secondary btn-sm" id="btnClearEntradaFecha" title="Limpiar fecha"><i class="fa-solid fa-xmark"></i></button>
                <input type="text" id="searchEntrada" class="form-control" placeholder="🔍 Buscar proveedor, Nº factura..." style="max-width: 220px; min-height: 36px; font-size: 0.85rem;">
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Nº Documento</th>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Tasa BCV</th>
                    <th>Total ($)</th>
                    <th>Total (Bs.)</th>
                    <th>Saldo Pendiente</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody id="entradasTableBody">
                <tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">Cargando compras...</td></tr>
            </tbody>
        </table>
    </div>
</main>

<!-- Modal Registrar Entrada de Mercancía -->
<div class="modal-overlay" id="entradaModal">
    <div class="modal-content" id="entradaModalContent" style="max-width: 950px; transition: max-width 0.3s ease;">
        <div class="modal-header">
            <div>
                <h2><i class="fa-solid fa-file-circle-plus"></i> Cargar Factura de Proveedor / Entrada</h2>
                <p style="font-size: 0.8rem; color: var(--text-secondary);">Toma una foto de la factura o sube la imagen para escaneo automático OCR</p>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button type="button" class="btn btn-secondary btn-sm" id="btnFillDemoSosacruz" style="font-size: 0.75rem; background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">
                    💡 Ejemplo SOSACRUZ
                </button>
                <button class="modal-close" id="btnCloseEntradaModal">&times;</button>
            </div>
        </div>

        <!-- Opción de Subir / Tomar Foto de la Factura -->
        <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #1e40af; margin-bottom: 0.5rem; text-align: center;">
                📷 Capturar / Adjuntar Factura (Escaneo Inteligente OCR):
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <!-- Opción 1: Tomar Foto con Cámara -->
                <label for="entTomarFotoInput" style="cursor: pointer; background: #2563eb; color: #fff; padding: 0.65rem 0.8rem; border-radius: 6px; text-align: center; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin: 0; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                    <i class="fa-solid fa-camera" style="font-size: 1.1rem;"></i> 📷 Tomar Foto con Cámara
                </label>
                <input type="file" id="entTomarFotoInput" accept="image/*" capture="environment" style="display: none;">

                <!-- Opción 2: Subir Imagen o Archivo desde la Galería -->
                <label for="entSubirImagenInput" style="cursor: pointer; background: #ffffff; color: #1d4ed8; border: 1.5px solid #3b82f6; padding: 0.65rem 0.8rem; border-radius: 6px; text-align: center; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin: 0;">
                    <i class="fa-solid fa-folder-open" style="font-size: 1.1rem;"></i> 📁 Subir de la Galería / Archivo
                </label>
                <input type="file" id="entSubirImagenInput" accept="image/*" style="display: none;">
            </div>
        </div>

        <!-- Barra de Estado de Escaneo OCR -->
        <div id="ocrStatusBadge" style="display: none; background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 0.6rem 0.85rem; border-radius: 6px; font-size: 0.82rem; font-weight: 600; margin-bottom: 1rem; align-items: center; justify-content: space-between;">
            <span id="ocrStatusText"><i class="fa-solid fa-spinner fa-spin"></i> Escaneando factura con OCR para extraer datos...</span>
            <button type="button" class="btn btn-secondary btn-sm" id="btnCancelOCR" style="padding: 1px 6px; font-size: 0.72rem;">Cancelar</button>
        </div>

        <!-- Contenedor Principal (Soporta vista dividida con la foto al lado) -->
        <div id="entradaMainLayout" style="display: flex; gap: 1rem; align-items: flex-start;">
            
            <!-- Panel Visor de Imagen (Se activa al subir foto) -->
            <div id="facturaImagePreviewContainer" style="display: none; flex: 1; min-width: 340px; background: #0f172a; border-radius: 8px; padding: 0.5rem; text-align: center; max-height: 75vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; color: #fff; padding: 0 0.25rem;">
                    <span style="font-size: 0.78rem; font-weight: 700; color: #38bdf8;"><i class="fa-solid fa-image"></i> Foto de Factura</span>
                    <button type="button" class="btn btn-danger btn-sm" id="btnRemoveFacturaImage" style="padding: 2px 6px; font-size: 0.7rem;">&times; Quitar Foto</button>
                </div>
                <div style="overflow: hidden; display: flex; align-items: center; justify-content: center; min-height: 250px; background: #020617; border-radius: 4px; padding: 0.5rem;">
                    <img id="facturaImageElement" src="" alt="Factura de proveedor" style="max-width: 100%; max-height: 55vh; object-fit: contain; transition: transform 0.3s ease;">
                </div>
            </div>

            <!-- Formulario de Entrada -->
            <form id="entradaForm" style="flex: 2; width: 100%;">
                
                <!-- Sección 1: Datos del Proveedor -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                    <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fa-solid fa-building"></i> Datos del Proveedor
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 0.5rem;">
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.8rem;">Nombre o Razón Social *</label>
                            <input type="text" id="entProveedorName" class="form-control" placeholder="Ej: Distribuidora Central, C.A." required style="font-size: 0.88rem;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.8rem;">RIF *</label>
                            <input type="text" id="entProveedorRif" class="form-control" placeholder="Ej: J-12345678-9" required style="font-size: 0.88rem;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.8rem;">Teléfono</label>
                            <input type="text" id="entProveedorTelf" class="form-control" placeholder="Ej: 0412-1234567" style="font-size: 0.88rem;">
                        </div>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 0.8rem;">Dirección Fiscal</label>
                        <input type="text" id="entProveedorDir" class="form-control" placeholder="Ej: Av. Bolívar Edif. Central Piso 1" style="font-size: 0.88rem;">
                    </div>
                </div>

                <!-- Sección 2: Datos del Documento y Tasa BCV (Estructura en 2 Filas Amplias) -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                    <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fa-solid fa-file-invoice"></i> Datos del Documento y Tasa BCV
                    </h4>
                    <!-- Fila 1: Tipo Documento, Nº Documento y Tasa BCV -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.8rem;">Tipo Documento</label>
                            <select id="entTipoDoc" class="form-control" style="font-size: 0.85rem;">
                                <option value="NOTA DE ENTREGA">NOTA DE ENTREGA</option>
                                <option value="FACTURA">FACTURA</option>
                                <option value="ORDEN DE COMPRA">ORDEN DE COMPRA</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.8rem;">Nº Documento *</label>
                            <input type="text" id="entFacturaNum" class="form-control" placeholder="Ej: 032047" required style="font-size: 0.88rem;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.8rem; font-weight: 700; color: #0284c7;">🇻🇪 Tasa BCV (Bs./$)</label>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <input type="number" step="0.0001" id="entTasaBCV" class="form-control" placeholder="791.32" required style="font-size: 0.92rem; font-weight: 700; color: #0284c7; flex: 1;">
                                <button type="button" class="btn btn-secondary btn-sm" id="btnUseTasaManana" title="Usar Tasa de Mañana" style="padding: 0.45rem 0.65rem; font-size: 0.75rem; white-space: nowrap; flex-shrink: 0; background: #e0f2fe; color: #0369a1; border-color: #bae6fd; font-weight: 700;">
                                    🌅 Mañana
                                </button>
                            </div>
                        </div>
                    </div>
                    <!-- Fila 2: Fecha Emisión y Vencimiento -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.8rem;">Fecha Emisión</label>
                            <input type="date" id="entFecha" class="form-control" value="<?= date('Y-m-d') ?>" required style="font-size: 0.85rem;">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.8rem;">Fecha Vencimiento</label>
                            <input type="date" id="entFechaVenc" class="form-control" value="<?= date('Y-m-d', strtotime('+7 days')) ?>" style="font-size: 0.85rem;">
                        </div>
                    </div>
                </div>

                <!-- Sección 3: Tabla Dinámica de Renglones de Productos -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                    <h3 style="font-size: 0.95rem; font-weight: 700;"><i class="fa-solid fa-boxes-stacked"></i> Productos de la Factura / Compra</h3>
                    <button type="button" class="btn btn-secondary btn-sm" id="btnAddEntradaItem">+ Agregar Producto</button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 2fr 0.8fr 1fr 1fr 1fr auto; gap: 0.4rem; margin-bottom: 0.25rem; padding: 0 0.25rem;">
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">CÓDIGO</span>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">DESCRIPCIÓN / PRODUCTO</span>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">CANT.</span>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">COSTO $</span>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">TOTAL $</span>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">TOTAL BS.</span>
                    <span></span>
                </div>

                <div id="entradaItemsContainer" style="max-height: 280px; overflow-y: auto; padding-right: 2px;"></div>

                <!-- Resumen de Totales y Conversión (Campos de Total Compra Editables) -->
                <div style="display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 0.85rem 1.25rem; border-radius: var(--radius-md); margin-top: 1rem; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="font-size: 0.85rem;">
                        Unidades: <strong id="entTotalUnidadesText" style="color: #fbbf24; font-size: 1.05rem;">0</strong>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <label for="entTotalUSDInput" style="font-size: 0.82rem; color: #38bdf8; font-weight: 700; margin: 0; white-space: nowrap;">
                                <i class="fa-solid fa-pen-to-square"></i> TOTAL COMPRA ($):
                            </label>
                            <input type="number" step="0.01" id="entTotalUSDInput" class="form-control" placeholder="0.00" style="width: 120px; font-size: 1.15rem; font-weight: 800; color: #38bdf8; background: #1e293b; border: 1.5px solid #38bdf8; text-align: right; padding: 4px 8px;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <label for="entTotalVESInput" style="font-size: 0.82rem; color: #a7f3d0; font-weight: 700; margin: 0; white-space: nowrap;">(Bs.):</label>
                            <input type="number" step="0.01" id="entTotalVESInput" class="form-control" placeholder="0.00" style="width: 140px; font-size: 1.1rem; font-weight: 800; color: #a7f3d0; background: #1e293b; border: 1.5px solid #a7f3d0; text-align: right; padding: 4px 8px;">
                        </div>
                    </div>
                </div>

                <div style="margin-top: 1.25rem;">
                    <button type="button" id="btnPreviewEntrada" class="btn btn-primary" style="width: 100%; font-size: 1rem; padding: 0.75rem; background: var(--primary);">
                        <i class="fa-solid fa-eye"></i> Previsualizar Inspección de Inventario antes de Guardar
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Modal de Previsualización Visual (Inspección del Incremento de Inventario) -->
<div class="modal-overlay" id="previewEntradaModal">
    <div class="modal-content" style="max-width: 900px; padding: 1.25rem;">
        <div class="modal-header" style="margin-bottom: 0.75rem; border-bottom: 2px solid var(--primary-light); padding-bottom: 0.5rem;">
            <div>
                <h2><i class="fa-solid fa-clipboard-check" style="color: var(--success);"></i> Inspección Visual de Carga al Inventario</h2>
                <p style="font-size: 0.82rem; color: var(--text-secondary);">Verifica cómo quedará tu inventario después de procesar esta compra</p>
            </div>
            <button class="modal-close" id="btnClosePreviewEntradaModal">&times;</button>
        </div>

        <div id="previewEntradaContent"></div>

        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1rem; margin-top: 1.25rem;">
            <button type="button" class="btn btn-secondary" id="btnBackToEditEntrada" style="font-size: 0.95rem; padding: 0.75rem;">
                <i class="fa-solid fa-arrow-left"></i> Volver a Editar Factura
            </button>
            <button type="button" class="btn btn-primary" id="btnConfirmSaveEntrada" style="font-size: 1rem; padding: 0.75rem; background: var(--success); border-color: var(--success);">
                <i class="fa-solid fa-check-double"></i> Confirmar e Ingresar al Inventario Real
            </button>
        </div>
    </div>
</div>

<!-- Modal Registrar Abono a Proveedor -->
<div class="modal-overlay" id="abonoModal">
    <div class="modal-content">
        <div class="modal-header">
            <h2>Registrar Abono a Proveedor</h2>
            <button class="modal-close" id="btnCloseAbonoModal">&times;</button>
        </div>
        <form id="abonoForm">
            <input type="hidden" id="abonoEntradaId">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">Monto en USD ($)</label>
                    <input type="number" step="0.01" id="abonoMontoUSD" class="form-control" placeholder="0.00" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Monto en BS (VES)</label>
                    <input type="number" step="0.01" id="abonoMontoVES" class="form-control" placeholder="0.00">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">Fecha de Pago</label>
                    <input type="date" id="abonoFecha" class="form-control" value="<?= date('Y-m-d') ?>" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Nº Referencia / Pago Móvil</label>
                    <input type="text" id="abonoRef" class="form-control" placeholder="Ej: 948302">
                </div>
            </div>
            <div style="margin-top: 1.5rem;">
                <button type="submit" class="btn btn-primary" style="width: 100%;">Procesar Abono a Proveedor</button>
            </div>
        </form>
    </div>
</div>
