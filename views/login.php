<?php
// views/login.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_destroy();
    header("Location: index.php?route=login");
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iniciar Sesión - Sistema de Inventario</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/main.css">
    <style>
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #e0f2fe 0%, #f8fafc 100%);
        }
        .login-card {
            width: 100%;
            max-width: 400px;
            padding: 2.5rem;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            background: #ffffff;
            border: 1px solid var(--border-color);
        }
    </style>
</head>
<body>
    <div class="login-card">
        <div style="text-align: center; margin-bottom: 2rem;">
            <img src="public/logo.png" alt="Logo InvG" style="width: 72px; height: 72px; border-radius: 16px; object-fit: cover; margin-bottom: 1rem; box-shadow: 0 4px 14px rgba(2,132,199,0.35);">
            <h1 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">InvG <span style="color: #0284c7;">PRO</span></h1>
            <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 0.25rem;">Sistema de Control de Inventario y Ventas</p>
        </div>

        <div id="loginError" class="badge badge-danger" style="display: none; width: 100%; padding: 0.65rem; margin-bottom: 1rem; text-align: center; justify-content: center;"></div>

        <form id="loginForm">
            <div class="form-group">
                <label class="form-label">Usuario / Correo</label>
                <input type="text" id="loginUser" class="form-control" placeholder="admin" required value="admin">
            </div>
            <div class="form-group">
                <label class="form-label">Contraseña</label>
                <input type="password" id="loginPass" class="form-control" placeholder="••••••••" required value="admin">
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.75rem;">
                Entrar al Sistema <i class="fa-solid fa-arrow-right-to-bracket"></i>
            </button>
        </form>
    </div>

    <script src="assets/js/api.js"></script>
    <script src="assets/js/auth.js"></script>
</body>
</html>
