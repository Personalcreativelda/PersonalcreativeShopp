import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: false
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '../sql/migrations/CREATE_POINTS_TRACKING.sql'), 'utf8');

const client = await pool.connect();
try {
  await client.query(sql);
  // Verificar resultados
  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tracking_code'
  `);
  const { rows: pts } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'points'
  `);
  const { rows: sample } = await client.query(
    'SELECT order_number, tracking_code FROM orders WHERE tracking_code IS NOT NULL LIMIT 3'
  );
  console.log('✅ Migração completa!');
  console.log('  tracking_code em orders:', cols.length > 0 ? '✅' : '❌');
  console.log('  points em profiles:', pts.length > 0 ? '✅' : '❌');
  console.log('  Exemplos de tracking codes:', sample.map(r => r.tracking_code).join(', '));
} catch (err) {
  console.error('❌ Erro na migração:', err.message);
} finally {
  client.release();
  await pool.end();
}
