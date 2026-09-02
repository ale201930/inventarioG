/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/views/inventario.php', destination: '/inventario', permanent: true },
      { source: '/inventario.php', destination: '/inventario', permanent: true },
      { source: '/views/salidas.php', destination: '/salidas', permanent: true },
      { source: '/salidas.php', destination: '/salidas', permanent: true },
      { source: '/views/entradas.php', destination: '/entradas', permanent: true },
      { source: '/entradas.php', destination: '/entradas', permanent: true },
      { source: '/views/reportes.php', destination: '/reportes', permanent: true },
      { source: '/reportes.php', destination: '/reportes', permanent: true },
      { source: '/views/dashboard.php', destination: '/', permanent: true },
      { source: '/dashboard.php', destination: '/', permanent: true },
      { source: '/index.php', destination: '/', permanent: true },
      { source: '/views/login.php', destination: '/login', permanent: true },
      { source: '/login.php', destination: '/login', permanent: true },
    ];
  },
};

export default nextConfig;
