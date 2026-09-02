// app/layout.jsx — Layout Principal con Sidebar persistente idéntico al sistema PHP
import './globals.css';
import AppShell from '@/components/AppShell';

export const viewport = {
  themeColor: '#0284c7',
};

export const metadata = {
  title: 'InvG PRO - Sistema de Control de Inventario',
  description: 'Sistema de Control de Inventario, Ventas y Proveedores — BESTEDA 2 C.A.',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
