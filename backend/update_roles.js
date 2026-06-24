import pool from './db.js';

async function updateRoles() {
  try {
    const res = await pool.query(`UPDATE profiles SET role = 'CLIENTE' WHERE role = 'CUSTOMER'`);
    console.log(`Updated ${res.rowCount} rows in profiles.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

updateRoles();
