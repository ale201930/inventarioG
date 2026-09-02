// app/api/abonos-salidas/route.js
import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

async function recalcSalidaSaldo(conn, salidaId) {
  const [r] = await conn.execute('SELECT total_factura FROM salidas WHERE id = ?', [salidaId]);
  if (!r[0]) return;
  const total = parseFloat(r[0].total_factura);
  const [ab] = await conn.execute('SELECT SUM(monto_usd) AS sum FROM abonos_salidas WHERE salida_id = ?', [salidaId]);
  const pagado = parseFloat(ab[0]?.sum ?? 0);
  await conn.execute('UPDATE salidas SET saldo_adeudado = ? WHERE id = ?', [Math.max(0, total - pagado), salidaId]);
}

export async function GET() {
  try {
    const rows = await query('SELECT * FROM abonos_salidas ORDER BY fecha ASC');
    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const input = await request.json();
    if (!input?.clienteName || !input?.salidaId || input?.montoUSD === undefined) {
      return NextResponse.json({ success: false, error: 'Factura, Cliente y Monto son requeridos.' });
    }
    await conn.beginTransaction();
    const id = input.id || 'absal_' + Math.random().toString(36).slice(2, 10);
    await conn.execute(
      'INSERT INTO abonos_salidas (id, salida_id, cliente_name, monto_usd, monto_ves, referencia, fecha) VALUES (?,?,?,?,?,?,?)',
      [id, input.salidaId, input.clienteName.trim(), parseFloat(input.montoUSD), parseFloat(input.montoVES??0), input.referencia||'', input.fecha || new Date().toISOString().split('T')[0]]
    );
    await recalcSalidaSaldo(conn, input.salidaId);
    await conn.commit();
    return NextResponse.json({ success: true, message: 'Abono registrado.' });
  } catch (e) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally { conn.release(); }
}

export async function PUT(request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const input = await request.json();
    if (!input?.id || !input?.salidaId) return NextResponse.json({ success: false, error: 'IDs requeridos.' });
    await conn.beginTransaction();
    await conn.execute(
      'UPDATE abonos_salidas SET fecha=?, referencia=?, monto_ves=?, monto_usd=? WHERE id=?',
      [input.fecha, input.referencia||'', parseFloat(input.montoVES??0), parseFloat(input.montoUSD??0), input.id]
    );
    await recalcSalidaSaldo(conn, input.salidaId);
    await conn.commit();
    return NextResponse.json({ success: true, message: 'Abono actualizado.' });
  } catch (e) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally { conn.release(); }
}

export async function DELETE(request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const salidaId = searchParams.get('salidaId');
    if (!id || !salidaId) return NextResponse.json({ success: false, error: 'IDs requeridos.' });
    await conn.beginTransaction();
    await conn.execute('DELETE FROM abonos_salidas WHERE id = ?', [id]);
    await recalcSalidaSaldo(conn, salidaId);
    await conn.commit();
    return NextResponse.json({ success: true, message: 'Abono eliminado.' });
  } catch (e) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally { conn.release(); }
}
