<?php
// api/abonos_entradas.php
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
            $stmt = $pdo->query("SELECT * FROM abonos_entradas ORDER BY fecha ASC");
            $abonos = $stmt->fetchAll();
            echo json_encode(["success" => true, "data" => $abonos]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents("php://input"), true);
        if (empty($input['entradaId']) || !isset($input['montoUSD'])) {
            echo json_encode(["success" => false, "error" => "ID de entrada y monto son requeridos."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $id = !empty($input['id']) ? $input['id'] : 'abent_' . bin2hex(random_bytes(4));
            $entradaId = $input['entradaId'];
            $montoUSD = (float)$input['montoUSD'];
            $montoVES = (float)($input['montoVES'] ?? 0);
            $referencia = trim($input['referencia'] ?? '');
            $fecha = !empty($input['fecha']) ? $input['fecha'] : date('Y-m-d');

            // Insertar abono
            $stmt = $pdo->prepare("INSERT INTO abonos_entradas (id, entrada_id, monto_usd, monto_ves, referencia, fecha) VALUES (:id, :eid, :usd, :ves, :ref, :fecha)");
            $stmt->execute([
                'id' => $id,
                'eid' => $entradaId,
                'usd' => $montoUSD,
                'ves' => $montoVES,
                'ref' => $referencia,
                'fecha' => $fecha
            ]);

            // Recalcular saldo adeudado de la entrada
            recalculateEntradaSaldo($pdo, $entradaId);

            $pdo->commit();
            echo json_encode(["success" => true, "message" => "Abono a proveedor registrado con éxito."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents("php://input"), true);
        if (empty($input['id']) || empty($input['entradaId'])) {
            echo json_encode(["success" => false, "error" => "ID de abono y ID de entrada requeridos."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("UPDATE abonos_entradas SET fecha = :fecha, referencia = :ref, monto_ves = :ves, monto_usd = :usd WHERE id = :id");
            $stmt->execute([
                'fecha' => $input['fecha'],
                'ref' => trim($input['referencia'] ?? ''),
                'ves' => (float)($input['montoVES'] ?? 0),
                'usd' => (float)($input['montoUSD'] ?? 0),
                'id' => $input['id']
            ]);

            recalculateEntradaSaldo($pdo, $input['entradaId']);

            $pdo->commit();
            echo json_encode(["success" => true, "message" => "Abono actualizado correctamente."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? '';
        $entradaId = $_GET['entradaId'] ?? '';

        if (empty($id)) {
            $input = json_decode(file_get_contents("php://input"), true);
            $id = $input['id'] ?? '';
            $entradaId = $input['entradaId'] ?? '';
        }

        if (empty($id) || empty($entradaId)) {
            echo json_encode(["success" => false, "error" => "ID de abono y ID de entrada requeridos."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("DELETE FROM abonos_entradas WHERE id = :id");
            $stmt->execute(['id' => $id]);

            recalculateEntradaSaldo($pdo, $entradaId);

            $pdo->commit();
            echo json_encode(["success" => true, "message" => "Abono eliminado."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(["success" => false, "error" => "Método no soportado."]);
        break;
}

function recalculateEntradaSaldo($pdo, $entradaId) {
    $stmtE = $pdo->prepare("SELECT total_factura FROM entradas WHERE id = :eid");
    $stmtE->execute(['eid' => $entradaId]);
    $entrada = $stmtE->fetch();

    if ($entrada) {
        $totalFactura = (float)$entrada['total_factura'];
        $stmtA = $pdo->prepare("SELECT SUM(monto_usd) AS total_pagado FROM abonos_entradas WHERE entrada_id = :eid");
        $stmtA->execute(['eid' => $entradaId]);
        $abonosRow = $stmtA->fetch();
        $totalPagado = (float)($abonosRow['total_pagado'] ?? 0);
        $newSaldo = max(0, $totalFactura - $totalPagado);

        $stmtUpd = $pdo->prepare("UPDATE entradas SET saldo_adeudado = :saldo WHERE id = :eid");
        $stmtUpd->execute(['saldo' => $newSaldo, 'eid' => $entradaId]);
    }
}
