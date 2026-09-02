<?php
// index.php - Enrutador Principal del Sistema
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$route = $_GET['route'] ?? 'dashboard';

// Si la ruta es login, cargar la vista de login directamente
if ($route === 'login') {
    require_once __DIR__ . '/views/login.php';
    exit;
}

// Proteger rutas: Si no hay sesión iniciada y la ruta no es login, redirigir a login
if (!isset($_SESSION['user']) && $route !== 'login') {
    header("Location: index.php?route=login");
    exit;
}

// Si ya inició sesión e intenta acceder a la pantalla de login, ir a dashboard
if (isset($_SESSION['user']) && $route === 'login') {
    header("Location: index.php?route=dashboard");
    exit;
}

// Cargar vista solicitada
require_once __DIR__ . '/includes/header.php';
require_once __DIR__ . '/includes/sidebar.php';

switch ($route) {
    case 'inventario':
        require_once __DIR__ . '/views/inventario.php';
        break;
    case 'entradas':
        require_once __DIR__ . '/views/entradas.php';
        break;
    case 'salidas':
        require_once __DIR__ . '/views/salidas.php';
        break;
    case 'reportes':
        require_once __DIR__ . '/views/reportes.php';
        break;
    case 'dashboard':
    default:
        require_once __DIR__ . '/views/dashboard.php';
        break;
}

require_once __DIR__ . '/includes/footer.php';
