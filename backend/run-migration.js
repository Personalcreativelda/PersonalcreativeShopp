/**
 * Executa uma migração SQL directamente na base de dados de produção.
 * Uso: node run-migration.js [caminho-do-ficheiro.sql]
 * Sem argumento: corre FIX_NEW_MODULES_SCHEMA.sql por defeito.
 *
 * Exemplo: node run-migration.js ../sql/migrations/FIX_NEW_MODULES_SCHEMA.sql
 *
 * Usa um splitter de statements correcto que trata:
 *  - Literais de string  '...'  (incluindo '' escapado)
 *  - Comentários de linha  -- ...
 *  - Comentários de bloco  /* ... *\/
 */

import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const pool = new pg.Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl:      process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15000,
});

/**
 * Divide SQL em statements individuais respeitando:
 *  - strings  '...' com '' como escape
 *  - comentários  -- linha  e  /* bloco *\/
 * Ignora statements vazios ou só comentários.
 */
function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const nx = sql[i + 1];

    // Comentário de linha: -- até \n
    if (ch === '-' && nx === '-') {
      const end = sql.indexOf('\n', i);
      if (end === -1) { i = sql.length; break; }
      i = end + 1;
      continue; // descarta o comentário
    }

    // Comentário de bloco: /* ... */
    if (ch === '/' && nx === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) { i = sql.length; break; }
      i = end + 2;
      continue; // descarta o comentário
    }

    // String literal: '...' com '' como escape
    if (ch === "'") {
      cur += ch;
      i++;
      while (i < sql.length) {
        const sc = sql[i];
        cur += sc;
        i++;
        if (sc === "'") {
          if (sql[i] === "'") { // '' escapado — mantém dentro da string
            cur += sql[i];
            i++;
          } else {
            break; // fim da string
          }
        }
      }
      continue;
    }

    // Fim de statement
    if (ch === ';') {
      const stmt = cur.trim();
      if (stmt.length > 0) stmts.push(stmt + ';');
      cur = '';
      i++;
      continue;
    }

    cur += ch;
    i++;
  }

  // Statement sem ; no fim
  const last = cur.trim();
  if (last.length > 0) stmts.push(last);

  return stmts;
}

const sqlFile = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(__dirname, '../sql/migrations/FIX_NEW_MODULES_SCHEMA.sql');

console.log(`\n🗄️  DB: ${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`);
console.log(`📄 SQL: ${sqlFile}\n`);

let sql;
try {
  sql = readFileSync(sqlFile, 'utf8');
} catch (err) {
  console.error('❌  Erro ao ler ficheiro:', err.message);
  process.exit(1);
}

const statements = splitStatements(sql);
console.log(`🔢  ${statements.length} statements encontrados\n`);

const client = await pool.connect().catch(err => {
  console.error('❌  Erro ao ligar à BD:', err.message);
  process.exit(1);
});

let ok = 0;
let fail = 0;

try {
  await client.query('BEGIN');

  for (let idx = 0; idx < statements.length; idx++) {
    const stmt = statements[idx];
    // Preview do statement (primeiros 80 chars)
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
    try {
      await client.query(stmt);
      ok++;
      console.log(`  ✅  [${idx + 1}/${statements.length}] ${preview}`);
    } catch (err) {
      fail++;
      console.error(`  ❌  [${idx + 1}/${statements.length}] ${preview}`);
      console.error(`       → ${err.message}`);
      // Continua para os próximos statements (fora de transacção rígida)
      // Se quiser parar no primeiro erro, descomenta o throw abaixo:
      // throw err;
    }
  }

  await client.query('COMMIT');
  console.log(`\n✅  Migração concluída: ${ok} OK, ${fail} com erro.\n`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('\n❌  Rollback efectuado:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
