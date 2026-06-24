import pool from './db.js';

async function run() {
  try {
    const email = 'denylsondanial@gmail.com';
    const { rows } = await pool.query(
      "UPDATE profiles SET role = 'ADMIN', is_super_admin = true WHERE email = $1 RETURNING id",
      [email]
    );
    console.log('Role updated for ID:', rows[0]?.id);
  } catch (err) {
    console.error('Error updating user:', err.message);
  }
  process.exit(0);
}

run();
