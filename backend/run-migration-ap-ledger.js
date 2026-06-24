// Run: cd backend && node run-migration-ap-ledger.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const sql = readFileSync(join(__dir, '../sql/migrations/CREATE_AP_LEDGER.sql'), 'utf8');

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('✅ AP+Ledger migration completed successfully');

  // Verify tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('supplier_invoices','chart_of_accounts','journal_entries','journal_entry_lines')
    ORDER BY table_name
  `);
  console.log('Tables created:', tables.rows.map(r => r.table_name).join(', '));

  const accounts = await client.query('SELECT COUNT(*) FROM chart_of_accounts');
  console.log('Chart of accounts entries:', accounts.rows[0].count);

  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'tax_config' AND column_name IN ('ap_bill_prefix','ap_bill_counter')
  `);
  console.log('tax_config AP columns:', cols.rows.map(r => r.column_name).join(', '));
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
