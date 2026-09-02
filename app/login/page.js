// app/login/page.js — Login que usa api/auth (MySQL/cookie) en lugar de Firebase
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, username: identifier, password }),
      });
      const d = await res.json();
      if (d.success) {
        router.push('/');
      } else {
        setError(d.error || 'Credenciales incorrectas.');
      }
    } catch {
      setError('Error de conexión. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(2,132,199,0.15)',
        padding: '2.5rem 2rem', width: '100%', maxWidth: 400,
        border: '1px solid #e0f2fe'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64, background: 'linear-gradient(135deg,#0284c7 0%,#38bdf8 100%)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(2,132,199,0.3)',
            fontSize: '2rem'
          }}>📦</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Inv<span style={{ color: '#0284c7' }}>G</span>{' '}
            <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>PRO</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Sistema de Control de Inventario
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>BESTEDA 2, C.A.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.4rem' }}>
              Usuario o Correo Electrónico
            </label>
            <input
              type="text"
              id="identifier"
              required
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="admin o correo@dominio.com"
              style={{
                width: '100%', padding: '0.7rem 1rem', border: '1px solid #e2e8f0', borderRadius: 10,
                fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s',
                background: '#f8fafc', color: '#0f172a'
              }}
              onFocus={e => e.target.style.borderColor = '#0284c7'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.4rem' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                id="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '0.7rem 2.8rem 0.7rem 1rem', border: '1px solid #e2e8f0', borderRadius: 10,
                  fontSize: '0.95rem', outline: 'none', background: '#f8fafc', color: '#0f172a'
                }}
                onFocus={e => e.target.style.borderColor = '#0284c7'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem'
              }}>
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '0.85rem', borderRadius: 12, border: 'none',
            background: loading ? '#94a3b8' : 'linear-gradient(135deg,#0284c7 0%,#0369a1 100%)',
            color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(2,132,199,0.3)', transition: 'all 0.2s'
          }}>
            {loading ? '⏳ Iniciando sesión...' : '🔐 Iniciar Sesión'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.78rem', color: '#94a3b8' }}>
          <p>InvG PRO v2.0 · BESTEDA 2, C.A.</p>
          <p style={{ marginTop: '0.25rem', fontSize: '0.72rem' }}>Acceso seguro con credenciales del sistema</p>
        </div>
      </div>
    </div>
  );
}
