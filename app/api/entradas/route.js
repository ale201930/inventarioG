// app/api/entradas/route.js
import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

function randId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    if (action === 'proveedores') {
      const rows = await query(`
        SELECT id, proveedor_name, proveedor_rif, proveedor_telefono, proveedor_direccion,
               total_factura, saldo_adeudado, created_at, tasa_bcv
        FROM entradas
        WHERE proveedor_name IS NOT NULL AND TRIM(proveedor_name) != ''
        ORDER BY created_at DESC
      `);

      const provMap = new Map();
      for (const r of rows) {
        const pName = (r.proveedor_name || '').trim();
        const pRif = (r.proveedor_rif || '').trim();
        if (!pName) continue;
        const key = pRif ? `RIF:${pRif.toLowerCase()}` : `NAME:${pName.toLowerCase()}`;
        if (!provMap.has(key)) {
          provMap.set(key, {
            proveedor_name: pName,
            proveedor_rif: pRif,
            proveedor_telefono: (r.proveedor_telefono || '').trim(),
            proveedor_direccion: (r.proveedor_direccion || '').trim(),
            total_notas: 0,
            total_compras_usd: 0,
            saldo_pendiente_usd: 0
          });
        }
        const entry = provMap.get(key);
        entry.total_notas += 1;
        entry.total_compras_usd += parseFloat(r.total_factura || 0);
        entry.saldo_pendiente_usd += parseFloat(r.saldo_adeudado || 0);
        if (!entry.proveedor_telefono && r.proveedor_telefono) entry.proveedor_telefono = r.proveedor_telefono.trim();
        if (!entry.proveedor_direccion && r.proveedor_direccion) entry.proveedor_direccion = r.proveedor_direccion.trim();
      }

      const provList = Array.from(provMap.values()).sort((a, b) =>
        a.proveedor_name.localeCompare(b.proveedor_name, 'es', { sensitivity: 'base' })
      );
      return NextResponse.json({ success: true, data: provList });
    }

    if (action === 'estado_cuenta') {
      const proveedorParam = (searchParams.get('proveedor') || '').trim();
      const rifParam = (searchParams.get('rif') || '').trim();

      let entradas = [];
      if (rifParam) {
        entradas = await query(
          `SELECT * FROM entradas WHERE LOWER(TRIM(proveedor_rif)) = LOWER(TRIM(?)) ORDER BY fecha DESC`,
          [rifParam]
        );
      } else if (proveedorParam) {
        entradas = await query(
          `SELECT * FROM entradas WHERE LOWER(TRIM(proveedor_name)) = LOWER(TRIM(?)) ORDER BY fecha DESC`,
          [proveedorParam]
        );
      }

      let tasaBCV = 798.33;
      try { const t = await query('SELECT tasa_hoy FROM tasa_bcv ORDER BY id DESC LIMIT 1'); tasaBCV = parseFloat(t[0]?.tasa_hoy ?? 798.33); } catch {}

      let abonosProveedor = [];
      if (entradas.length > 0) {
        const eIds = entradas.map(e => e.id);
        const placeholders = eIds.map(() => '?').join(',');
        abonosProveedor = await query(
          `SELECT a.*, e.factura_number, e.proveedor_rif, e.proveedor_name FROM abonos_entradas a 
           INNER JOIN entradas e ON a.entrada_id = e.id
           WHERE a.entrada_id IN (${placeholders}) ORDER BY a.fecha DESC`,
          eIds
        ).catch(() => []);
      }

      const totCompras = entradas.reduce((s, r) => s + parseFloat(r.total_factura||0), 0);
      const totSaldo = entradas.reduce((s, r) => s + parseFloat(r.saldo_adeudado||0), 0);
      const proveedorInfo = entradas[0] ? {
        name: entradas[0].proveedor_name,
        rif: entradas[0].proveedor_rif || rifParam || '',
        telefono: entradas[0].proveedor_telefono || '',
        direccion: entradas[0].proveedor_direccion || ''
      } : { name: proveedorParam, rif: rifParam };

      return NextResponse.json({
        success: true,
        proveedor: proveedorInfo,
        entradas,
        abonos: abonosProveedor,
        totales: {
          total_compras_usd: totCompras,
          total_compras_ves: totCompras * tasaBCV,
          total_saldo_usd: totSaldo,
          total_saldo_ves: totSaldo * tasaBCV,
          total_abonado_usd: Math.max(0, totCompras - totSaldo),
          total_abonado_ves: Math.max(0, totCompras - totSaldo) * tasaBCV,
          tasa_bcv: tasaBCV
        }
      });
    }

    if (id) {
      const rows = await query('SELECT * FROM entradas WHERE id = ?', [id]);
      if (!rows[0]) return NextResponse.json({ success: false, error: 'No encontrado.' });
      const entrada = rows[0];
      entrada.items = await query('SELECT * FROM entradas_items WHERE entrada_id = ?', [id]);
      entrada.abonos = await query('SELECT * FROM abonos_entradas WHERE entrada_id = ? ORDER BY fecha ASC', [id]);
      return NextResponse.json({ success: true, data: entrada });
    }

    const entradas = await query('SELECT * FROM entradas ORDER BY fecha DESC, created_at DESC');
    if (entradas.length > 0) {
      const ids = entradas.map(e => e.id);
      const placeholders = ids.map(() => '?').join(',');
      const [allItems, allAbonos] = await Promise.all([
        query(`SELECT * FROM entradas_items WHERE entrada_id IN (${placeholders})`, ids),
        query(`SELECT * FROM abonos_entradas WHERE entrada_id IN (${placeholders}) ORDER BY fecha ASC`, ids),
      ]);
      const itemMap = {}, abonoMap = {};
      for (const item of allItems) {
        if (!itemMap[item.entrada_id]) itemMap[item.entrada_id] = [];
        itemMap[item.entrada_id].push(item);
      }
      for (const ab of allAbonos) {
        if (!abonoMap[ab.entrada_id]) abonoMap[ab.entrada_id] = [];
        abonoMap[ab.entrada_id].push(ab);
      }
      for (const e of entradas) {
        e.items = itemMap[e.id] || [];
        e.abonos = abonoMap[e.id] || [];
      }
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
      let prodId = (item.productoId || item.producto_id || '').trim() || null;
      if (prodId) {
        const r = await conn.execute('SELECT id, nombre, codigo_producto FROM inventario WHERE id = ? LIMIT 1', [prodId]);
        if (!r[0][0]) prodId = null;
      }
      if (!prodId && codigo) {
        const r = await conn.execute(
          'SELECT id FROM inventario WHERE LOWER(TRIM(codigo_producto)) = LOWER(TRIM(?)) OR id = ? LIMIT 1',
          [codigo, codigo]
        );
        if (r[0][0]) prodId = r[0][0].id;
      }
      if (!prodId && prodNombre) {
        const r = await conn.execute('SELECT id FROM inventario WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1', [prodNombre]);
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
          `INSERT INTO inventario 
           (id, codigo_producto, nombre, cantidad, costo_unitario, precio_unitario, precio_venta1, precio_venta2, precio_venta3, precio_venta4) 
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [prodId, codigo, prodNombre, cant, costoUSD, costoUSD * 1.15, costoUSD * 1.15, costoUSD * 1.20, costoUSD * 1.25, costoUSD * 1.30]
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

export async function PUT(request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const input = await request.json();
    const id = input?.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID de compra requerido para editar.' });
    }
    if (!input?.proveedorName || !input?.numeroDocumento) {
      return NextResponse.json({ success: false, error: 'Proveedor y Nº Documento son obligatorios.' });
    }

    await conn.beginTransaction();

    // 1. Verificar existencia de la entrada
    const [existingRows] = await conn.execute('SELECT * FROM entradas WHERE id = ?', [id]);
    if (!existingRows || existingRows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: 'La compra no existe.' }, { status: 404 });
    }

    const tasaBCV = parseFloat(input.tasaBCV ?? 798.33);
    const totalUSD = parseFloat(input.totalUSD ?? 0);
    const totalVES = parseFloat(input.totalVES ?? totalUSD * tasaBCV);
    const fecha = input.fecha || new Date().toISOString().split('T')[0];
    const items = input.items || [];

    if (!items.length) throw new Error('Debes incluir al menos un producto.');

    // 2. Revertir el stock de los items anteriores
    const [previousItems] = await conn.execute('SELECT * FROM entradas_items WHERE entrada_id = ?', [id]);
    for (const prev of previousItems) {
      if (prev.producto_id && prev.cantidad > 0) {
        await conn.execute(
          'UPDATE inventario SET cantidad = GREATEST(0, cantidad - ?) WHERE id = ?',
          [prev.cantidad, prev.producto_id]
        );
      }
    }

    // 3. Eliminar los items viejos de la compra
    await conn.execute('DELETE FROM entradas_items WHERE entrada_id = ?', [id]);

    // 4. Insertar los nuevos items y actualizar/crear inventario
    for (const item of items) {
      const codigo = (item.codigoProducto || item.codigo || '').trim();
      const prodNombre = (item.productoNombre || item.nombre || '').trim();
      const cant = parseInt(item.cantidad ?? 0);
      const costoUSD = parseFloat(item.costoUnitarioUSD ?? item.costoUSD ?? 0);
      const costoVES = parseFloat(item.costoUnitarioVES ?? item.costoVES ?? (costoUSD * tasaBCV));
      if (!prodNombre || cant <= 0) continue;

      let prodId = (item.productoId || item.producto_id || '').trim() || null;
      if (prodId) {
        const r = await conn.execute('SELECT id, nombre, codigo_producto FROM inventario WHERE id = ? LIMIT 1', [prodId]);
        if (!r[0][0]) prodId = null;
      }
      if (!prodId && codigo) {
        const r = await conn.execute(
          'SELECT id FROM inventario WHERE LOWER(TRIM(codigo_producto)) = LOWER(TRIM(?)) OR id = ? LIMIT 1',
          [codigo, codigo]
        );
        if (r[0][0]) prodId = r[0][0].id;
      }
      if (!prodId && prodNombre) {
        const r = await conn.execute('SELECT id FROM inventario WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1', [prodNombre]);
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
          `INSERT INTO inventario 
           (id, codigo_producto, nombre, cantidad, costo_unitario, precio_unitario, precio_venta1, precio_venta2, precio_venta3, precio_venta4) 
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [prodId, codigo, prodNombre, cant, costoUSD, costoUSD * 1.15, costoUSD * 1.15, costoUSD * 1.20, costoUSD * 1.25, costoUSD * 1.30]
        );
      }

      await conn.execute(
        `INSERT INTO entradas_items (entrada_id, producto_id, codigo_producto, producto_nombre, cantidad, costo_unitario, costo_unitario_usd, costo_unitario_ves, subtotal_usd, subtotal_ves)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, prodId, codigo, prodNombre, cant, costoUSD, costoUSD, costoVES, cant * costoUSD, cant * costoVES]
      );
    }

    // 5. Calcular saldo pendiente considerando los abonos ya registrados
    const [abonosRows] = await conn.execute(
      'SELECT COALESCE(SUM(monto_usd), 0) AS total_abonos_usd, COALESCE(SUM(monto_ves), 0) AS total_abonos_ves FROM abonos_entradas WHERE entrada_id = ?',
      [id]
    );
    const totalAbonadoUSD = parseFloat(abonosRows[0]?.total_abonos_usd || 0);
    const totalAbonadoVES = parseFloat(abonosRows[0]?.total_abonos_ves || 0);

    const saldoAdeudadoUSD = Math.max(0, totalUSD - totalAbonadoUSD);
    const saldoAdeudadoVES = Math.max(0, totalVES - totalAbonadoVES);

    // 6. Actualizar la cabecera de la entrada
    await conn.execute(
      `UPDATE entradas SET
        proveedor_name = ?,
        proveedor_rif = ?,
        proveedor_telefono = ?,
        proveedor_direccion = ?,
        factura_number = ?,
        tipo_documento = ?,
        numero_documento = ?,
        fecha = ?,
        fecha_vencimiento = ?,
        tasa_bcv = ?,
        total_factura = ?,
        total_usd = ?,
        total_ves = ?,
        saldo_adeudado = ?,
        saldo_adeudado_usd = ?,
        saldo_adeudado_ves = ?,
        observaciones = ?
       WHERE id = ?`,
      [
        input.proveedorName.trim(),
        input.proveedorRif || '',
        input.proveedorTelefono || '',
        input.proveedorDireccion || '',
        input.numeroDocumento.trim(),
        input.tipoDocumento || 'NOTA DE ENTREGA',
        input.numeroDocumento.trim(),
        fecha,
        input.fechaVencimiento || null,
        tasaBCV,
        totalUSD,
        totalUSD,
        totalVES,
        saldoAdeudadoUSD,
        saldoAdeudadoUSD,
        saldoAdeudadoVES,
        input.observaciones || '',
        id
      ]
    );

    await conn.commit();
    return NextResponse.json({ success: true, id, message: 'Compra actualizada y stock sincronizado correctamente.' });
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
      if (item.producto_id) {
        await conn.execute('UPDATE inventario SET cantidad = GREATEST(0, cantidad - ?) WHERE id = ?', [item.cantidad, item.producto_id]);
      }
    }
    await conn.execute('DELETE FROM entradas_items WHERE entrada_id = ?', [id]);
    await conn.execute('DELETE FROM entradas WHERE id = ?', [id]);

    // Verificar si algún producto quedó en 0 y no tiene otras compras ni ventas registradas
    for (const item of items) {
      if (item.producto_id) {
        const [prodRows] = await conn.execute('SELECT cantidad FROM inventario WHERE id = ?', [item.producto_id]);
        if (prodRows && prodRows.length > 0 && prodRows[0].cantidad <= 0) {
          const [otherEntradas] = await conn.execute('SELECT COUNT(*) as count FROM entradas_items WHERE producto_id = ?', [item.producto_id]);
          const [otherSalidas] = await conn.execute('SELECT COUNT(*) as count FROM salidas_items WHERE producto_id = ?', [item.producto_id]);
          
          const hasOtherEntradas = (otherEntradas[0]?.count || 0) > 0;
          const hasOtherSalidas = (otherSalidas[0]?.count || 0) > 0;

          if (!hasOtherEntradas && !hasOtherSalidas) {
            await conn.execute('DELETE FROM inventario WHERE id = ?', [item.producto_id]);
          }
        }
      }
    }

    await conn.commit();
    return NextResponse.json({ success: true, message: 'Compra eliminada, stock revertido y productos sin movimientos limpiados.' });
  } catch (e) {
    await conn.rollback();
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally {
    conn.release();
  }
}

