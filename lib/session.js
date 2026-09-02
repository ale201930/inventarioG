// lib/session.js - Manejo de sesiones con iron-session (equivale a $_SESSION de PHP)
import { getIronSession } from 'iron-session';

export const sessionOptions = {
  password: process.env.SESSION_SECRET || 'invg-pro-session-secret-32-chars!!',
  cookieName: 'invg_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 días
  },
};

export async function getSession(req, res) {
  return getIronSession(req, res, sessionOptions);
}
