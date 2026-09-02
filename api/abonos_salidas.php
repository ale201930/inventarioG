<?php
// api/abonos_salidas.php
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
require_once __DIR__ . '/salidas.php'; // Para usar recalculateSalidaSaldo()

$pdo = getPDOConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        try {
            $stmt = $pdo->query("SELECT * FROM abonos_salidas ORDER BY fecha ASC");
            $abonos = $stmt->fetchAll();
            echo json_encode(["success" => true, "data" => $abonos]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents("php://input"), true);
        if (empty($input['clienteName']) || empty($input['salidaId']) || !isset($input['montoUSD'])) {
            echo json_encode(["success" => false, "error" => "Factura, Cliente y Monto son requeridos."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $id = !empty($input['id']) ? $input['id'] : 'absal_' . bin2hex(random_bytes(4));
            $salidaId = trim($input['salidaId']);
            $clienteName = trim($input['clienteName']);
            $montoUSD = (float)$input['montoUSD'];
            $montoVES = (float)($input['montoVES'] ?? 0);
            $referencia = trim($input['referencia'] ?? '');
            $fecha = !empty($input['fecha']) ? $input['fecha'] : date('Y-m-d');

            // Insertar abono con salida_id
            $stmt = $pdo->prepare("INSERT INTO abonos_salidas (id, salida_id, cliente_name, monto_usd, monto_ves, referencia, fecha) VALUES (:id, :salida_id, :cliente, :usd, :ves, :ref, :fecha)");
            $stmt->execute([
                'id' => $id,
                'salida_id' => $salidaId,
                'cliente' => $clienteName,
                'usd' => $montoUSD,
                'ves' => $montoVES,
                'ref' => $referencia,
                'fecha' => $fecha
            ]);

            // Recalcular saldo adeudado de la factura específica
            recalculateSalidaSaldo($pdo, $salidaId);

            $pdo->commit();
            echo json_encode(["success" => true, "message" => "Abono registrado para la factura."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents("php://input"), true);
        if (empty($input['id']) || empty($input['salidaId'])) {
            echo json_encode(["success" => false, "error" => "ID y ID de factura son requeridos."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("UPDATE abonos_salidas SET fecha = :fecha, referencia = :ref, monto_ves = :ves, monto_usd = :usd WHERE id = :id");
            $stmt->execute([
                'fecha' => $input['fecha'],
                'ref' => trim($input['referencia'] ?? ''),
                'ves' => (float)($input['montoVES'] ?? 0),
                'usd' => (float)($input['montoUSD'] ?? 0),
                'id' => $input['id']
            ]);

            recalculateSalidaSaldo($pdo, $input['salidaId']);

            $pdo->commit();
            echo json_encode(["success" => true, "message" => "Abono actualizado correctamente."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? '';
        $salidaId = $_GET['salidaId'] ?? '';

        if (empty($id)) {
            $input = json_decode(file_get_contents("php://input"), true);
            $id = $input['id'] ?? '';
            $salidaId = $input['salidaId'] ?? '';
        }

        if (empty($id) || empty($salidaId)) {
            echo json_encode(["success" => false, "error" => "ID de abono y ID de factura requeridos."]);
            exit;
        }

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("DELETE FROM abonos_salidas WHERE id = :id");
            $stmt->execute(['id' => $id]);

            recalculateSalidaSaldo($pdo, $salidaId);

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
