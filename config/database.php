<?php
// config/database.php
// Configuración de conexión PDO a MySQL (Laragon local) o TiDB Serverless (Nube)

function getPDOConnection() {
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    // Cargar archivo .env si existe
    $envPath = __DIR__ . '/../.env';
    if (file_exists($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (!$line || strpos($line, '#') === 0) continue;
            if (strpos($line, '=') !== false) {
                list($name, $value) = explode('=', $line, 2);
                $name = trim($name);
                $value = trim($value, " \t\n\r\0\x0B\"'");
                if ($name && getenv($name) === false) {
                    putenv("{$name}={$value}");
                    $_ENV[$name] = $value;
                    $_SERVER[$name] = $value;
                }
            }
        }
    }

    $host = '127.0.0.1';
    $port = '3306';
    $dbname = 'inventario_db';
    $username = 'root';
    $password = '';
    $useSSL = false;

    // Detectar si TiDB Cloud inyectó DATABASE_URL
    $databaseUrl = getenv('DATABASE_URL') ?: (getenv('TIDB_DATABASE_URL') ?: '');
    if ($databaseUrl) {
        $parsed = parse_url($databaseUrl);
        if ($parsed) {
            $host = $parsed['host'] ?? $host;
            $port = isset($parsed['port']) ? (string)$parsed['port'] : '4000';
            $username = $parsed['user'] ?? $username;
            $password = isset($parsed['pass']) ? urldecode($parsed['pass']) : $password;
            $dbname = isset($parsed['path']) ? ltrim($parsed['path'], '/') : $dbname;
            $useSSL = true;
        }
    } else {
        $host = getenv('TIDB_HOST') ?: (getenv('DB_HOST') ?: '127.0.0.1');
        $port = getenv('TIDB_PORT') ?: (getenv('DB_PORT') ?: '3306');
        $dbname = getenv('TIDB_DATABASE') ?: (getenv('DB_NAME') ?: 'inventario_db');
        $username = getenv('TIDB_USER') ?: (getenv('DB_USER') ?: 'root');
        $password = getenv('TIDB_PASSWORD') !== false ? getenv('TIDB_PASSWORD') : (getenv('DB_PASS') !== false ? getenv('DB_PASS') : '');
        $useSSL = getenv('DB_SSL') === 'true' || getenv('DB_SSL') === '1' || getenv('TIDB_HOST') !== false || strpos($host, 'tidbcloud.com') !== false;
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    if ($useSSL) {
        $caPath = getenv('DB_SSL_CA') ?: null;
        if ($caPath && file_exists($caPath)) {
            $options[PDO::MYSQL_ATTR_SSL_CA] = $caPath;
        } else {
            $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
        }
    }

    try {
        $pdo = new PDO($dsn, $username, $password, $options);
        
        // Auto-creación de tablas si es la primera conexión en la nube (TiDB)
        try {
            $checkTable = $pdo->query("SHOW TABLES LIKE 'inventario'");
            if ($checkTable && $checkTable->rowCount() === 0) {
                $schemaFile = __DIR__ . '/../schema.sql';
                if (file_exists($schemaFile)) {
                    $sql = file_get_contents($schemaFile);
                    if ($sql) $pdo->exec($sql);
                }
            }
        } catch (Exception $e1) {
            // Ignorar advertencias si las tablas ya existen
        }
        
        // Auto-migración de columnas para Facturación 80mm - agrega si no existen
        $migraciones = [
            "ALTER TABLE salidas ADD COLUMN tipo_documento VARCHAR(50) NOT NULL DEFAULT 'ORDEN DE ENTREGA'",
            "ALTER TABLE salidas ADD COLUMN cedula_rif VARCHAR(50) NULL",
            "ALTER TABLE salidas ADD COLUMN telefono VARCHAR(50) NULL",
            "ALTER TABLE salidas ADD COLUMN direccion TEXT NULL",
            "ALTER TABLE salidas ADD COLUMN total_unidades INT NOT NULL DEFAULT 0",
            "ALTER TABLE abonos_salidas ADD COLUMN salida_id VARCHAR(50) NULL",
            "ALTER TABLE abonos_salidas ADD CONSTRAINT fk_abonos_salidas_salida FOREIGN KEY (salida_id) REFERENCES salidas(id) ON DELETE CASCADE"
        ];
        foreach ($migraciones as $sql) {
            try { $pdo->exec($sql); } catch (Exception $e) { /* columna ya existe, ignorar */ }
        }

        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => "Error de conexión a la Base de Datos: " . $e->getMessage()
        ]);
        exit;
    }
}
