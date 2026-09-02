<?php
// includes/header.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Sistema de Inventario - PWA</title>

    <!-- Meta Tags para PWA y Dispositivos Móviles -->
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#0284c7">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="InventarioG">
    <link rel="apple-touch-icon" href="public/icon-192.png">
    <link rel="icon" type="image/png" href="public/icon-192.png">

    <!-- Font Awesome Icons & CSS Principales -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/main.css">
</head>
<body>

<!-- Overlay para cerrar el menú lateral en móviles -->
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<!-- Barra Superior para Teléfonos Móviles -->
<header class="mobile-top-bar">
    <div class="mobile-brand">
        <div class="brand-icon" style="width: 32px; height: 32px; font-size: 1rem;">
            <i class="fa-solid fa-boxes-packing"></i>
        </div>
        <span>Inv<strong style="color: var(--primary);">G</strong></span>
    </div>
    <div id="bcvWidgetMobile"></div>
    <button class="mobile-nav-btn" id="mobileNavToggle" aria-label="Abrir Menú">
        <i class="fa-solid fa-bars"></i>
    </button>
</header>

<div class="app-container">
