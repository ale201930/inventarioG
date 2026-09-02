// assets/js/pwa.js
// Registro de Service Worker e Interacciones PWA / Móvil

document.addEventListener('DOMContentLoaded', () => {
  // 1. Limpieza y desregistro de Service Worker viejo para asegurar carga en vivo
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }
  }

  // 2. Control del Menú Hamburguesa en Teléfonos
  const mobileToggle = document.getElementById('mobileNavToggle');
  const sidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function openSidebar() {
    sidebar?.classList.add('mobile-open');
    sidebarOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar?.classList.remove('mobile-open');
    sidebarOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  mobileToggle?.addEventListener('click', () => {
    if (sidebar?.classList.contains('mobile-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  sidebarOverlay?.addEventListener('click', closeSidebar);

  // Cerrar menú al hacer clic en un enlace en móviles
  document.querySelectorAll('.nav-item a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });
});
