<?php
// api/reportes.php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
$pdo = getPDOConnection();

try {
    // 1. Cuentas por Cobrar (Suma de saldos adeudados en salidas)
    $stmtCobrar = $pdo->query("SELECT SUM(saldo_adeudado) AS total_cobrar, SUM(total_factura) AS total_ventas FROM salidas");
    $rowCobrar = $stmtCobrar->fetch();
    $totalCobrar = (float)($rowCobrar['total_cobrar'] ?? 0);
    $totalVentas = (float)($rowCobrar['total_ventas'] ?? 0);

    // 2. Cuentas por Pagar (Suma de saldos adeudados en entradas)
    $stmtPagar = $pdo->query("SELECT SUM(saldo_adeudado) AS total_pagar, SUM(total_factura) AS total_compras FROM entradas");
    $rowPagar = $stmtPagar->fetch();
    $totalPagar = (float)($rowPagar['total_pagar'] ?? 0);
    $totalCompras = (float)($rowPagar['total_compras'] ?? 0);

    // 3. Obtener Tasa BCV del día
    $tasaBCV = 798.326;
    try {
        $stmtTasa = $pdo->query("SELECT tasa_hoy FROM tasa_bcv ORDER BY id DESC LIMIT 1");
        if ($stmtTasa && ($rowTasa = $stmtTasa->fetch())) {
            $tasaBCV = (float)$rowTasa['tasa_hoy'];
        }
    } catch (Exception $eT) {}

    // 4. Calcular Costo Total de Productos Vendidos y Ganancia Bruta Real
    $stmtCostoVendidos = $pdo->query("SELECT SUM(
        si.cantidad * IF(si.costo_unitario > 0, si.costo_unitario, IFNULL(inv.costo_unitario, 0))
    ) AS total_costos 
    FROM salidas_items si 
    LEFT JOIN inventario inv ON si.producto_id = inv.id");
    $rowCostoVendidos = $stmtCostoVendidos->fetch();
    $totalCostosVendidos = (float)($rowCostoVendidos['total_costos'] ?? 0);

    $gananciaBruta = max(0, $totalVentas - $totalCostosVendidos);
    $margenGanancia = $totalVentas > 0 ? round(($gananciaBruta / $totalVentas) * 100, 2) : 0;

    // 5. Conteo de ítems en Inventario
    $stmtInv = $pdo->query("SELECT COUNT(*) AS total_items, SUM(cantidad) AS total_stock, SUM(cantidad * costo_unitario) AS valor_inventario_costo FROM inventario");
    $rowInv = $stmtInv->fetch();
    $totalItems = (int)($rowInv['total_items'] ?? 0);
    $totalStock = (int)($rowInv['total_stock'] ?? 0);
    $valorInventarioCosto = (float)($rowInv['valor_inventario_costo'] ?? 0);

    // 6. Últimas 5 Entradas
    $stmtRecentE = $pdo->query("SELECT * FROM entradas ORDER BY fecha DESC LIMIT 5");
    $recentEntradas = $stmtRecentE->fetchAll();

    // 7. Últimas 5 Salidas
    $stmtRecentS = $pdo->query("SELECT * FROM salidas ORDER BY fecha DESC LIMIT 5");
    $recentSalidas = $stmtRecentS->fetchAll();

    echo json_encode([
        "success" => true,
        "metrics" => [
            "tasaBCV" => $tasaBCV,
            "totalVentas" => $totalVentas,
            "totalVentasVES" => round($totalVentas * $tasaBCV, 2),
            "totalCompras" => $totalCompras,
            "totalComprasVES" => round($totalCompras * $tasaBCV, 2),
            "totalCostosVendidos" => $totalCostosVendidos,
            "totalCostosVendidosVES" => round($totalCostosVendidos * $tasaBCV, 2),
            "gananciaBruta" => $gananciaBruta,
            "gananciaBrutaVES" => round($gananciaBruta * $tasaBCV, 2),
            "margenGanancia" => $margenGanancia,
            "totalCobrar" => $totalCobrar,
            "totalCobrarVES" => round($totalCobrar * $tasaBCV, 2),
            "totalPagar" => $totalPagar,
            "totalPagarVES" => round($totalPagar * $tasaBCV, 2),
            "totalItems" => $totalItems,
            "totalStock" => $totalStock,
            "valorInventarioCosto" => $valorInventarioCosto,
            "valorInventarioCostoVES" => round($valorInventarioCosto * $tasaBCV, 2)
        ],
        "recentEntradas" => $recentEntradas,
        "recentSalidas" => $recentSalidas
    ]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
