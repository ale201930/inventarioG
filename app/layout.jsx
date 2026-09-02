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
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
