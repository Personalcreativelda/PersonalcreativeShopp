import pool from './db.js';

const client = await pool.connect();
try {
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN ('invoices','tax_config') ORDER BY table_name`
  );
  console.log('Tables found:', tables.map(r => r.table_name));

  const { rows: tc } = await client.query(
    'SELECT id, company_name, vat_rate, invoice_counter, invoice_prefix FROM tax_config LIMIT 5'
  );
  console.log('tax_config rows:', JSON.stringify(tc, null, 2));

  const { rows: inv } = await client.query('SELECT COUNT(*) AS n FROM invoices');
  console.log('invoices count:', inv[0].n);

  // Simulate the exact GET / query
  const { rows: test } = await client.query(`
    SELECT i.*, p.name AS creator_name, o.order_number
    FROM invoices i
    LEFT JOIN profiles p ON p.id = i.created_by
    LEFT JOIN orders   o ON o.id = i.order_id
    ORDER BY i.created_at DESC LIMIT 10 OFFSET 0
  `);
  console.log('GET / query OK, rows:', test.length);
} catch (err) {
  console.error('ERROR:', err.message, '| CODE:', err.code);
} finally {
  client.release();
  await pool.end();
}
