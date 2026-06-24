import pool from './db.js';
import bcrypt from 'bcryptjs';

async function run() {
  try {
    const email = 'denylsondanial@gmail.com';
    const pass = 'naturerva2025';
    const hash = await bcrypt.hash(pass, 12);
    
    // Create the user
    // First, let's see if the table has is_super_admin and is_active
    const { rows: columns } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'profiles'
    `);
    const colNames = columns.map(c => c.column_name);
    
    let query = `INSERT INTO profiles (id, email, name, password_hash`;
    let values = `gen_random_uuid(), $1, $2, $3`;
    let params = [email, 'Denylson', hash];
    let paramIdx = 4;
    
    if (colNames.includes('role')) {
      query += `, role`;
      values += `, $${paramIdx++}`;
      params.push('ADMIN');
    }
    if (colNames.includes('is_super_admin')) {
      query += `, is_super_admin`;
      values += `, true`;
    }
    if (colNames.includes('is_active')) {
      query += `, is_active`;
      values += `, true`;
    }
    
    query += `) VALUES (${values}) RETURNING id`;
    
    const { rows } = await pool.query(query, params);
    console.log(`User created successfully! ID: ${rows[0].id}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${pass}`);

  } catch (err) {
    console.error('Error creating user:', err.message);
  }
  process.exit(0);
}

run();
