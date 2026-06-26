/**
 * migrate.js — cria todas as tabelas do projecto do zero.
 *
 * Como módulo:  import { runMigrations } from './migrate.js'
 * Como script:  node migrate.js   (usa o pool interno com .env)
 *
 * Activado automaticamente no arranque do servidor quando RUN_MIGRATIONS=true.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

// Em Docker: sql/ é copiado para /app/sql/ (mesmo nível que o backend)
// Em desenvolvimento local (node directo): sql/ está em ../sql relativamente ao backend/
const SQL_DIR = existsSync(resolve(__dirname, 'sql'))
  ? resolve(__dirname, 'sql')
  : resolve(__dirname, '../sql');

// ── Ordem de execução (respeita dependências entre tabelas) ───────────────────
const MIGRATIONS = [
  { file: 'PARTE_1_TABELAS_BASE.sql',                        dir: SQL_DIR },
  { file: 'PARTE_2_TABELAS_TRANSACOES.sql',                  dir: SQL_DIR },
  { file: 'PARTE_3_INDICES_DADOS.sql',                       dir: SQL_DIR },
  { file: 'fixes/ADD_PRODUCT_CONTENT_FIELDS.sql',            dir: SQL_DIR },
  { file: 'migrations/ALTER_PROFILES_ADD_COLUMNS.sql',       dir: SQL_DIR },
  { file: 'migrations/CREATE_PERMISSIONS_SYSTEM.sql',        dir: SQL_DIR },
  { file: 'migrations/CREATE_TRACKING_TABLES.sql',           dir: SQL_DIR },
  { file: 'migrations/ADD_CATEGORY_UNIT_COLUMNS.sql',        dir: SQL_DIR },
  { file: 'migrations/CREATE_STOCK_TABLES.sql',              dir: SQL_DIR },
  { file: 'migrations/CREATE_COUPONS_SYSTEM.sql',            dir: SQL_DIR },
  { file: 'migrations/CREATE_AFFILIATE_SYSTEM.sql',          dir: SQL_DIR },
  { file: 'migrations/CREATE_POINTS_TRACKING.sql',           dir: SQL_DIR },
  { file: 'migrations/ADD_PROMOTIONAL_PRICE.sql',            dir: SQL_DIR },
  { file: 'migrations/ADD_LOGISTICS_AFFILIATE_ROLES.sql',    dir: SQL_DIR },
  { file: 'migrations/ALTER_REFUND_REQUESTS_ADD_PHOTOS.sql', dir: SQL_DIR },
  { file: 'migrations/CREATE_POS_SESSIONS.sql',              dir: SQL_DIR },
  { file: 'migrations/ADD_BARCODE_TO_PRODUCTS.sql',          dir: SQL_DIR },
  { file: 'migrations/CREATE_TAX_CONFIG.sql',                dir: SQL_DIR },
  { file: 'migrations/ADD_VAT_REGIME_TO_PRODUCTS.sql',       dir: SQL_DIR },
  { file: 'migrations/ADD_DELIVERY_ESTIMATES_TO_ORDERS.sql', dir: SQL_DIR },
  { file: 'migrations/FIX_POS_PAYMENT_STATUS.sql',           dir: SQL_DIR },
  { file: 'migrations/CREATE_POS_SHIFTS_AND_LOYALTY.sql',    dir: SQL_DIR },
  { file: 'migrations/CREATE_PURCHASE_WORKFLOW.sql',         dir: SQL_DIR },
  { file: 'migrations/CREATE_INVOICES.sql',                  dir: SQL_DIR },
  { file: 'migrations/CREATE_AP_LEDGER.sql',                 dir: SQL_DIR },
  { file: 'migrations/FIX_NEW_MODULES_SCHEMA.sql',           dir: SQL_DIR },
  { file: 'migrations/FIX_CHAT_SCHEMA.sql',                  dir: SQL_DIR },
  { file: 'migrations/SEED_DELIVERY_ZONES_MAPUTO.sql',       dir: SQL_DIR },
  { file: 'migrations/CREATE_BLOG_POSTS.sql',                dir: SQL_DIR },
  { file: 'migrations/SEED_GRAFICA_CATEGORIES_UNITS.sql',    dir: SQL_DIR },
  { file: 'migrations/RETROACTIVE_AWARD_POINTS.sql',         dir: SQL_DIR },
];

// ── SQL splitter (respeita strings e comentários) ─────────────────────────────
function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i], nx = sql[i + 1];
    if (ch === '-' && nx === '-') {
      const end = sql.indexOf('\n', i);
      if (end === -1) { i = sql.length; break; }
      i = end + 1; continue;
    }
    if (ch === '/' && nx === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) { i = sql.length; break; }
      i = end + 2; continue;
    }
    // Dollar-quoting: $$...$$ or $tag$...$tag$
    if (ch === '$') {
      let tagEnd = i + 1;
      while (tagEnd < sql.length && /[A-Za-z0-9_]/.test(sql[tagEnd])) tagEnd++;
      if (tagEnd < sql.length && sql[tagEnd] === '$') {
        const tag = sql.slice(i, tagEnd + 1);
        const closeIdx = sql.indexOf(tag, tagEnd + 1);
        if (closeIdx !== -1) {
          cur += sql.slice(i, closeIdx + tag.length);
          i = closeIdx + tag.length;
          continue;
        }
      }
      cur += ch; i++;
      continue;
    }
    if (ch === "'") {
      cur += ch; i++;
      while (i < sql.length) {
        const sc = sql[i]; cur += sc; i++;
        if (sc === "'") { if (sql[i] === "'") { cur += sql[i]; i++; } else break; }
      }
      continue;
    }
    if (ch === ';') {
      const stmt = cur.trim();
      if (stmt.length > 0) stmts.push(stmt + ';');
      cur = ''; i++; continue;
    }
    cur += ch; i++;
  }
  const last = cur.trim();
  if (last.length > 0) stmts.push(last);
  return stmts;
}

async function runFile(pool, filePath, label) {
  if (!existsSync(filePath)) {
    console.log(`  ⚠  ${label} — não encontrado, ignorado`);
    return { ok: 0, fail: 0 };
  }
  const sql = readFileSync(filePath, 'utf8');
  const stmts = splitStatements(sql);
  if (stmts.length === 0) return { ok: 0, fail: 0 };

  const client = await pool.connect();
  let ok = 0, fail = 0;
  try {
    await client.query('BEGIN');
    for (const stmt of stmts) {
      try { await client.query(stmt); ok++; }
      catch (err) {
        fail++;
        const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
        console.warn(`    ✗ ${preview}\n      → ${err.message}`);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ❌ ROLLBACK ${label}: ${err.message}`);
    fail += stmts.length - ok;
  } finally {
    client.release();
  }
  return { ok, fail };
}

// ── Exportado para uso em server.js ──────────────────────────────────────────
export async function runMigrations(pool) {
  console.log('\n🗄️  Iniciando migração completa da base de dados…');
  let totalOk = 0, totalFail = 0;

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const { file, dir } = MIGRATIONS[i];
    const num = String(i + 1).padStart(2, '0');
    process.stdout.write(`  [${num}/${MIGRATIONS.length}] ${file} … `);
    const { ok, fail } = await runFile(pool, join(dir, file), file);
    totalOk += ok; totalFail += fail;
    process.stdout.write(fail === 0 ? `✅ ${ok} stmt\n` : `⚠  ${ok} OK / ${fail} erro(s)\n`);
  }

  console.log(`\n✅ Migração concluída: ${totalOk} statements OK${totalFail > 0 ? `, ${totalFail} com erro` : ''}\n`);
  return { totalOk, totalFail };
}

// ── Quando corrido directamente: node migrate.js ──────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const pool = new pg.Pool({
    host:     process.env.PG_HOST,
    port:     parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE,
    user:     process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl:      process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
    max: 3,
  });

  console.log(`\n━━━ Migração Completa ━━━`);
  console.log(`DB: ${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}\n`);

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Ligação à BD estabelecida\n');
  } catch (err) {
    console.error(`❌ Não foi possível ligar à BD: ${err.message}`);
    process.exit(1);
  }

  await runMigrations(pool);
  await pool.end();
  process.exit(0);
}
