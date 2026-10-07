// app/api/bcv/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

function getVenezuelaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

async function fetchBCVOnline() {
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json?.promedio && typeof json.promedio === 'number' && json.promedio > 0) {
        return { tasaHoy: parseFloat(json.promedio), fuente: 'BCV (DolarApi Oficial)' };
      }
    }
  } catch (e) {
    console.warn('Error al consultar DolarApi Oficial:', e.message);
  }

  try {
    const res2 = await fetch('https://ve.dolarapi.com/v1/dolares', { cache: 'no-store' });
    if (res2.ok) {
      const list = await res2.json();
      const oficial = Array.isArray(list) ? list.find(x => x.fuente === 'oficial' || x.nombre?.toLowerCase().includes('oficial')) : null;
      if (oficial?.promedio && oficial.promedio > 0) {
        return { tasaHoy: parseFloat(oficial.promedio), fuente: 'BCV (DolarApi Oficial)' };
      }
    }
  } catch (e) {
    console.warn('Error al consultar DolarApi general:', e.message);
  }

  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true' || searchParams.get('refresh') === '1';
  const today = getVenezuelaDate();

  try {
    // Si no se fuerza refresco, verificar si tenemos una tasa reciente en BD (menos de 60 minutos)
    if (!force) {
      try {
        const rows = await query('SELECT * FROM tasa_bcv WHERE fecha = ? LIMIT 1', [today]);
        if (rows && rows.length > 0 && parseFloat(rows[0].tasa_hoy) > 0) {
          const updatedAt = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : 0;
          const diffMinutes = (Date.now() - updatedAt) / (1000 * 60);

          // Si se actualizó hace menos de 60 minutos, responder de inmediato desde BD
          if (diffMinutes < 60) {
            return NextResponse.json({
              success: true,
              data: {
                tasaHoy: parseFloat(rows[0].tasa_hoy),
                tasaManana: rows[0].tasa_manana ? parseFloat(rows[0].tasa_manana) : null,
                fecha: rows[0].fecha,
                fuente: rows[0].fuente || 'BCV'
              }
            });
          }
        }
      } catch (e) {
        console.warn('DB read error in /api/bcv:', e.message);
      }
    }

    // Consultar en vivo la tasa oficial
    const live = await fetchBCVOnline();

    if (live && live.tasaHoy > 0) {
      try {
        await query(
          `INSERT INTO tasa_bcv (fecha, tasa_hoy, fuente, updated_at) VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE tasa_hoy=VALUES(tasa_hoy), fuente=VALUES(fuente), updated_at=NOW()`,
          [today, live.tasaHoy, live.fuente]
        );
      } catch (dbErr) {
        console.warn('DB update error in /api/bcv:', dbErr.message);
      }

      return NextResponse.json({
        success: true,
        data: {
          tasaHoy: live.tasaHoy,
          tasaManana: null,
          fecha: today,
          fuente: live.fuente
        }
      });
    }

    // Si falló la consulta online, usar el último registro histórico disponible en BD
    const rows = await query('SELECT * FROM tasa_bcv ORDER BY fecha DESC, id DESC LIMIT 1');
    if (rows && rows.length > 0 && parseFloat(rows[0].tasa_hoy) > 0) {
      return NextResponse.json({
        success: true,
        data: {
          tasaHoy: parseFloat(rows[0].tasa_hoy),
          tasaManana: rows[0].tasa_manana ? parseFloat(rows[0].tasa_manana) : null,
          fecha: rows[0].fecha,
          fuente: rows[0].fuente ? `${rows[0].fuente} (Caché)` : 'BCV (Caché)'
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: { tasaHoy: 873.87, fecha: today, fuente: 'BCV (Predeterminada)' }
    });
  } catch (err) {
    console.error('Error en /api/bcv GET:', err);
    return NextResponse.json({
      success: true,
      data: { tasaHoy: 873.87, fecha: today, fuente: 'BCV (Predeterminada)' }
    });
  }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!input?.tasaHoy || isNaN(parseFloat(input.tasaHoy)) || parseFloat(input.tasaHoy) <= 0) {
      return NextResponse.json({ success: false, error: 'Tasa válida requerida.' }, { status: 400 });
    }
    const fecha = input.fecha || getVenezuelaDate();
    const tasaHoy = parseFloat(input.tasaHoy);
    const tasaManana = input.tasaManana ? parseFloat(input.tasaManana) : null;
    const fuente = input.fuente || 'BCV (Manual)';

    await query(
      `INSERT INTO tasa_bcv (fecha, tasa_hoy, tasa_manana, fuente, updated_at) VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE tasa_hoy=VALUES(tasa_hoy), tasa_manana=VALUES(tasa_manana), fuente=VALUES(fuente), updated_at=NOW()`,
      [fecha, tasaHoy, tasaManana, fuente]
    );

    return NextResponse.json({
      success: true,
      message: 'Tasa actualizada correctamente.',
      data: { tasaHoy, tasaManana, fecha, fuente }
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
