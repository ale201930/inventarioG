<?php
// api/inventario.php
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
            $stmt = $pdo->query("SELECT * FROM inventario ORDER BY nombre ASC");
            $productos = $stmt->fetchAll();
            echo json_encode(["success" => true, "data" => $productos]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents("php://input"), true);
        if (!$input || empty($input['nombre'])) {
            echo json_encode(["success" => false, "error" => "El nombre del producto es obligatorio."]);
            exit;
        }

        try {
            $id = !empty($input['id']) ? $input['id'] : 'prod_' . bin2hex(random_bytes(4));
            $nombre = trim($input['nombre']);
            $cantidad = isset($input['cantidad']) ? (int)$input['cantidad'] : 0;
            $costoUnitario = isset($input['costoUnitario']) ? (float)$input['costoUnitario'] : 0.00;
            $precioVenta1 = isset($input['precioVenta1']) ? (float)$input['precioVenta1'] : (isset($input['precio_venta1']) ? (float)$input['precio_venta1'] : 0.00);
            $precioVenta2 = isset($input['precioVenta2']) ? (float)$input['precioVenta2'] : (isset($input['precio_venta2']) ? (float)$input['precio_venta2'] : 0.00);
            $precioVenta3 = isset($input['precioVenta3']) ? (float)$input['precioVenta3'] : (isset($input['precio_venta3']) ? (float)$input['precio_venta3'] : 0.00);
            $precioUnitario = isset($input['precioUnitario']) ? (float)$input['precioUnitario'] : ($precioVenta1 > 0 ? $precioVenta1 : 0.00);

            // Verificar si existe para actualizar o insertar
            $stmtCheck = $pdo->prepare("SELECT id FROM inventario WHERE id = :id");
            $stmtCheck->execute(['id' => $id]);

            if ($stmtCheck->fetch()) {
                $stmt = $pdo->prepare("UPDATE inventario SET nombre = :nombre, cantidad = :cantidad, costo_unitario = :costo, precio_venta1 = :pv1, precio_venta2 = :pv2, precio_venta3 = :pv3, precio_unitario = :precio WHERE id = :id");
                $stmt->execute([
                    'nombre' => $nombre,
                    'cantidad' => $cantidad,
                    'costo' => $costoUnitario,
                    'pv1' => $precioVenta1,
                    'pv2' => $precioVenta2,
                    'pv3' => $precioVenta3,
                    'precio' => $precioUnitario,
                    'id' => $id
                ]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO inventario (id, nombre, cantidad, costo_unitario, precio_venta1, precio_venta2, precio_venta3, precio_unitario) VALUES (:id, :nombre, :cantidad, :costo, :pv1, :pv2, :pv3, :precio)");
                $stmt->execute([
                    'id' => $id,
                    'nombre' => $nombre,
                    'cantidad' => $cantidad,
                    'costo' => $costoUnitario,
                    'pv1' => $precioVenta1,
                    'pv2' => $precioVenta2,
                    'pv3' => $precioVenta3,
                    'precio' => $precioUnitario
                ]);
            }

            echo json_encode(["success" => true, "data" => [
                "id" => $id,
                "nombre" => $nombre,
                "cantidad" => $cantidad,
                "costo_unitario" => $costoUnitario,
                "precio_venta1" => $precioVenta1,
                "precio_venta2" => $precioVenta2,
                "precio_venta3" => $precioVenta3,
                "precio_unitario" => $precioUnitario
            ]]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents("php://input"), true);
        if (empty($input['id'])) {
            echo json_encode(["success" => false, "error" => "ID de producto no proporcionado."]);
            exit;
        }

        try {
            $pv1 = isset($input['precioVenta1']) ? (float)$input['precioVenta1'] : (isset($input['precio_venta1']) ? (float)$input['precio_venta1'] : 0.00);
            $pv2 = isset($input['precioVenta2']) ? (float)$input['precioVenta2'] : (isset($input['precio_venta2']) ? (float)$input['precio_venta2'] : 0.00);
            $pv3 = isset($input['precioVenta3']) ? (float)$input['precioVenta3'] : (isset($input['precio_venta3']) ? (float)$input['precio_venta3'] : 0.00);
            $pu  = isset($input['precioUnitario']) ? (float)$input['precioUnitario'] : ($pv1 > 0 ? $pv1 : 0.00);

            $stmt = $pdo->prepare("UPDATE inventario SET nombre = :nombre, cantidad = :cantidad, costo_unitario = :costo, precio_venta1 = :pv1, precio_venta2 = :pv2, precio_venta3 = :pv3, precio_unitario = :precio WHERE id = :id");
            $stmt->execute([
                'nombre' => trim($input['nombre']),
                'cantidad' => (int)$input['cantidad'],
                'costo' => (float)$input['costoUnitario'],
                'pv1' => $pv1,
                'pv2' => $pv2,
                'pv3' => $pv3,
                'precio' => $pu,
                'id' => $input['id']
            ]);

            echo json_encode(["success" => true, "message" => "Producto actualizado correctamente."]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? '';
        if (empty($id)) {
            $input = json_decode(file_get_contents("php://input"), true);
            $id = $input['id'] ?? '';
        }

        if (empty($id)) {
            echo json_encode(["success" => false, "error" => "ID de producto no proporcionado."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("DELETE FROM inventario WHERE id = :id");
            $stmt->execute(['id' => $id]);
            echo json_encode(["success" => true, "message" => "Producto eliminado."]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(["success" => false, "error" => "Método no soportado."]);
        break;
}
