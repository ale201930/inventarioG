<?php
// api/entradas.php - API de Compras / Entradas de Proveedores con Tasa BCV y Control de Stock
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
            $id = $_GET['id'] ?? null;
            if ($id) {
                $stmt = $pdo->prepare("SELECT * FROM entradas WHERE id = :id");
                $stmt->execute(['id' => $id]);
                $entrada = $stmt->fetch();

                if ($entrada) {
                    $stmtItems = $pdo->prepare("SELECT * FROM entradas_items WHERE entrada_id = :id");
                    $stmtItems->execute(['id' => $id]);
                    $entrada['items'] = $stmtItems->fetchAll();

                    $stmtAbonos = $pdo->prepare("SELECT * FROM abonos_entradas WHERE entrada_id = :id ORDER BY fecha ASC");
                    $stmtAbonos->execute(['id' => $id]);
                    $entrada['abonos'] = $stmtAbonos->fetchAll();
                }

                echo json_encode(["success" => true, "data" => $entrada]);
                exit;
            }

            $stmt = $pdo->query("SELECT * FROM entradas ORDER BY fecha DESC, created_at DESC");
            $entradas = $stmt->fetchAll();

            foreach ($entradas as &$entrada) {
                $stmtItems = $pdo->prepare("SELECT * FROM entradas_items WHERE entrada_id = :id");
                $stmtItems->execute(['id' => $entrada['id']]);
                $entrada['items'] = $stmtItems->fetchAll();

                $stmtAbonos = $pdo->prepare("SELECT * FROM abonos_entradas WHERE entrada_id = :id ORDER BY fecha ASC");
                $stmtAbonos->execute(['id' => $entrada['id']]);
                $entrada['abonos'] = $stmtAbonos->fetchAll();
            }

            echo json_encode(["success" => true, "data" => $entradas]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents("php://input"), true);
        if (!$input || empty($input['proveedorName']) || empty($input['numeroDocumento'])) {
            echo json_encode(["success" => false, "error" => "El Proveedor y el Nº de Documento son obligatorios."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $id = !empty($input['id']) ? $input['id'] : 'ent_' . bin2hex(random_bytes(4));
            $proveedorName = trim($input['proveedorName']);
            $proveedorRif = trim($input['proveedorRif'] ?? '');
            $proveedorTelf = trim($input['proveedorTelefono'] ?? '');
            $proveedorDir = trim($input['proveedorDireccion'] ?? '');
            
            $tipoDoc = trim($input['tipoDocumento'] ?? 'NOTA DE ENTREGA');
            $numDoc = trim($input['numeroDocumento']);
            $fecha = !empty($input['fecha']) ? $input['fecha'] : date('Y-m-d');
            $fechaVenc = !empty($input['fechaVencimiento']) ? $input['fechaVencimiento'] : null;
            
            $tasaBCV = (float)($input['tasaBCV'] ?? 791.32);
            $totalUSD = (float)($input['totalUSD'] ?? 0);
            $totalVES = (float)($input['totalVES'] ?? ($totalUSD * $tasaBCV));
            
            $saldoAdeudadoUSD = $totalUSD;
            $saldoAdeudadoVES = $totalVES;
            
            $observaciones = trim($input['observaciones'] ?? '');
            $items = $input['items'] ?? [];

            if (empty($items)) {
                throw new Exception("Debes incluir al menos un producto en la compra.");
            }

            // 1. Insertar en tabla `entradas`
            $stmt = $pdo->prepare("INSERT INTO entradas 
                (id, proveedor_name, proveedor_rif, proveedor_telefono, proveedor_direccion, factura_number, tipo_documento, numero_documento, fecha, fecha_vencimiento, tasa_bcv, total_factura, total_usd, total_ves, saldo_adeudado, saldo_adeudado_usd, saldo_adeudado_ves, observaciones) 
                VALUES 
                (:id, :pnom, :prif, :ptelf, :pdir, :fnum, :tipo, :numdoc, :fecha, :fvenc, :tasa, :tot_fact, :tot_usd, :tot_ves, :saldo_adeud, :saldo_usd, :saldo_ves, :obs)");
            
            $stmt->execute([
                'id' => $id,
                'pnom' => $proveedorName,
                'prif' => $proveedorRif,
                'ptelf' => $proveedorTelf,
                'pdir' => $proveedorDir,
                'fnum' => $numDoc,
                'tipo' => $tipoDoc,
                'numdoc' => $numDoc,
                'fecha' => $fecha,
                'fvenc' => $fechaVenc,
                'tasa' => $tasaBCV,
                'tot_fact' => $totalUSD,
                'tot_usd' => $totalUSD,
                'tot_ves' => $totalVES,
                'saldo_adeud' => $saldoAdeudadoUSD,
                'saldo_usd' => $saldoAdeudadoUSD,
                'saldo_ves' => $saldoAdeudadoVES,
                'obs' => $observaciones
            ]);

            // 2. Insertar cada ítem y actualizar / crear el producto en `inventario`
            foreach ($items as $item) {
                $codigo = trim($item['codigoProducto'] ?? '');
                $prodNombre = trim($item['productoNombre'] ?? '');
                $cant = (int)($item['cantidad'] ?? 0);
                $costoUSD = (float)($item['costoUnitarioUSD'] ?? 0);
                $costoVES = (float)($item['costoUnitarioVES'] ?? ($costoUSD * $tasaBCV));
                $subUSD = (float)($item['subtotalUSD'] ?? ($cant * $costoUSD));
                $subVES = (float)($item['subtotalVES'] ?? ($subUSD * $tasaBCV));

                if (empty($prodNombre) || $cant <= 0) continue;

                // Buscar producto existente por código o nombre en `inventario`
                $prodExistente = null;
                if (!empty($codigo)) {
                    $stmtSearchCode = $pdo->prepare("SELECT * FROM inventario WHERE (codigo_producto IS NOT NULL AND codigo_producto != '' AND LOWER(TRIM(codigo_producto)) = LOWER(TRIM(:code1))) OR id = :code2 LIMIT 1");
                    $stmtSearchCode->execute(['code1' => $codigo, 'code2' => $codigo]);
                    $prodExistente = $stmtSearchCode->fetch();
                }

                if (!$prodExistente) {
                    $stmtSearchName = $pdo->prepare("SELECT * FROM inventario WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:nom)) LIMIT 1");
                    $stmtSearchName->execute(['nom' => $prodNombre]);
                    $prodExistente = $stmtSearchName->fetch();
                }

                if ($prodExistente) {
                    $prodId = $prodExistente['id'];
                    $nuevaCant = (int)$prodExistente['cantidad'] + $cant;

                    $stmtUpd = $pdo->prepare("UPDATE inventario SET 
                        cantidad = :cant, 
                        costo_unitario = :costo_usd, 
                        costo_unitario_ves = :costo_ves,
                        codigo_producto = IF(codigo_producto IS NULL OR codigo_producto = '', :code, codigo_producto)
                        WHERE id = :pid");
                    
                    $stmtUpd->execute([
                        'cant' => $nuevaCant,
                        'costo_usd' => $costoUSD,
                        'costo_ves' => $costoVES,
                        'code' => $codigo,
                        'pid' => $prodId
                    ]);
                } else {
                    // Crear nuevo producto en inventario
                    $prodId = !empty($codigo) ? 'prod_' . strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $codigo)) : 'prod_' . bin2hex(random_bytes(3));
                    $stmtIns = $pdo->prepare("INSERT INTO inventario 
                        (id, codigo_producto, nombre, cantidad, costo_unitario, costo_unitario_ves, precio_unitario, precio_unitario_ves) 
                        VALUES 
                        (:pid, :code, :pnom, :cant, :costo_usd, :costo_ves, :precio_usd, :precio_ves)");
                    
                    $stmtIns->execute([
                        'pid' => $prodId,
                        'code' => $codigo,
                        'pnom' => $prodNombre,
                        'cant' => $cant,
                        'costo_usd' => $costoUSD,
                        'costo_ves' => $costoVES,
                        'precio_usd' => $costoUSD * 1.30, // Margen sugerido 30%
                        'precio_ves' => ($costoUSD * 1.30) * $tasaBCV
                    ]);
                }

                // Insertar renglón en `entradas_items`
                $stmtItem = $pdo->prepare("INSERT INTO entradas_items 
                    (entrada_id, producto_id, codigo_producto, producto_nombre, cantidad, costo_unitario, costo_unitario_usd, costo_unitario_ves, subtotal_usd, subtotal_ves) 
                    VALUES 
                    (:eid, :pid, :code, :pnom, :cant, :costo_unit, :costo_usd, :costo_ves, :sub_usd, :sub_ves)");
                
                $stmtItem->execute([
                    'eid' => $id,
                    'pid' => $prodId,
                    'code' => $codigo,
                    'pnom' => $prodNombre,
                    'cant' => $cant,
                    'costo_unit' => $costoUSD,
                    'costo_usd' => $costoUSD,
                    'costo_ves' => $costoVES,
                    'sub_usd' => $subUSD,
                    'sub_ves' => $subVES
                ]);
            }

            $pdo->commit();
            echo json_encode([
                "success" => true,
                "id" => $id,
                "message" => "Factura de compra procesada. Stock de inventario actualizado correctamente."
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $input = json_decode(file_get_contents("php://input"), true);
        $id = $input['id'] ?? ($_GET['id'] ?? '');

        if (empty($id)) {
            echo json_encode(["success" => false, "error" => "ID de compra requerido."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            // Obtener items para revertir stock
            $stmtItems = $pdo->prepare("SELECT * FROM entradas_items WHERE entrada_id = :id");
            $stmtItems->execute(['id' => $id]);
            $items = $stmtItems->fetchAll();

            foreach ($items as $item) {
                $pid = $item['producto_id'];
                $cant = (int)$item['cantidad'];
                $stmtUpd = $pdo->prepare("UPDATE inventario SET cantidad = GREATEST(0, cantidad - :cant) WHERE id = :pid");
                $stmtUpd->execute(['cant' => $cant, 'pid' => $pid]);
            }

            $pdo->prepare("DELETE FROM entradas_items WHERE entrada_id = :id")->execute(['id' => $id]);
            $pdo->prepare("DELETE FROM entradas WHERE id = :id")->execute(['id' => $id]);

            $pdo->commit();
            echo json_encode(["success" => true, "message" => "Compra eliminada y stock ajustado."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(["success" => false, "error" => "Método no soportado."]);
        break;
}
