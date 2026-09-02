-- Esquema de Base de Datos para Sistema de Inventario
-- Compatible con Laragon (MySQL local) y TiDB Serverless (Nube)

CREATE DATABASE IF NOT EXISTS `inventario_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `inventario_db`;

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar usuario por defecto (admin / admin)
INSERT INTO `usuarios` (`username`, `email`, `password_hash`) 
SELECT 'admin', 'admin@inventario.com', '$2y$10$45zD.5xXvS8hU3Z0g/1J2.R0N5GZlC.S4w6B1x4M6r6W5y5n5W5eS'
WHERE NOT EXISTS (SELECT 1 FROM `usuarios` WHERE `username` = 'admin');

-- Tabla de Inventario / Productos
CREATE TABLE IF NOT EXISTS `inventario` (
    `id` VARCHAR(50) PRIMARY KEY,
    `nombre` VARCHAR(150) NOT NULL,
    `cantidad` INT NOT NULL DEFAULT 0,
    `costo_unitario` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `precio_venta1` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `precio_venta2` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `precio_venta3` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `precio_unitario` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de Entradas (Facturas de Proveedores)
CREATE TABLE IF NOT EXISTS `entradas` (
    `id` VARCHAR(50) PRIMARY KEY,
    `proveedor_name` VARCHAR(150) NOT NULL,
    `factura_number` VARCHAR(100) NOT NULL,
    `total_factura` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `tasa_bcv_factura` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `subtotal_factura` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `saldo_adeudado` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `fecha` DATE NOT NULL,
    `observaciones` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Detalle de Productos en Entradas
CREATE TABLE IF NOT EXISTS `entradas_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `entrada_id` VARCHAR(50) NOT NULL,
    `producto_id` VARCHAR(50) NOT NULL,
    `producto_nombre` VARCHAR(150) NOT NULL,
    `cantidad` INT NOT NULL,
    `costo_unitario` DECIMAL(10, 2) NOT NULL,
    INDEX (`entrada_id`),
    CONSTRAINT `fk_entradas_items_entrada` FOREIGN KEY (`entrada_id`) REFERENCES `entradas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Abonos a Proveedores (Entradas)
CREATE TABLE IF NOT EXISTS `abonos_entradas` (
    `id` VARCHAR(50) PRIMARY KEY,
    `entrada_id` VARCHAR(50) NOT NULL,
    `monto_usd` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `monto_ves` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `referencia` VARCHAR(100) NULL,
    `fecha` DATE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (`entrada_id`),
    CONSTRAINT `fk_abonos_entradas_entrada` FOREIGN KEY (`entrada_id`) REFERENCES `entradas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de Salidas (Despachos / Ventas / Facturación tipo Talonario)
CREATE TABLE IF NOT EXISTS `salidas` (
    `id` VARCHAR(50) PRIMARY KEY,
    `tipo_documento` VARCHAR(50) NOT NULL DEFAULT 'ORDEN DE ENTREGA',
    `cliente_name` VARCHAR(150) NOT NULL,
    `cedula_rif` VARCHAR(50) NULL,
    `telefono` VARCHAR(50) NULL,
    `direccion` TEXT NULL,
    `vendedor_name` VARCHAR(150) NOT NULL DEFAULT 'General',
    `factura_number` VARCHAR(100) NOT NULL,
    `total_unidades` INT NOT NULL DEFAULT 0,
    `total_factura` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `saldo_adeudado` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `fecha` DATE NOT NULL,
    `observaciones` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Detalle de Productos en Salidas
CREATE TABLE IF NOT EXISTS `salidas_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `salida_id` VARCHAR(50) NOT NULL,
    `producto_id` VARCHAR(50) NOT NULL,
    `producto_nombre` VARCHAR(150) NOT NULL,
    `cantidad` INT NOT NULL,
    `costo_unitario` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `precio_unitario` DECIMAL(10, 2) NOT NULL,
    INDEX (`salida_id`),
    CONSTRAINT `fk_salidas_items_salida` FOREIGN KEY (`salida_id`) REFERENCES `salidas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Abonos de Clientes (Salidas)
CREATE TABLE IF NOT EXISTS `abonos_salidas` (
    `id` VARCHAR(50) PRIMARY KEY,
    `salida_id` VARCHAR(50) NOT NULL,
    `cliente_name` VARCHAR(150) NOT NULL,
    `monto_usd` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `monto_ves` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `referencia` VARCHAR(100) NULL,
    `fecha` DATE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (`cliente_name`),
    CONSTRAINT `fk_abonos_salidas_salida` FOREIGN KEY (`salida_id`) REFERENCES `salidas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
