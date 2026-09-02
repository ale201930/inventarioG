// app/api/bcv/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

async function fetchBCVOnline() {
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { next: { revalidate: 3600 } });
    if (res.ok) {
      const json = await res.json();
      if (json?.promedio) return { tasaHoy: parseFloat(json.promedio), fuente: 'BCV (DolarApi Oficial)' };
    }
  } catch {}

  try {
    const res2 = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv', { next: { revalidate: 3600 } });
    if (res2.ok) {
      const json2 = await res2.json();
      const precio = json2?.moneda?.usd?.price || json2?.monitors?.usd?.price;
      if (precio) return { tasaHoy: parseFloat(precio), fuente: 'BCV (PyDolar)' };
    }
  } catch {}

  return { tasaHoy: 798.33, fuente: 'BCV (Predeterminada)' };
}

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  try {
    // Try DB cache first
    try {
      const rows = await query('SELECT * FROM tasa_bcv WHERE fecha = ? LIMIT 1', [today]);
      if (rows[0]?.tasa_hoy > 0) {
        return NextResponse.json({ success: true, data: {
          tasaHoy: parseFloat(rows[0].tasa_hoy),
          tasaManana: rows[0].tasa_manana ? parseFloat(rows[0].tasa_manana) : null,
          fecha: rows[0].fecha, fuente: rows[0].fuente || 'BCV'
        }});
      }
    } catch {}

    // Fetch live
    const { tasaHoy, fuente } = await fetchBCVOnline();

    // Save to DB
    try {
      await query(
        `INSERT INTO tasa_bcv (fecha, tasa_hoy, fuente) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE tasa_hoy=VALUES(tasa_hoy), fuente=VALUES(fuente)`,
        [today, tasaHoy, fuente]
      );
    } catch {}

    return NextResponse.json({ success: true, data: { tasaHoy, fecha: today, fuente } });
  } catch (e) {
    // Final fallback
    try {
      const rows = await query('SELECT * FROM tasa_bcv ORDER BY fecha DESC LIMIT 1');
      const tasaHoy = rows[0] ? parseFloat(rows[0].tasa_hoy) : 798.33;
      return NextResponse.json({ success: true, data: { tasaHoy, fecha: rows[0]?.fecha || today, fuente: 'BCV (Caché)' } });
    } catch {
      return NextResponse.json({ success: true, data: { tasaHoy: 798.33, fecha: today, fuente: 'BCV (Predeterminada)' } });
    }
  }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!input?.tasaHoy) return NextResponse.json({ success: false, error: 'Tasa requerida.' });
    const fecha = input.fecha || new Date().toISOString().split('T')[0];
    await query(
      `INSERT INTO tasa_bcv (fecha, tasa_hoy, tasa_manana, fuente) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tasa_hoy=VALUES(tasa_hoy), tasa_manana=VALUES(tasa_manana), fuente=VALUES(fuente)`,
      [fecha, parseFloat(input.tasaHoy), input.tasaManana ? parseFloat(input.tasaManana) : null, input.fuente || 'BCV (Personalizada)']
    );
    return NextResponse.json({ success: true, message: 'Tasa actualizada.', data: { tasaHoy: parseFloat(input.tasaHoy), fecha } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
