// app/api/inventario/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const rows = await query('SELECT * FROM inventario ORDER BY nombre ASC');
    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!input?.nombre) return NextResponse.json({ success: false, error: 'El nombre del producto es obligatorio.' });

    const id = input.id || 'prod_' + Math.random().toString(36).slice(2, 10);
    const nombre = input.nombre.trim();
    const cantidad = parseInt(input.cantidad ?? 0);
    const costo = parseFloat(input.costoUnitario ?? input.costo_unitario ?? 0);
    const pv1 = parseFloat(input.precioVenta1 ?? input.precio_venta1 ?? 0);
    const pv2 = parseFloat(input.precioVenta2 ?? input.precio_venta2 ?? 0);
    const pv3 = parseFloat(input.precioVenta3 ?? input.precio_venta3 ?? 0);
    const pu = parseFloat(input.precioUnitario ?? input.precio_unitario ?? pv1);
    const codigo = (input.codigoProducto || input.codigo_producto || '').trim();

    // Upsert
    await query(
      `INSERT INTO inventario (id, nombre, cantidad, costo_unitario, precio_venta1, precio_venta2, precio_venta3, precio_unitario, codigo_producto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), cantidad=VALUES(cantidad), costo_unitario=VALUES(costo_unitario),
       precio_venta1=VALUES(precio_venta1), precio_venta2=VALUES(precio_venta2), precio_venta3=VALUES(precio_venta3),
       precio_unitario=VALUES(precio_unitario), codigo_producto=VALUES(codigo_producto)`,
      [id, nombre, cantidad, costo, pv1, pv2, pv3, pu, codigo]
    );

    return NextResponse.json({ success: true, data: { id, nombre, cantidad, costo_unitario: costo, precio_venta1: pv1, precio_venta2: pv2, precio_venta3: pv3, precio_unitario: pu } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const input = await request.json();
    if (!input?.id) return NextResponse.json({ success: false, error: 'ID requerido.' });

    const pv1 = parseFloat(input.precioVenta1 ?? input.precio_venta1 ?? 0);
    const pv2 = parseFloat(input.precioVenta2 ?? input.precio_venta2 ?? 0);
    const pv3 = parseFloat(input.precioVenta3 ?? input.precio_venta3 ?? 0);
    const pu = parseFloat(input.precioUnitario ?? input.precio_unitario ?? pv1);
    const costo = parseFloat(input.costoUnitario ?? input.costo_unitario ?? 0);

    await query(
      `UPDATE inventario SET nombre=?, cantidad=?, costo_unitario=?, precio_venta1=?, precio_venta2=?, precio_venta3=?, precio_unitario=? WHERE id=?`,
      [input.nombre.trim(), parseInt(input.cantidad ?? 0), costo, pv1, pv2, pv3, pu, input.id]
    );
    return NextResponse.json({ success: true, message: 'Producto actualizado.' });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }
    if (!id) return NextResponse.json({ success: false, error: 'ID requerido.' });
    await query('DELETE FROM inventario WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Producto eliminado.' });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
