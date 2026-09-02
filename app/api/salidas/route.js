// app/api/salidas/route.js
import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

async function recalcSaldo(conn, salidaId) {
  const [r] = await conn.execute('SELECT total_factura FROM salidas WHERE id = ?', [salidaId]);
  if (!r[0]) return;
  const total = parseFloat(r[0].total_factura);
  const [ab] = await conn.execute('SELECT SUM(monto_usd) AS sum FROM abonos_salidas WHERE salida_id = ?', [salidaId]);
  const pagado = parseFloat(ab[0]?.sum ?? 0);
  await conn.execute('UPDATE salidas SET saldo_adeudado = ? WHERE id = ?', [Math.max(0, total - pagado), salidaId]);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    if (action === 'next_number') {
      const maxRes = await query("SELECT MAX(CAST(REGEXP_REPLACE(factura_number, '[^0-9]', '') AS UNSIGNED)) AS maxNum FROM salidas");
      const maxNum = parseInt(maxRes[0]?.maxNum || 0);
      const nextNum = maxNum >= 3000 ? maxNum + 1 : 3000;
      return NextResponse.json({ success: true, nextNumber: String(nextNum) });
    }

    if (action === 'clientes') {
      const rows = await query(
        `SELECT cliente_name, MAX(cedula_rif) AS cedula_rif, MAX(telefono) AS telefono,
         COUNT(id) AS total_notas, SUM(total_factura) AS total_compras_usd, SUM(saldo_adeudado) AS saldo_pendiente_usd
         FROM salidas GROUP BY cliente_name ORDER BY saldo_pendiente_usd DESC`
      );
      return NextResponse.json({ success: true, data: rows });
    }

    if (action === 'estado_cuenta') {
      const rawQuery = (searchParams.get('cliente') || '').trim();
      const cleanName = rawQuery.split('(')[0].trim() || rawQuery;
      const salidas = await query(
        `SELECT * FROM salidas WHERE LOWER(TRIM(cliente_name))=LOWER(TRIM(?)) OR LOWER(TRIM(cedula_rif))=LOWER(TRIM(?)) OR LOWER(TRIM(cliente_name)) LIKE ? ORDER BY fecha DESC`,
        [cleanName, cleanName, `%${cleanName}%`]
      );

      let tasaBCV = 798.33;
      try { const t = await query('SELECT tasa_hoy FROM tasa_bcv ORDER BY id DESC LIMIT 1'); tasaBCV = parseFloat(t[0]?.tasa_hoy ?? 798.33); } catch {}

      const abonosCliente = await query(
        `SELECT a.*, s.factura_number FROM abonos_salidas a LEFT JOIN salidas s ON a.salida_id = s.id
         WHERE LOWER(TRIM(a.cliente_name))=LOWER(TRIM(?)) OR LOWER(TRIM(s.cliente_name))=LOWER(TRIM(?)) ORDER BY a.fecha DESC`,
        [cleanName, cleanName]
      ).catch(() => []);

      const totCompras = salidas.reduce((s, r) => s + parseFloat(r.total_factura||0), 0);
      const totSaldo = salidas.reduce((s, r) => s + parseFloat(r.saldo_adeudado||0), 0);
      const clienteInfo = salidas[0] ? { name: salidas[0].cliente_name, cedula_rif: salidas[0].cedula_rif||'', telefono: salidas[0].telefono||'', direccion: salidas[0].direccion||'' } : { name: cleanName };

      return NextResponse.json({ success: true, cliente: clienteInfo,
        totales: { total_compras_usd: totCompras, total_abonado_usd: totCompras - totSaldo, saldo_pendiente_usd: totSaldo,
          total_compras_ves: totCompras*tasaBCV, saldo_pendiente_ves: totSaldo*tasaBCV, tasa_bcv: tasaBCV },
        salidas, abonos: abonosCliente });
    }

    if (id) {
      const rows = await query('SELECT * FROM salidas WHERE id = ?', [id]);
      if (!rows[0]) return NextResponse.json({ success: false, error: 'No encontrada.' });
      rows[0].items = await query('SELECT * FROM salidas_items WHERE salida_id = ?', [id]);
      return NextResponse.json({ success: true, data: rows[0] });
    }

    const salidas = await query('SELECT * FROM salidas ORDER BY created_at DESC');
    if (salidas.length > 0) {
      const ids = salidas.map(s => s.id);
      const placeholders = ids.map(() => '?').join(',');
      const allItems = await query(`SELECT * FROM salidas_items WHERE salida_id IN (${placeholders})`, ids);
      const itemMap = {};
      for (const item of allItems) {
        if (!itemMap[item.salida_id]) itemMap[item.salida_id] = [];
        itemMap[item.salida_id].push(item);
      }
      for (const s of salidas) {
        s.items = itemMap[s.id] || [];
      }
    }
    return NextResponse.json({ success: true, data: salidas });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const input = await request.json();
    if (!input?.clienteName) return NextResponse.json({ success: false, error: 'Cliente obligatorio.' });

    await conn.beginTransaction();

    const id = input.id || 'sal_' + Math.random().toString(36).slice(2, 10);
    const fecha = input.fecha || new Date().toISOString().split('T')[0];
    const items = input.items || [];

    // Auto factura number (starting at 3000)
    let facturaNumber = (input.facturaNumber || '').trim();
    if (!facturaNumber) {
      const [maxRes] = await conn.execute("SELECT MAX(CAST(REGEXP_REPLACE(factura_number, '[^0-9]', '') AS UNSIGNED)) AS maxNum FROM salidas");
      const maxNum = parseInt(maxRes[0]?.maxNum || 0);
      const nextNum = maxNum >= 3000 ? maxNum + 1 : 3000;
      facturaNumber = String(nextNum);
    }

    let totalFactura = 0, totalUnidades = 0;
    for (const item of items) {
      totalUnidades += parseInt(item.cantidad ?? 0);
      totalFactura += parseInt(item.cantidad ?? 0) * parseFloat(item.precioUnitario ?? 0);
    }

    await conn.execute(
      `INSERT INTO salidas (id, tipo_documento, cliente_name, cedula_rif, telefono, direccion, vendedor_name, factura_number, total_unidades, total_factura, saldo_adeudado, fecha, observaciones)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, 'NOTA DE ENTREGA', input.clienteName.trim(), input.cedulaRif||'', input.telefono||'', input.direccion||'',
       input.vendedorName||'JUAN MORA', facturaNumber, totalUnidades, totalFactura, totalFactura, fecha, input.observaciones||'']
    );

    for (const item of items) {
      const prodId = item.productoId;
      const cant = parseInt(item.cantidad ?? 0);
      const precio = parseFloat(item.precioUnitario ?? 0);

      const [costoR] = await conn.execute('SELECT nombre, cantidad, costo_unitario FROM inventario WHERE id = ? FOR UPDATE', [prodId]);
      const prod = costoR[0];
      if (!prod) throw new Error(`Producto no encontrado: ${item.productoNombre}`);
      if (parseInt(prod.cantidad) < cant) throw new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.cantidad}`);

      await conn.execute(
        'INSERT INTO salidas_items (salida_id, producto_id, producto_nombre, cantidad, costo_unitario, precio_unitario) VALUES (?,?,?,?,?,?)',
        [id, prodId, item.productoNombre, cant, parseFloat(prod.costo_unitario||0), precio]
      );
      await conn.execute('UPDATE inventario SET cantidad = cantidad - ? WHERE id = ?', [cant, prodId]);
    }

    await recalcSaldo(conn, id);
    await conn.commit();

    return NextResponse.json({ success: true, message: 'Factura procesada.', data: { id, factura_number: facturaNumber, total_factura: totalFactura } });
  } catch (e) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally {
    conn.release();
  }
}

export async function PUT(request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const input = await request.json();
    if (!input?.id) return NextResponse.json({ success: false, error: 'ID requerido.' });
    await conn.beginTransaction();
    await conn.execute('UPDATE salidas SET total_factura = ? WHERE id = ?', [parseFloat(input.totalFactura), input.id]);
    await recalcSaldo(conn, input.id);
    await conn.commit();
    return NextResponse.json({ success: true, message: 'Total actualizado.' });
  } catch (e) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally {
    conn.release();
  }
}

export async function DELETE(request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');
    if (!id) { const b = await request.json().catch(()=>({})); id = b.id; }
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido.' });

    await conn.beginTransaction();
    const [items] = await conn.execute('SELECT * FROM salidas_items WHERE salida_id = ?', [id]);
    for (const item of items) {
      await conn.execute('UPDATE inventario SET cantidad = cantidad + ? WHERE id = ?', [item.cantidad, item.producto_id]);
    }
    await conn.execute('DELETE FROM salidas_items WHERE salida_id = ?', [id]);
    await conn.execute('DELETE FROM salidas WHERE id = ?', [id]);
    await conn.commit();
    return NextResponse.json({ success: true, message: 'Factura eliminada. Stock repuesto.' });
  } catch (e) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally {
    conn.release();
  }
}
