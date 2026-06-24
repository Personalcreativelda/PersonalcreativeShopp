import pool from './db.js';

const client = await pool.connect();
try {
  await client.query('BEGIN');

  await client.query(`
    INSERT INTO permissions(name, display_name, description, category)
    VALUES('admin.access','Acesso Admin','Acesso ao painel admin','system')
    ON CONFLICT(name) DO NOTHING
  `);

  const { rows: roles } = await client.query(`SELECT id FROM roles WHERE name <> 'CLIENTE'`);
  const { rows: perm } = await client.query(`SELECT id FROM permissions WHERE name = 'admin.access'`);

  for (const r of roles) {
    await client.query(
      `INSERT INTO role_permissions(role_id, permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [r.id, perm[0].id]
    );
  }
  console.log('admin.access atribuído a', roles.length, 'roles');

  const { rows: ex } = await client.query(`SELECT id FROM roles WHERE name = 'GESTOR_BLOG'`);
  if (!ex.length) {
    const { rows: nr } = await client.query(`
      INSERT INTO roles(name, display_name, description, is_system_role)
      VALUES('GESTOR_BLOG','Gestor de Blog','Gestao de artigos do blog', false)
      RETURNING id
    `);
    const { rows: ps } = await client.query(
      `SELECT id FROM permissions WHERE name IN ('admin.access','media.view','media.upload')`
    );
    for (const p of ps) {
      await client.query(
        `INSERT INTO role_permissions(role_id, permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [nr[0].id, p.id]
      );
    }
    console.log('Role GESTOR_BLOG criado:', nr[0].id);
  } else {
    console.log('GESTOR_BLOG já existe:', ex[0].id);
  }

  await client.query('COMMIT');
  console.log('Migração concluída com sucesso');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('Erro:', e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
