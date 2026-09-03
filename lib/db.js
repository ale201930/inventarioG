// lib/db.js - Conexión MySQL2 a TiDB Cloud Serverless (inventarioG)
import mysql from 'mysql2/promise';

let globalForDb = globalThis;

function clean(val, defaultVal = '') {
  if (val === undefined || val === null) return defaultVal;
  return String(val).replace(/["'\r\n\t]/g, '').trim();
}

export function getPool() {
  if (globalForDb._mysqlPool) return globalForDb._mysqlPool;

  const rawHost = process.env.TIDB_HOST || process.env.DB_HOST;
  const host = clean(rawHost, 'gateway01.us-east-1.prod.aws.tidbcloud.com');
  const port = parseInt(clean(process.env.TIDB_PORT || process.env.DB_PORT, '4000').replace(/[^0-9]/g, '')) || 4000;
  const user = clean(process.env.TIDB_USER || process.env.DB_USER, '3SA3TXmBiV6gNHj.root');
  const password = clean(process.env.TIDB_PASSWORD !== undefined ? process.env.TIDB_PASSWORD : process.env.DB_PASS, 'lSTcoO53rCHvCE4D');
  const database = clean(process.env.TIDB_DATABASE || process.env.DB_NAME, 'inventarioG');

  let pool;
  if (process.env.DATABASE_URL) {
    const cleanUrl = clean(process.env.DATABASE_URL);
    const sslParam = cleanUrl.includes('tidbcloud') && !cleanUrl.includes('ssl=') ? '?ssl={"rejectUnauthorized":false}' : '';
    pool = mysql.createPool(cleanUrl + sslParam);
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
