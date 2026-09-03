export default function manifest() {
  return {
    name: "InvG PRO - Sistema de Control de Inventario",
    short_name: "InvG PRO",
    description: "Sistema de Control de Inventarios, Ventas, Compras y Proveedores.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
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
