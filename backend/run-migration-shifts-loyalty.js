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
const sql = readFileSync(join(__dirname, '../sql/migrations/CREATE_POS_SHIFTS_AND_LOYALTY.sql'), 'utf8');

const client = await pool.connect();
try {
  await client.query(sql);

  const { rows: shifts } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'pos_shifts' LIMIT 1
  `);
  const { rows: loyalty } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'loyalty_points'
  `);
  const { rows: log } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'loyalty_log' LIMIT 1
  `);

  console.log('✅ Migração completa!');
  console.log('  pos_shifts:', shifts.length > 0 ? '✅' : '❌');
  console.log('  loyalty_points em profiles:', loyalty.length > 0 ? '✅' : '❌');
  console.log('  loyalty_log:', log.length > 0 ? '✅' : '❌');
} catch (err) {
  console.error('❌ Erro na migração:', err.message);
} finally {
  client.release();
  await pool.end();
}
