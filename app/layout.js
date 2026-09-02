import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "Sistema de Control de Inventario Premium",
  description: "Sistema cronológico de control de inventarios, entradas, salidas, deudas y abonos en dólares con fallback local.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Inventario" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
