// lib/db.js - Conexión MySQL2 a TiDB Cloud con Pool Reutilizable en Next.js
import mysql from 'mysql2/promise';

let globalForDb = globalThis;

export function getPool() {
  if (globalForDb._mysqlPool) return globalForDb._mysqlPool;

  const host = process.env.TIDB_HOST || process.env.DB_HOST || 'gateway01.us-east-1.prod.aws.tidbcloud.com';
  const port = parseInt(process.env.TIDB_PORT || process.env.DB_PORT || '4000');
  const user = process.env.TIDB_USER || process.env.DB_USER || '3SA3TXmBlV6gNHj.root';
  const password = process.env.TIDB_PASSWORD !== undefined ? process.env.TIDB_PASSWORD : (process.env.DB_PASS !== undefined ? process.env.DB_PASS : 'Inventario2026!');
  const database = process.env.TIDB_DATABASE || process.env.DB_NAME || 'inventarioG';

  let pool;
  if (process.env.DATABASE_URL) {
    const sslParam = process.env.DATABASE_URL.includes('tidbcloud') ? '?ssl={"rejectUnauthorized":false}' : '';
    pool = mysql.createPool(process.env.DATABASE_URL + sslParam);
  } else {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      ssl: { rejectUnauthorized: false },
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
      connectTimeout: 10000,
      enableKeepAlive: true,
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    globalForDb._mysqlPool = pool;
  }

  return pool;
}

export async function query(sql, params = []) {
  const db = getPool();
  const [rows] = await db.execute(sql, params);
  return rows;
}
