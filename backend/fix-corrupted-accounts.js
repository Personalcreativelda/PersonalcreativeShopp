/**
 * fix-corrupted-accounts.js
 *
 * Corrige contas criadas com o bug da ordem dos argumentos em signUp:
 *   signUp(email, password, name, phone)  ← errado
 *   signUp(name, email, password, phone)  ← correto
 *
 * Resultado do bug na BD:
 *   profiles.name         = email do utilizador  (ex: "ekson.cuamba05@gmail.com")
 *   profiles.email        = senha em texto claro (ex: "@Palmira0008")
 *   profiles.password_hash = bcrypt(nome)        (hash do nome, não da senha)
 *
 * O que este script faz para cada conta corrompida:
 *   1. email     ← antigo name (o email real)
 *   2. name      ← prefixo do email com capitalização (melhor estimativa do nome)
 *   3. password_hash ← bcrypt(antigo email) = re-hash da senha original
 *   4. Corrige também a tabela customers se existir registo vinculado
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
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

// Detectar se um string parece um email
const looksLikeEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Derivar nome a partir do prefixo do email
// "ekson.cuamba05@gmail.com" → "Ekson Cuamba"
const nameFromEmail = (email) => {
  const prefix = email.split('@')[0];
  return prefix
    .replace(/[._\-0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || prefix;
};

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Encontrar contas corrompidas:
  // name parece email E email NÃO parece email (ou é claramente uma password)
  const { rows: corrupted } = await client.query(`
    SELECT id, name, email, phone
    FROM profiles
    WHERE name LIKE '%@%'
      AND name LIKE '%.%'
      AND email NOT LIKE '%@%.%'
    ORDER BY created_at
  `);

  console.log(`\n🔍 Contas corrompidas encontradas: ${corrupted.length}`);

  if (corrupted.length === 0) {
    console.log('✅ Nenhuma conta corrompida encontrada. A BD está limpa.');
    await client.query('ROLLBACK');
    process.exit(0);
  }

  let fixed = 0;
  for (const profile of corrupted) {
    // Salvar ponto de retorno por conta — falha numa não reverte as outras
    await client.query(`SAVEPOINT fix_${fixed}`);
    try {
      const realEmail = profile.name;
      const originalPassword = profile.email;
      const derivedName = nameFromEmail(realEmail);

      console.log(`\n  📋 ID: ${profile.id}`);
      console.log(`     name (email real):   ${realEmail}`);
      console.log(`     email (senha orig):  ${originalPassword}`);
      console.log(`     nome derivado:       ${derivedName}`);
      console.log(`     telefone:            ${profile.phone || 'N/A'}`);

      // Se email já existe (duplicado), desactivar esta conta em vez de corrigir
      const { rows: existing } = await client.query(
        'SELECT id FROM profiles WHERE LOWER(email) = LOWER($1) AND id <> $2',
        [realEmail.trim(), profile.id]
      );
      if (existing.length) {
        await client.query(
          "UPDATE profiles SET email = $1, is_active = false, updated_at = NOW() WHERE id = $2",
          [`dup_${Date.now()}@removed.invalid`, profile.id]
        );
        console.log(`     ⚠️  Email duplicado — conta desactivada (outra conta já usa este email)`);
        await client.query(`RELEASE SAVEPOINT fix_${fixed}`);
        fixed++;
        continue;
      }

      // Fazer novo hash da senha original (que estava no campo email)
      const newHash = await bcrypt.hash(originalPassword, 12);

      // Corrigir profiles
      await client.query(`
        UPDATE profiles
        SET email = $1, name = $2, password_hash = $3, updated_at = NOW()
        WHERE id = $4
      `, [realEmail.trim(), derivedName, newHash, profile.id]);

      // Corrigir customers — ligar pelo telefone ou pelo email errado
      const cleanPhone = (profile.phone || '').replace(/\D/g, '');
      const { rows: custRows } = await client.query(
        `SELECT id FROM customers
         WHERE (phone = $1 AND $1 <> '')
            OR email = $2
         LIMIT 1`,
        [cleanPhone, originalPassword]
      );
      if (custRows.length) {
        await client.query(
          "UPDATE customers SET name = $1, email = $2, updated_at = NOW() WHERE id = $3",
          [derivedName, realEmail.trim(), custRows[0].id]
        );
        console.log(`     ✅ customers actualizado (id: ${custRows[0].id})`);
      } else {
        console.log(`     ℹ️  customers: sem registo vinculado`);
      }

      await client.query(`RELEASE SAVEPOINT fix_${fixed}`);
      console.log(`     ✅ profiles corrigido`);
      fixed++;
    } catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT fix_${fixed}`);
      console.error(`     ❌ Erro ao corrigir ${profile.id}: ${err.message}`);
      fixed++;
    }
  }

  await client.query('COMMIT');

  console.log(`\n✅ ${fixed} conta(s) processadas com sucesso!`);
  console.log('\n⚠️  NOTA: Os utilizadores afectados podem agora fazer login com:');
  console.log('   - Email: o seu email real (ex: ekson.cuamba05@gmail.com)');
  console.log('   - Senha: a senha que criaram originalmente');
  console.log('\n   O nome foi derivado do email. Podem actualizá-lo no perfil.\n');

} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ Erro na correcção:', err.message);
  console.error(err);
} finally {
  client.release();
  await pool.end();
}
