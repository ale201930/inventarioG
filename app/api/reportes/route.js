// app/api/reportes/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [cobrar, pagar, costoVendidos, inv, recentE, recentS, tasaRow] = await Promise.all([
      query('SELECT SUM(saldo_adeudado) AS total_cobrar, SUM(total_factura) AS total_ventas FROM salidas'),
      query('SELECT SUM(saldo_adeudado) AS total_pagar, SUM(total_factura) AS total_compras FROM entradas'),
      query(`SELECT SUM(si.cantidad * IF(si.costo_unitario > 0, si.costo_unitario, IFNULL(inv.costo_unitario, 0))) AS total_costos
             FROM salidas_items si LEFT JOIN inventario inv ON si.producto_id = inv.id`),
      query('SELECT COUNT(*) AS total_items, SUM(cantidad) AS total_stock, SUM(cantidad * costo_unitario) AS valor_inventario_costo FROM inventario'),
      query('SELECT * FROM entradas ORDER BY fecha DESC LIMIT 5'),
      query('SELECT * FROM salidas ORDER BY fecha DESC LIMIT 5'),
      query('SELECT tasa_hoy FROM tasa_bcv ORDER BY id DESC LIMIT 1').catch(() => []),
    ]);

    const tasaBCV = parseFloat(tasaRow[0]?.tasa_hoy ?? 798.33);
    const totalCobrar = parseFloat(cobrar[0]?.total_cobrar ?? 0);
    const totalVentas = parseFloat(cobrar[0]?.total_ventas ?? 0);
    const totalPagar = parseFloat(pagar[0]?.total_pagar ?? 0);
    const totalCompras = parseFloat(pagar[0]?.total_compras ?? 0);
    const totalCostosVendidos = parseFloat(costoVendidos[0]?.total_costos ?? 0);
    const gananciaBruta = Math.max(0, totalVentas - totalCostosVendidos);
    const margenGanancia = totalVentas > 0 ? Math.round((gananciaBruta / totalVentas) * 10000) / 100 : 0;
    const totalItems = parseInt(inv[0]?.total_items ?? 0);
    const totalStock = parseInt(inv[0]?.total_stock ?? 0);
    const valorInventarioCosto = parseFloat(inv[0]?.valor_inventario_costo ?? 0);

    return NextResponse.json({
      success: true,
      metrics: {
        tasaBCV, totalVentas, totalVentasVES: Math.round(totalVentas * tasaBCV * 100) / 100,
        totalCompras, totalComprasVES: Math.round(totalCompras * tasaBCV * 100) / 100,
        totalCostosVendidos, totalCostosVendidosVES: Math.round(totalCostosVendidos * tasaBCV * 100) / 100,
        gananciaBruta, gananciaBrutaVES: Math.round(gananciaBruta * tasaBCV * 100) / 100,
        margenGanancia,
        totalCobrar, totalCobrarVES: Math.round(totalCobrar * tasaBCV * 100) / 100,
        totalPagar, totalPagarVES: Math.round(totalPagar * tasaBCV * 100) / 100,
        totalItems, totalStock, valorInventarioCosto,
        valorInventarioCostoVES: Math.round(valorInventarioCosto * tasaBCV * 100) / 100,
      },
      recentEntradas: recentE,
      recentSalidas: recentS,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
