// app/api/ticket/route.js
// Endpoint que devuelve el HTML del ticket de 80mm para una salida dada.
// RawBT lo consume directamente con: rawbt:https://inventario-g.vercel.app/api/ticket?id=XXX

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return new Response('ID requerido', { status: 400 });

    const rows = await query('SELECT * FROM salidas WHERE id = ?', [id]);
    if (!rows[0]) return new Response('No encontrada', { status: 404 });

    const salida = rows[0];
    const items = await query('SELECT * FROM salidas_items WHERE salida_id = ?', [id]);

    const cleanFecha = String(salida.fecha || '').split('T')[0];
    const totalUnits = items.reduce((s, it) => s + parseInt(it.cantidad || 0), 0);

    const itemsHTML = items.map(it => {
      const pu = Number(it.precio_unitario || 0);
      const cant = Number(it.cantidad || 0);
      const tot = pu * cant;
      return `
        <tr>
          <td>${cant}</td>
          <td>${it.producto_nombre || ''}</td>
          <td style="text-align:right">$${pu.toFixed(2)}</td>
          <td style="text-align:right">$${tot.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nota de Entrega N ${salida.factura_number}</title>
  <style>
    @page { size: 76mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 72mm; margin: 0 auto; padding: 4mm 2mm; font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; line-height: 1.35; }
    .c { text-align: center; }
    .b { font-weight: 800; }
    hr.s { border: none; border-top: 1.5px solid #000; margin: 6px 0; }
    hr.d { border: none; border-top: 1px dashed #444; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
    th { font-size: 10px; font-weight: 800; padding: 3px 0; border-bottom: 1.5px solid #000; text-align: left; }
    td { padding: 3px 0; vertical-align: top; word-break: break-word; }
    .tr { text-align: right; }
    .total { display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; margin: 8px 0; }
    .pago { border: 1px solid #555; border-radius: 6px; padding: 6px 8px; margin: 8px 0; font-size: 9px; }
    .pago-t { font-weight: 800; font-size: 10px; text-align: center; margin-bottom: 3px; }
  </style>
</head>
<body>
  <div class="c b" style="font-size:15px">BESTEDA 2, C.A.</div>
  <div class="c b" style="font-size:10px">RIF: J-40529263-6</div>
  <div class="c" style="font-size:9px">Calle Principal Casa N A-13, Urb. Alto de Fenix II</div>
  <div class="c" style="font-size:9px">San Juan de los Morros - Estado Guarico</div>
  <div class="c" style="font-size:9px">Tlfs: 0424-313.68.05 / 0424-300.48.02</div>
  <hr class="s"/>
  <div class="c b" style="font-size:14px">NOTA DE ENTREGA</div>
  <div class="c b" style="font-size:14px">N ${salida.factura_number}</div>
  <hr class="d"/>
  <table style="font-size:11px;border-collapse:collapse;width:100%">
    <tr><td style="font-weight:700;width:35%">FECHA:</td><td style="text-align:right">${cleanFecha}</td></tr>
    <tr><td style="font-weight:700">CLIENTE:</td><td style="text-align:right">${salida.cliente_name || ''}</td></tr>
    <tr><td style="font-weight:700">C.I./RIF:</td><td style="text-align:right">${salida.cedula_rif || '-'}</td></tr>
    <tr><td style="font-weight:700">TELF:</td><td style="text-align:right">${salida.telefono || '-'}</td></tr>
    <tr><td style="font-weight:700">DIR:</td><td style="text-align:right">${salida.direccion || '-'}</td></tr>
  </table>
  <hr class="d"/>
  <table>
    <thead>
      <tr>
        <th style="width:12%">CAN</th>
        <th style="width:46%">DESCRIPCION</th>
        <th class="tr" style="width:21%">P/U</th>
        <th class="tr" style="width:21%">TOTAL</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <hr class="s"/>
  <div class="total">
    <span>UND: ${totalUnits}</span>
    <span>TOTAL: $${Number(salida.total_factura || 0).toFixed(2)}</span>
  </div>
  <div class="pago">
    <div class="pago-t">- PAGO MOVIL BDV -</div>
    <div>0102 | 0424-3136805 | C.I. 10.668.263</div>
    <div>0102 | 0424-3004802 | C.I. 28.012.615</div>
    <hr class="d"/>
    <div class="pago-t">- DEPOSITO BANCARIO BDV -</div>
    <div>0102 0467 4501 0162 8166 (JUAN MORA)</div>
    <div>0102 0467 4500 0096 7787 (JORGE FLORES)</div>
  </div>
  <script>
    window.onload = function() { setTimeout(function() { try { window.print(); } catch(e){} }, 200); };
    window.onafterprint = function() { try { window.close(); } catch(e){} };
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Ticket API error:', err);
    return new Response('Error generando ticket', { status: 500 });
  }
}
