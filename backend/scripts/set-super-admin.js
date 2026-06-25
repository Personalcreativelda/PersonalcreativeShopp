/**
 * set-super-admin.js
 * Promove um utilizador a SUPER_ADMIN na base de dados.
 *
 * Uso: node scripts/set-super-admin.js <email>
 * Ex:  node scripts/set-super-admin.js ekson.cuamba05@gmail.com
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const email = process.argv[2];
if (!email) {
  console.error('❌  Uso: node scripts/set-super-admin.js <email>');
  process.exit(1);
}

const pool = new pg.Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl:      process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15000,
});

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1. Actualiza o campo legado + flag is_super_admin
  const { rowCount } = await client.query(
    `UPDATE profiles
        SET role = 'SUPER_ADMIN', is_super_admin = TRUE, updated_at = NOW()
      WHERE email = $1`,
    [email]
  );

  if (rowCount === 0) {
    console.error(`❌  Utilizador não encontrado: ${email}`);
    await client.query('ROLLBACK');
    process.exit(1);
  }

  // 2. Garante que a role SUPER_ADMIN existe na tabela roles
  await client.query(`
    INSERT INTO roles (name, display_name, description, level, is_system_role)
    VALUES ('SUPER_ADMIN', 'Super Administrador', 'Acesso total ao sistema', 0, TRUE)
    ON CONFLICT (name) DO NOTHING
  `);

  // 3. Liga utilizador ao role SUPER_ADMIN na tabela user_roles
  await client.query(`
    INSERT INTO user_roles (user_id, role_id)
    SELECT p.id, r.id
      FROM profiles p, roles r
     WHERE p.email = $1 AND r.name = 'SUPER_ADMIN'
    ON CONFLICT (user_id, role_id) DO NOTHING
  `, [email]);

  await client.query('COMMIT');

  // 4. Verifica resultado
  const { rows } = await client.query(`
    SELECT p.email, p.name, p.role, p.is_super_admin,
           COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
      FROM profiles p
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r       ON r.id = ur.role_id
     WHERE p.email = $1
     GROUP BY p.email, p.name, p.role, p.is_super_admin
  `, [email]);

  console.log('\n✅  Utilizador actualizado com sucesso!\n');
  console.table(rows);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌  Erro:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
