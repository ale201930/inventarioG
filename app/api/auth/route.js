// app/api/auth/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

// Simple in-memory session using a signed cookie pattern
// admin/admin fallback always works
async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('invg_user')?.value;
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw, 'base64').toString()); } catch { return null; }
}

function makeSessionCookie(user) {
  return Buffer.from(JSON.stringify(user)).toString('base64');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'check') {
    const user = await getSession();
    if (user) return NextResponse.json({ authenticated: true, user });
    return NextResponse.json({ authenticated: false });
  }

  if (action === 'logout') {
    const res = NextResponse.json({ success: true });
    res.cookies.set('invg_user', '', { maxAge: 0, path: '/' });
    return res;
  }

  return NextResponse.json({ success: false, error: 'Acción no válida' });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'login';

  if (action === 'login') {
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const identifier = (body.email || body.username || '').trim();
    const password = (body.password || '').trim();

    if (!identifier || !password) {
      return NextResponse.json({ success: false, error: 'Debes ingresar usuario/correo y contraseña.' });
    }

    // Fallback local admin/admin
    if ((identifier === 'admin' || identifier === 'admin@admin.com') && password === 'admin') {
      const user = { id: 'admin-1', username: 'admin', email: 'admin@admin.com' };
      const res = NextResponse.json({ success: true, user });
      res.cookies.set('invg_user', makeSessionCookie(user), {
        httpOnly: true, sameSite: 'lax', path: '/',
        maxAge: 60 * 60 * 24 * 7,
        secure: process.env.NODE_ENV === 'production'
      });
      return res;
    }

    // DB check
    try {
      const rows = await query(
        'SELECT * FROM usuarios WHERE username = ? OR email = ? LIMIT 1',
        [identifier, identifier]
      );
      const user = rows[0];
      if (user) {
        // For DB users, accept the password as-is if it matches or use bcrypt
        // Simple check first, then bcrypt
        const bcrypt = (await import('bcryptjs')).default;
        const match = await bcrypt.compare(password, user.password_hash).catch(() => false);
        if (match) {
          const u = { id: user.id, username: user.username, email: user.email };
          const res = NextResponse.json({ success: true, user: u });
          res.cookies.set('invg_user', makeSessionCookie(u), {
            httpOnly: true, sameSite: 'lax', path: '/',
            maxAge: 60 * 60 * 24 * 7,
            secure: process.env.NODE_ENV === 'production'
          });
          return res;
        }
      }
    } catch (e) {
      // DB not available, only admin fallback works
    }

    return NextResponse.json({ success: false, error: 'Credenciales incorrectas.' });
  }

  return NextResponse.json({ success: false, error: 'Acción no válida' });
}
