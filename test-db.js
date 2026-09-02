import { query } from './lib/db.js';

async function test() {
  console.log('Testing db connection...');
  try {
    const rows = await query('SELECT count(*) as count FROM inventario');
    console.log('Success! Inventario count:', rows[0].count);
    process.exit(0);
  } catch (err) {
    console.error('Error connecting:', err);
    process.exit(1);
  }
}

test();
