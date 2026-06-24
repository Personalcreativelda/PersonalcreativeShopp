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
const sql = readFileSync(join(__dirname, '../sql/migrations/CREATE_INVOICES.sql'), 'utf8');

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');

  // Verify
  const { rows: invoiceCols } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices' ORDER BY ordinal_position`
  );
  const { rows: taxCols } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'tax_config' ORDER BY ordinal_position`
  );

  console.log('\n✅ Migração CREATE_INVOICES concluída!\n');
  console.log('  Tabela invoices — colunas:', invoiceCols.map(r => r.column_name).join(', '));
  console.log('  Tabela tax_config — colunas:', taxCols.map(r => r.column_name).join(', '));

  const hasInvoiceCounter = taxCols.some(r => r.column_name === 'invoice_counter');
  const hasBankName       = taxCols.some(r => r.column_name === 'bank_name');
  const hasLogoUrl        = taxCols.some(r => r.column_name === 'logo_url');
  console.log('\n  invoice_counter :', hasInvoiceCounter ? '✅' : '❌');
  console.log('  bank_name       :', hasBankName       ? '✅' : '❌');
  console.log('  logo_url        :', hasLogoUrl        ? '✅' : '❌');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ Erro na migração:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
