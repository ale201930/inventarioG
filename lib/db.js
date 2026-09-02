// lib/db.js - Conexión MySQL2 a TiDB Cloud (compatible con MySQL)
import mysql from 'mysql2/promise';

let pool = null;

export function getPool() {
  if (pool) return pool;

  const isCloud = !!(
    process.env.TIDB_HOST ||
    process.env.DATABASE_URL ||
    (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com'))
  );

  if (process.env.DATABASE_URL) {
    const sslParam = process.env.DATABASE_URL.includes('tidbcloud') ? '?ssl={"rejectUnauthorized":false}' : '';
    pool = mysql.createPool(process.env.DATABASE_URL + sslParam);
    return pool;
  }

  pool = mysql.createPool({
    host:     process.env.TIDB_HOST     || process.env.DB_HOST || '127.0.0.1',
    port:     parseInt(process.env.TIDB_PORT || process.env.DB_PORT || '3306'),
    user:     process.env.TIDB_USER     || process.env.DB_USER || 'root',
    password: process.env.TIDB_PASSWORD !== undefined ? process.env.TIDB_PASSWORD : (process.env.DB_PASS !== undefined ? process.env.DB_PASS : ''),
    database: process.env.TIDB_DATABASE || process.env.DB_NAME || 'inventario_db',
    ssl: isCloud ? { rejectUnauthorized: false } : false,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  return pool;
}

export async function query(sql, params = []) {
  const db = getPool();
  const [rows] = await db.execute(sql, params);
  return rows;
}
