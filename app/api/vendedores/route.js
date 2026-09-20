// app/api/vendedores/route.js
import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

export async function GET() {
  try {
    // Ensure table exists just in case
    await query(`
      CREATE TABLE IF NOT EXISTS \`vendedores\` (
        \`id\` VARCHAR(50) PRIMARY KEY,
        \`nombre\` VARCHAR(150) NOT NULL UNIQUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});

    const rows = await query('SELECT id, nombre, created_at FROM vendedores ORDER BY nombre ASC');
    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const input = await request.json();
    const nombre = (input?.nombre || '').trim();
    if (!nombre) {
      return NextResponse.json({ success: false, error: 'El nombre del vendedor es obligatorio.' }, { status: 400 });
    }

    const id = input.id || 'vend_' + Math.random().toString(36).slice(2, 10);
    
    // Check if exists
    const existing = await query('SELECT id, nombre FROM vendedores WHERE LOWER(nombre) = LOWER(?)', [nombre]);
    if (existing.length > 0) {
      return NextResponse.json({ success: true, data: existing[0], message: 'El vendedor ya existe.' });
    }

    await query('INSERT INTO vendedores (id, nombre) VALUES (?, ?)', [id, nombre]);
    return NextResponse.json({ success: true, data: { id, nombre }, message: 'Vendedor guardado con éxito.' });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID de vendedor requerido.' }, { status: 400 });

    await query('DELETE FROM vendedores WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Vendedor eliminado.' });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
