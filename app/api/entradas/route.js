// app/api/entradas/route.js
import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

function randId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const rows = await query('SELECT * FROM entradas WHERE id = ?', [id]);
      if (!rows[0]) return NextResponse.json({ success: false, error: 'No encontrado.' });
      const entrada = rows[0];
      entrada.items = await query('SELECT * FROM entradas_items WHERE entrada_id = ?', [id]);
      entrada.abonos = await query('SELECT * FROM abonos_entradas WHERE entrada_id = ? ORDER BY fecha ASC', [id]);
      return NextResponse.json({ success: true, data: entrada });
    }

    const entradas = await query('SELECT * FROM entradas ORDER BY fecha DESC, created_at DESC');
    for (const e of entradas) {
      e.items = await query('SELECT * FROM entradas_items WHERE entrada_id = ?', [e.id]);
      e.abonos = await query('SELECT * FROM abonos_entradas WHERE entrada_id = ? ORDER BY fecha ASC', [e.id]);
    }
    return NextResponse.json({ success: true, data: entradas });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const input = await request.json();
    if (!input?.proveedorName || !input?.numeroDocumento) {
      return NextResponse.json({ success: false, error: 'Proveedor y Nº Documento son obligatorios.' });
    }

    await conn.beginTransaction();

    const id = input.id || randId('ent');
    const tasaBCV = parseFloat(input.tasaBCV ?? 798.33);
    const totalUSD = parseFloat(input.totalUSD ?? 0);
    const totalVES = parseFloat(input.totalVES ?? totalUSD * tasaBCV);
    const fecha = input.fecha || new Date().toISOString().split('T')[0];
    const items = input.items || [];

    if (!items.length) throw new Error('Debes incluir al menos un producto.');

    await conn.execute(
      `INSERT INTO entradas
       (id, proveedor_name, proveedor_rif, proveedor_telefono, proveedor_direccion,
        factura_number, tipo_documento, numero_documento, fecha, fecha_vencimiento,
        tasa_bcv, total_factura, total_usd, total_ves, saldo_adeudado, saldo_adeudado_usd, saldo_adeudado_ves, observaciones)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, input.proveedorName.trim(), input.proveedorRif||'', input.proveedorTelefono||'', input.proveedorDireccion||'',
       input.numeroDocumento.trim(), input.tipoDocumento||'NOTA DE ENTREGA', input.numeroDocumento.trim(),
       fecha, input.fechaVencimiento||null, tasaBCV, totalUSD, totalUSD, totalVES, totalUSD, totalUSD, totalVES,
       input.observaciones||'']
    );

    for (const item of items) {
      const codigo = (item.codigoProducto || '').trim();
      const prodNombre = (item.productoNombre || '').trim();
      const cant = parseInt(item.cantidad ?? 0);
      const costoUSD = parseFloat(item.costoUnitarioUSD ?? 0);
      const costoVES = parseFloat(item.costoUnitarioVES ?? costoUSD * tasaBCV);
      if (!prodNombre || cant <= 0) continue;

      // Find existing product
      let prodId = null;
      if (codigo) {
        const r = await conn.execute(
          'SELECT * FROM inventario WHERE LOWER(TRIM(codigo_producto)) = LOWER(TRIM(?)) OR id = ? LIMIT 1',
          [codigo, codigo]
        );
        if (r[0][0]) prodId = r[0][0].id;
      }
      if (!prodId) {
        const r = await conn.execute('SELECT * FROM inventario WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1', [prodNombre]);
        if (r[0][0]) prodId = r[0][0].id;
      }

      if (prodId) {
        await conn.execute(
          'UPDATE inventario SET cantidad = cantidad + ?, costo_unitario = ? WHERE id = ?',
          [cant, costoUSD, prodId]
        );
      } else {
        prodId = codigo ? 'prod_' + codigo.toLowerCase().replace(/[^a-z0-9]/g, '') : randId('prod');
        await conn.execute(
          'INSERT INTO inventario (id, codigo_producto, nombre, cantidad, costo_unitario, precio_unitario) VALUES (?,?,?,?,?,?)',
          [prodId, codigo, prodNombre, cant, costoUSD, costoUSD * 1.30]
        );
      }

      await conn.execute(
        `INSERT INTO entradas_items (entrada_id, producto_id, codigo_producto, producto_nombre, cantidad, costo_unitario, costo_unitario_usd, costo_unitario_ves, subtotal_usd, subtotal_ves)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, prodId, codigo, prodNombre, cant, costoUSD, costoUSD, costoVES, cant*costoUSD, cant*costoVES]
      );
    }

    await conn.commit();
    return NextResponse.json({ success: true, id, message: 'Factura procesada. Stock actualizado.' });
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
    const [items] = await conn.execute('SELECT * FROM entradas_items WHERE entrada_id = ?', [id]);
    for (const item of items) {
      await conn.execute('UPDATE inventario SET cantidad = GREATEST(0, cantidad - ?) WHERE id = ?', [item.cantidad, item.producto_id]);
    }
    await conn.execute('DELETE FROM entradas_items WHERE entrada_id = ?', [id]);
    await conn.execute('DELETE FROM entradas WHERE id = ?', [id]);
    await conn.commit();
    return NextResponse.json({ success: true, message: 'Compra eliminada y stock ajustado.' });
  } catch (e) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally {
    conn.release();
  }
}
