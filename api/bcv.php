<?php
// api/bcv.php - Servicio de Tasa Oficial BCV (Hoy, Mañana y Personalizada)
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
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
            $today = date('Y-m-d');
            
            // 1. Buscar si ya tenemos la tasa almacenada hoy en BD
            $stmt = $pdo->prepare("SELECT * FROM tasa_bcv WHERE fecha = :fecha LIMIT 1");
            $stmt->execute(['fecha' => $today]);
            $row = $stmt->fetch();

            if ($row && (float)$row['tasa_hoy'] > 0) {
                echo json_encode([
                    "success" => true,
                    "data" => [
                        "tasaHoy" => (float)$row['tasa_hoy'],
                        "tasaManana" => $row['tasa_manana'] ? (float)$row['tasa_manana'] : null,
                        "fecha" => $row['fecha'],
                        "fuente" => $row['fuente'] ?? 'BCV',
                        "updatedAt" => $row['updated_at']
                    ]
                ]);
                exit;
            }

            // 2. Si no hay tasa guardada hoy, consultar API BCV en vivo
            $rateData = fetchBCVOnline();
            $tasaHoy = $rateData['tasaHoy'] ?? 791.32;
            $tasaManana = $rateData['tasaManana'] ?? null;
            $fuente = $rateData['fuente'] ?? 'BCV (Oficial)';

            // Guardar en la base de datos
            $stmtUpd = $pdo->prepare("INSERT INTO tasa_bcv (fecha, tasa_hoy, tasa_manana, fuente) 
                VALUES (:fecha, :hoy, :manana, :fuente) 
                ON DUPLICATE KEY UPDATE tasa_hoy = :hoy2, tasa_manana = :manana2, fuente = :fuente2");
            $stmtUpd->execute([
                'fecha' => $today,
                'hoy' => $tasaHoy,
                'manana' => $tasaManana,
                'fuente' => $fuente,
                'hoy2' => $tasaHoy,
                'manana2' => $tasaManana,
                'fuente2' => $fuente
            ]);

            echo json_encode([
                "success" => true,
                "data" => [
                    "tasaHoy" => $tasaHoy,
                    "tasaManana" => $tasaManana,
                    "fecha" => $today,
                    "fuente" => $fuente,
                    "updatedAt" => date('Y-m-d H:i:s')
                ]
            ]);

        } catch (Exception $e) {
            // Fallback: buscar la tasa más reciente registrada en BD
            try {
                $stmtLast = $pdo->query("SELECT * FROM tasa_bcv ORDER BY fecha DESC LIMIT 1");
                $lastRow = $stmtLast->fetch();
                $tasaHoy = $lastRow ? (float)$lastRow['tasa_hoy'] : 791.32;
                $tasaManana = ($lastRow && $lastRow['tasa_manana']) ? (float)$lastRow['tasa_manana'] : null;

                echo json_encode([
                    "success" => true,
                    "data" => [
                        "tasaHoy" => $tasaHoy,
                        "tasaManana" => $tasaManana,
                        "fecha" => $lastRow['fecha'] ?? date('Y-m-d'),
                        "fuente" => "BCV (Caché / Fallback)",
                        "error" => $e->getMessage()
                    ]
                ]);
            } catch (Exception $e2) {
                echo json_encode([
                    "success" => true,
                    "data" => [
                        "tasaHoy" => 791.32,
                        "tasaManana" => null,
                        "fecha" => date('Y-m-d'),
                        "fuente" => "BCV (Predeterminada)"
                    ]
                ]);
            }
        }
        break;

    case 'POST':
        // Establecer / modificar tasa manualmente
        $input = json_decode(file_get_contents("php://input"), true);
        if (!$input || empty($input['tasaHoy'])) {
            echo json_encode(["success" => false, "error" => "El valor de la Tasa BCV es requerido."]);
            exit;
        }

        try {
            $today = !empty($input['fecha']) ? $input['fecha'] : date('Y-m-d');
            $tasaHoy = (float)$input['tasaHoy'];
            $tasaManana = !empty($input['tasaManana']) ? (float)$input['tasaManana'] : null;
            $fuente = !empty($input['fuente']) ? trim($input['fuente']) : 'BCV (Personalizada)';

            $stmt = $pdo->prepare("INSERT INTO tasa_bcv (fecha, tasa_hoy, tasa_manana, fuente) 
                VALUES (:fecha, :hoy, :manana, :fuente) 
                ON DUPLICATE KEY UPDATE tasa_hoy = :hoy2, tasa_manana = :manana2, fuente = :fuente2");
            $stmt->execute([
                'fecha' => $today,
                'hoy' => $tasaHoy,
                'manana' => $tasaManana,
                'fuente' => $fuente,
                'hoy2' => $tasaHoy,
                'manana2' => $tasaManana,
                'fuente2' => $fuente
            ]);

            echo json_encode([
                "success" => true,
                "message" => "Tasa BCV actualizada correctamente.",
                "data" => [
                    "tasaHoy" => $tasaHoy,
                    "tasaManana" => $tasaManana,
                    "fecha" => $today,
                    "fuente" => $fuente
                ]
            ]);
        } catch (Exception $e) {
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(["success" => false, "error" => "Método no soportado."]);
        break;
}

// ── Función auxiliar para consultar servicios de Tasa BCV en vivo ──────────
function fetchBCVOnline() {
    $tasaHoy = 791.32; // Tasa por defecto de contingencia
    $tasaManana = null;
    $fuente = 'BCV (Oficial)';

    // Intentar Servicio 1: ve.dolarapi.com
    $ch = curl_init('https://ve.dolarapi.com/v1/dolares/oficial');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $res) {
        $json = json_decode($res, true);
        if (!empty($json['promedio']) && is_numeric($json['promedio'])) {
            $tasaHoy = (float)$json['promedio'];
            return [
                'tasaHoy' => $tasaHoy,
                'tasaManana' => null,
                'fuente' => 'BCV (DolarApi Oficial)'
            ];
        }
    }

    // Intentar Servicio 2: pydolarvenezuela API
    $ch2 = curl_init('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv');
    curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch2, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);
    $res2 = curl_exec($ch2);
    $httpCode2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    curl_close($ch2);

    if ($httpCode2 === 200 && $res2) {
        $json2 = json_decode($res2, true);
        if (!empty($json2['moneda']['usd']['price'])) {
            $tasaHoy = (float)$json2['moneda']['usd']['price'];
        }
    }

    return [
        'tasaHoy' => $tasaHoy,
        'tasaManana' => $tasaManana,
        'fuente' => $fuente
    ];
}
