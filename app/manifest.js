export default function manifest() {
  return {
    name: "Sistema de Inventario",
    short_name: "Inventario",
    description: "Sistema cronológico de control de inventarios, entradas, salidas, deudas y abonos.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0505",
    theme_color: "#ff5d00",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
