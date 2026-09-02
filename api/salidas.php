<?php
// api/salidas.php

// Función compartida con abonos_salidas.php
if (!function_exists('recalculateSalidaSaldo')) {
    function recalculateSalidaSaldo($pdo, $salidaId) {
        // 1. Obtener el total de la factura
        $stmtS = $pdo->prepare("SELECT total_factura FROM salidas WHERE id = :id");
        $stmtS->execute(['id' => $salidaId]);
        $salida = $stmtS->fetch();
        if (!$salida) return;

        $totalFactura = (float)$salida['total_factura'];

        // 2. Sumar todos los abonos de esta factura
        $stmtA = $pdo->prepare("SELECT SUM(monto_usd) AS total_abonado FROM abonos_salidas WHERE salida_id = :sid");
        $stmtA->execute(['sid' => $salidaId]);
        $abonoRow = $stmtA->fetch();
        $totalAbonado = (float)($abonoRow['total_abonado'] ?? 0);

        // 3. Calcular saldo deudor
        $newSaldo = max(0, $totalFactura - $totalAbonado);

        // 4. Actualizar saldo_adeudado
        $stmtUpd = $pdo->prepare("UPDATE salidas SET saldo_adeudado = :saldo WHERE id = :id");
        $stmtUpd->execute(['saldo' => $newSaldo, 'id' => $salidaId]);
    }
}

// Si este archivo fue incluido por otro (abonos_salidas.php), no ejecutar el router
if (basename(__FILE__) !== basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    return; // Solo exportar la función, no ejecutar nada más
}

ob_start();

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
$pdo = getPDOConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        try {
            $action = $_GET['action'] ?? null;

            if ($action === 'clientes') {
                // Obtener lista de clientes con sus deudas totales acumuladas
                $stmtCl = $pdo->query("SELECT 
                    cliente_name, 
                    MAX(cedula_rif) AS cedula_rif, 
                    MAX(telefono) AS telefono, 
                    MAX(direccion) AS direccion, 
                    COUNT(id) AS total_notas, 
                    SUM(total_factura) AS total_compras_usd, 
                    SUM(saldo_adeudado) AS saldo_pendiente_usd 
                    FROM salidas 
                    GROUP BY cliente_name 
                    ORDER BY saldo_pendiente_usd DESC, cliente_name ASC");
                $clientes = $stmtCl->fetchAll();
                echo json_encode(["success" => true, "data" => $clientes]);
                exit;
            }

            if ($action === 'estado_cuenta') {
                $rawQuery = trim($_GET['cliente'] ?? '');
                // Extraer el nombre antes de cualquier paréntesis ej: "Alexander Almaguer (Deuda: $84.63)" -> "Alexander Almaguer"
                $parts = explode('(', $rawQuery);
                $cleanName = trim($parts[0]);
                if (empty($cleanName)) $cleanName = $rawQuery;
                $clienteQuery = $cleanName;

                if (empty($clienteQuery)) {
                    echo json_encode(["success" => false, "error" => "Cliente no especificado."]);
                    exit;
                }

                // 1. Buscar todas las notas/salidas del cliente (coincidencia exacta o por subcadena)
                $stmtSal = $pdo->prepare("SELECT * FROM salidas 
                    WHERE LOWER(TRIM(cliente_name)) = LOWER(TRIM(:cli1)) 
                       OR LOWER(TRIM(cedula_rif)) = LOWER(TRIM(:cli2)) 
                       OR LOWER(TRIM(cliente_name)) LIKE LOWER(CONCAT('%', :cli3, '%'))
                    ORDER BY fecha DESC, created_at DESC");
                $stmtSal->execute(['cli1' => $cleanName, 'cli2' => $cleanName, 'cli3' => $cleanName]);
                $salidasCliente = $stmtSal->fetchAll();

                // 2. Buscar datos del cliente desde su última nota
                $clienteInfo = [
                    "name" => $clienteQuery,
                    "cedula_rif" => "",
                    "telefono" => "",
                    "direccion" => ""
                ];
                if (!empty($salidasCliente)) {
                    $c0 = $salidasCliente[0];
                    $clienteInfo = [
                        "name" => $c0['cliente_name'],
                        "cedula_rif" => $c0['cedula_rif'] ?? '',
                        "telefono" => $c0['telefono'] ?? '',
                        "direccion" => $c0['direccion'] ?? ''
                    ];
                }

                // 3. Buscar todos los abonos del cliente (con try-catch por seguridad)
                $abonosCliente = [];
                try {
                    $stmtAb = $pdo->prepare("SELECT a.*, s.factura_number 
                        FROM abonos_salidas a 
                        LEFT JOIN salidas s ON a.salida_id = s.id 
                        WHERE LOWER(TRIM(a.cliente_name)) = LOWER(TRIM(:cli1)) 
                           OR LOWER(TRIM(s.cliente_name)) = LOWER(TRIM(:cli2))
                        ORDER BY a.fecha DESC, a.created_at DESC");
                    $stmtAb->execute(['cli1' => $clienteQuery, 'cli2' => $clienteQuery]);
                    $abonosCliente = $stmtAb->fetchAll();
                } catch (Exception $eAb) {
                    $abonosCliente = [];
                }

                // 4. Calcular totales globales
                $totComprasUSD = 0;
                $totSaldoUSD = 0;
                foreach ($salidasCliente as &$s) {
                    $totComprasUSD += (float)$s['total_factura'];
                    $totSaldoUSD += (float)$s['saldo_adeudado'];

                    // Adjuntar ítems de cada nota
                    try {
                        $stItems = $pdo->prepare("SELECT * FROM salidas_items WHERE salida_id = :sid");
                        $stItems->execute(['sid' => $s['id']]);
                        $s['items'] = $stItems->fetchAll();
                    } catch (Exception $eIt) {
                        $s['items'] = [];
                    }
                }

                $totAbonadoUSD = max(0, $totComprasUSD - $totSaldoUSD);

                // Tasa BCV actual
                $tasaBCV = 794.99;
                try {
                    $stmtTasa = $pdo->query("SELECT tasa_hoy FROM tasa_bcv ORDER BY id DESC LIMIT 1");
                    if ($stmtTasa && ($rowTasa = $stmtTasa->fetch())) {
                        $tasaBCV = (float)$rowTasa['tasa_hoy'];
                    }
                } catch (Exception $eTasa) {}

                echo json_encode([
                    "success" => true,
                    "cliente" => $clienteInfo,
                    "totales" => [
                        "total_compras_usd" => round($totComprasUSD, 2),
                        "total_abonado_usd" => round($totAbonadoUSD, 2),
                        "saldo_pendiente_usd" => round($totSaldoUSD, 2),
                        "total_compras_ves" => round($totComprasUSD * $tasaBCV, 2),
                        "total_abonado_ves" => round($totAbonadoUSD * $tasaBCV, 2),
                        "saldo_pendiente_ves" => round($totSaldoUSD * $tasaBCV, 2),
                        "tasa_bcv" => $tasaBCV
                    ],
                    "salidas" => $salidasCliente,
                    "abonos" => $abonosCliente
                ]);
                exit;
            }

            $id = $_GET['id'] ?? null;
            if ($id) {
                // Obtener una factura específica con sus items para reimprimir ticket
                $stmt = $pdo->prepare("SELECT * FROM salidas WHERE id = :id");
                $stmt->execute(['id' => $id]);
                $salida = $stmt->fetch();

                if ($salida) {
                    $stmtItems = $pdo->prepare("SELECT * FROM salidas_items WHERE salida_id = :id");
                    $stmtItems->execute(['id' => $id]);
                    $salida['items'] = $stmtItems->fetchAll();
                }

                echo json_encode(["success" => true, "data" => $salida]);
                exit;
            }

            $stmt = $pdo->query("SELECT * FROM salidas ORDER BY created_at DESC");
            $salidas = $stmt->fetchAll();

            foreach ($salidas as &$salida) {
                $stmtItems = $pdo->prepare("SELECT * FROM salidas_items WHERE salida_id = :id");
                $stmtItems->execute(['id' => $salida['id']]);
                $salida['items'] = $stmtItems->fetchAll();
            }

            echo json_encode(["success" => true, "data" => $salidas]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents("php://input"), true);
        if (!$input || empty($input['clienteName'])) {
            echo json_encode(["success" => false, "error" => "El Nombre del Cliente es obligatorio."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $id = !empty($input['id']) ? $input['id'] : 'sal_' . bin2hex(random_bytes(4));
            $tipoDocumento = 'NOTA DE ENTREGA';
            $clienteName = trim($input['clienteName']);
            $cedulaRif = trim($input['cedulaRif'] ?? '');
            $telefono = trim($input['telefono'] ?? '');
            $direccion = trim($input['direccion'] ?? '');
            $vendedorName = trim($input['vendedorName'] ?? 'JUAN MORA');
            $fecha = !empty($input['fecha']) ? $input['fecha'] : date('Y-m-d');
            $observaciones = trim($input['observaciones'] ?? '');
            $items = $input['items'] ?? [];

            // Generar número correlativo automático si no se ingresa
            $facturaNumber = trim($input['facturaNumber'] ?? '');
            if (empty($facturaNumber)) {
                $stmtCount = $pdo->query("SELECT COUNT(*) AS total FROM salidas");
                $rowC = $stmtCount->fetch();
                $nextNum = ((int)($rowC['total'] ?? 0)) + 1;
                $facturaNumber = str_pad($nextNum, 6, "0", STR_PAD_LEFT);
            }

            // Calcular totales
            $totalFactura = 0;
            $totalUnidades = 0;

            foreach ($items as $item) {
                $cant = (int)$item['cantidad'];
                $precio = (float)$item['precioUnitario'];
                $totalUnidades += $cant;
                $totalFactura += ($cant * $precio);
            }

            $saldoAdeudado = $totalFactura;

            // 1. Insertar en tabla salidas
            $stmt = $pdo->prepare("INSERT INTO salidas 
                (id, tipo_documento, cliente_name, cedula_rif, telefono, direccion, vendedor_name, factura_number, total_unidades, total_factura, saldo_adeudado, fecha, observaciones) 
                VALUES 
                (:id, :tipo, :cliente, :cedula, :telefono, :direccion, :vendedor, :factura, :unidades, :total, :saldo, :fecha, :obs)");
            
            $stmt->execute([
                'id' => $id,
                'tipo' => $tipoDocumento,
                'cliente' => $clienteName,
                'cedula' => $cedulaRif,
                'telefono' => $telefono,
                'direccion' => $direccion,
                'vendedor' => $vendedorName,
                'factura' => $facturaNumber,
                'unidades' => $totalUnidades,
                'total' => $totalFactura,
                'saldo' => $saldoAdeudado,
                'fecha' => $fecha,
                'obs' => $observaciones
            ]);

            // 2. Insertar Items y Descontar Stock de Inventario
            $insertedItems = [];
            foreach ($items as $item) {
                $prodId = $item['productoId'];
                $prodNombre = $item['productoNombre'];
                $cant = (int)$item['cantidad'];
                $precio = (float)$item['precioUnitario'];

                // Obtener costo de compra actual del producto para el cálculo de ganancias
                $costoUnitario = 0.00;
                $stmtCosto = $pdo->prepare("SELECT costo_unitario FROM inventario WHERE id = :pid");
                $stmtCosto->execute(['pid' => $prodId]);
                if ($rowCosto = $stmtCosto->fetch()) {
                    $costoUnitario = (float)($rowCosto['costo_unitario'] ?? 0);
                }

                // Insertar item con costo_unitario y precio_unitario
                $stmtItem = $pdo->prepare("INSERT INTO salidas_items (salida_id, producto_id, producto_nombre, cantidad, costo_unitario, precio_unitario) VALUES (:sid, :pid, :pnom, :cant, :costo, :precio)");
                $stmtItem->execute([
                    'sid' => $id,
                    'pid' => $prodId,
                    'pnom' => $prodNombre,
                    'cant' => $cant,
                    'costo' => $costoUnitario,
                    'precio' => $precio
                ]);

                $insertedItems[] = [
                    'producto_id' => $prodId,
                    'producto_nombre' => $prodNombre,
                    'cantidad' => $cant,
                    'precio_unitario' => $precio,
                    'subtotal' => $cant * $precio
                ];

                // ── Validar y descontar stock (con bloqueo de fila) ──────────────
                $stmtCheck = $pdo->prepare("SELECT nombre, cantidad FROM inventario WHERE id = :pid FOR UPDATE");
                $stmtCheck->execute(['pid' => $prodId]);
                $existing = $stmtCheck->fetch();

                if (!$existing) {
                    throw new Exception("Producto no encontrado en inventario: {$prodNombre}");
                }

                if ((int)$existing['cantidad'] < $cant) {
                    $disponible = (int)$existing['cantidad'];
                    throw new Exception(
                        "Stock insuficiente para \"{$existing['nombre']}\". " .
                        "Solicitado: {$cant} · Disponible: {$disponible}"
                    );
                }

                $stmtUpdProd = $pdo->prepare("UPDATE inventario SET cantidad = cantidad - :cant WHERE id = :pid");
                $stmtUpdProd->execute(['cant' => $cant, 'pid' => $prodId]);
            }

            // 3. Recalcular saldos del cliente
            recalculateSalidaSaldo($pdo, $id);

            $pdo->commit();

            echo json_encode([
                "success" => true,
                "message" => "Factura / Orden procesada y stock descontado.",
                "data" => [
                    "id" => $id,
                    "tipo_documento" => $tipoDocumento,
                    "factura_number" => $facturaNumber,
                    "fecha" => $fecha,
                    "cliente_name" => $clienteName,
                    "cedula_rif" => $cedulaRif,
                    "telefono" => $telefono,
                    "direccion" => $direccion,
                    "vendedor_name" => $vendedorName,
                    "total_unidades" => $totalUnidades,
                    "total_factura" => $totalFactura,
                    "saldo_adeudado" => $saldoAdeudado,
                    "observaciones" => $observaciones,
                    "items" => $insertedItems
                ]
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents("php://input"), true);
        if (empty($input['id']) || !isset($input['totalFactura'])) {
            echo json_encode(["success" => false, "error" => "ID o Total no proporcionado."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $id = $input['id'];
            $newTotal = (float)$input['totalFactura'];

            $stmtFetch = $pdo->prepare("SELECT cliente_name FROM salidas WHERE id = :id");
            $stmtFetch->execute(['id' => $id]);
            $salida = $stmtFetch->fetch();

            if (!$salida) {
                echo json_encode(["success" => false, "error" => "Despacho no encontrado."]);
                exit;
            }

            $stmt = $pdo->prepare("UPDATE salidas SET total_factura = :total WHERE id = :id");
            $stmt->execute(['total' => $newTotal, 'id' => $id]);

            recalculateSalidaSaldo($pdo, $id);

            $pdo->commit();
            echo json_encode(["success" => true, "message" => "Total de la factura actualizado correctamente."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(["success" => false, "error" => "Método no soportado."]);
        break;

    case 'DELETE':
        $input = json_decode(file_get_contents("php://input"), true);
        $id = $input['id'] ?? ($_GET['id'] ?? '');

        if (empty($id)) {
            echo json_encode(["success" => false, "error" => "ID de factura requerido."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            // Obtener la factura y sus items para reponer stock
            $stmtFetch = $pdo->prepare("SELECT * FROM salidas WHERE id = :id");
            $stmtFetch->execute(['id' => $id]);
            $salida = $stmtFetch->fetch();

            if (!$salida) {
                echo json_encode(["success" => false, "error" => "Factura no encontrada."]);
                exit;
            }

            // Reponer stock de cada producto
            $stmtItems = $pdo->prepare("SELECT * FROM salidas_items WHERE salida_id = :id");
            $stmtItems->execute(['id' => $id]);
            $items = $stmtItems->fetchAll();

            foreach ($items as $item) {
                $stmtStock = $pdo->prepare("UPDATE inventario SET cantidad = cantidad + :cant WHERE id = :pid");
                $stmtStock->execute(['cant' => (int)$item['cantidad'], 'pid' => $item['producto_id']]);
            }

            // Eliminar items y la factura (ON DELETE CASCADE también lo hace)
            $pdo->prepare("DELETE FROM salidas_items WHERE salida_id = :id")->execute(['id' => $id]);
            $pdo->prepare("DELETE FROM salidas WHERE id = :id")->execute(['id' => $id]);



            $pdo->commit();
            echo json_encode(["success" => true, "message" => "Factura eliminada. Stock repuesto correctamente."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;
}

