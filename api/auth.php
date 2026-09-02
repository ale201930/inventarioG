<?php
// api/auth.php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();
require_once __DIR__ . '/../config/database.php';

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents("php://input"), true) ?: $_POST;

switch ($action) {
    case 'login':
        $emailOrUsername = trim($input['email'] ?? '');
        $password = trim($input['password'] ?? '');

        if (empty($emailOrUsername) || empty($password)) {
            echo json_encode(["success" => false, "error" => "Debes ingresar usuario/correo y contraseña."]);
            exit;
        }

        // 1. Fallback local: admin / admin
        if (($emailOrUsername === 'admin' || $emailOrUsername === 'admin@admin.com') && $password === 'admin') {
            $_SESSION['user'] = [
                'id' => 'admin-1',
                'username' => 'admin',
                'email' => 'admin@admin.com'
            ];
            echo json_encode([
                "success" => true,
                "user" => $_SESSION['user']
            ]);
            exit;
        }

        // 2. Comprobar en base de datos
        try {
            $pdo = getPDOConnection();
            $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE username = :val OR email = :val LIMIT 1");
            $stmt->execute(['val' => $emailOrUsername]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password_hash'])) {
                $_SESSION['user'] = [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'email' => $user['email']
                ];
                echo json_encode([
                    "success" => true,
                    "user" => $_SESSION['user']
                ]);
            } else {
                echo json_encode(["success" => false, "error" => "Credenciales incorrectas."]);
            }
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => "Error de inicio de sesión: " . $e->getMessage()]);
        }
        break;

    case 'logout':
        session_destroy();
        echo json_encode(["success" => true, "message" => "Sesión cerrada correctamente."]);
        break;

    case 'check':
        if (isset($_SESSION['user'])) {
            echo json_encode(["authenticated" => true, "user" => $_SESSION['user']]);
        } else {
            echo json_encode(["authenticated" => false]);
        }
        break;

    default:
        echo json_encode(["success" => false, "error" => "Acción no válida"]);
        break;
}
