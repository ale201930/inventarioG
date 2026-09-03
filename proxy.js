// proxy.js - Protección de rutas del sistema (Next.js 16)
import { NextResponse } from 'next/server';

export default function proxy(request) {
  const { pathname } = request.nextUrl;

  // Rutas públicas que NUNCA se bloquean ni redirigen
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    pathname === '/logo.png' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  const userCookie = request.cookies.get('invg_user')?.value;

  // Si está en /login y ya tiene sesión activa, redirigir al panel principal /
  if (pathname === '/login' || pathname.startsWith('/login')) {
    if (userCookie) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Si NO tiene sesión activa y quiere entrar a cualquier página interna, redirigir obligatoriamente a /login
  if (!userCookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|logo.png|icon.png|manifest.webmanifest|manifest.json|sw.js).*)',
  ],
};
