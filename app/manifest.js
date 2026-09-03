export default function manifest() {
  return {
    name: "Besteda 2, C.A. - Sistema de Inventario",
    short_name: "Besteda 2",
    description: "Sistema de Control de Inventarios, Ventas, Compras y Proveedores — Besteda 2, C.A.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0284c7",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable any"
      }
    ]
  };
}
