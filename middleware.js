// middleware.js - Protección de rutas del sistema
import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Rutas de API, archivos estáticos y recursos públicos NUNCA se redirigen a HTML de login
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    pathname === '/logo.png' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  const userCookie = request.cookies.get('invg_user')?.value;

  // Si está en /login y ya inició sesión, redirigir al panel principal /
  if (pathname === '/login' || pathname.startsWith('/login')) {
    if (userCookie) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Si NO inició sesión y quiere entrar a cualquier página web del sistema, redirigir obligatoriamente a /login
  if (!userCookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logo.png|icon.png).*)'],
};
