// Adds missing columns to orders table needed for tracking and AP/Ledger
import pool from './db.js';

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Missing orders columns for tracking/delivery
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE`);
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_deadline DATE`);

  await client.query('COMMIT');
  console.log('✅ Migration completed: orders columns added');

  const { rows } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'orders'
      AND column_name IN ('estimated_delivery_date','dispute_deadline','tracking_code')
  `);
  console.log('Verified columns:', rows.map(r => r.column_name).join(', '));
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
