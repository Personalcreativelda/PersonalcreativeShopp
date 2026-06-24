/**
 * run-all-migrations.js
 * Cria todas as tabelas do projecto do zero, na ordem correcta.
 * Uso: cd backend && node run-all-migrations.js
 *
 * Cada ficheiro SQL corre na sua própria transacção.
 * Se um ficheiro falhar, os restantes continuam.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

// ── Ordem de execução (dependências respeitadas) ───────────────────────────────
// Em Docker: sql/ está em /app/sql/ — em dev local está em ../sql/
const SQL_DIR = existsSync(resolve(__dirname, 'sql'))
  ? resolve(__dirname, 'sql')
  : resolve(__dirname, '../sql');

const MIGRATIONS = [
  // 1. Tabelas base (profiles, roles, permissions, products, categories…)
  { file: 'PARTE_1_TABELAS_BASE.sql',                            dir: SQL_DIR },
  // 2. Tabelas de transacções (orders, sales, purchases, customers…)
  { file: 'PARTE_2_TABELAS_TRANSACOES.sql',                      dir: SQL_DIR },
  // 3. Índices e dados iniciais
  { file: 'PARTE_3_INDICES_DADOS.sql',                           dir: SQL_DIR },
  // 4. Campos extra de produto (benefits, how_to_use, ingredients)
  { file: 'fixes/ADD_PRODUCT_CONTENT_FIELDS.sql',                dir: SQL_DIR },
  // 5. Colunas extras em profiles (password_hash, avatar_url, location_ids)
  { file: 'migrations/ALTER_PROFILES_ADD_COLUMNS.sql',           dir: SQL_DIR },
  // 6. Sistema de roles e permissões granulares
  { file: 'migrations/CREATE_PERMISSIONS_SYSTEM.sql',            dir: SQL_DIR },
  // 7. Tabelas de tracking (shop_visits, admin_activity_log)
  { file: 'migrations/CREATE_TRACKING_TABLES.sql',               dir: SQL_DIR },
  // 8. Colunas category_id / unit_id nos produtos
  { file: 'migrations/ADD_CATEGORY_UNIT_COLUMNS.sql',            dir: SQL_DIR },
  // 9. Tabelas de stock (movements, adjustments, audits, lots, alerts)
  { file: 'migrations/CREATE_STOCK_TABLES.sql',                  dir: SQL_DIR },
  // 10. Sistema de cupões
  { file: 'migrations/CREATE_COUPONS_SYSTEM.sql',                dir: SQL_DIR },
  // 11. Sistema de afiliados
  { file: 'migrations/CREATE_AFFILIATE_SYSTEM.sql',              dir: SQL_DIR },
  // 12. Rastreio de pontos de fidelidade
  { file: 'migrations/CREATE_POINTS_TRACKING.sql',               dir: SQL_DIR },
  // 13. Preço promocional nos produtos
  { file: 'migrations/ADD_PROMOTIONAL_PRICE.sql',                dir: SQL_DIR },
  // 14. Roles de logística e afiliado
  { file: 'migrations/ADD_LOGISTICS_AFFILIATE_ROLES.sql',        dir: SQL_DIR },
  // 15. Fotos em pedidos de reembolso
  { file: 'migrations/ALTER_REFUND_REQUESTS_ADD_PHOTOS.sql',     dir: SQL_DIR },
  // 16. Sessões de POS
  { file: 'migrations/CREATE_POS_SESSIONS.sql',                  dir: SQL_DIR },
  // 17. Código de barras nos produtos
  { file: 'migrations/ADD_BARCODE_TO_PRODUCTS.sql',              dir: SQL_DIR },
  // 18. Configuração de taxas (IVA)
  { file: 'migrations/CREATE_TAX_CONFIG.sql',                    dir: SQL_DIR },
  // 19. Regime de IVA por produto
  { file: 'migrations/ADD_VAT_REGIME_TO_PRODUCTS.sql',           dir: SQL_DIR },
  // 20. Estimativas de entrega nos pedidos
  { file: 'migrations/ADD_DELIVERY_ESTIMATES_TO_ORDERS.sql',     dir: SQL_DIR },
  // 21. Fix: estado de pagamento nas sessões POS
  { file: 'migrations/FIX_POS_PAYMENT_STATUS.sql',               dir: SQL_DIR },
  // 22. Turnos de caixa e fidelidade avançada
  { file: 'migrations/CREATE_POS_SHIFTS_AND_LOYALTY.sql',        dir: SQL_DIR },
  // 23. Workflow de compras (purchase_orders, itens, recepção…)
  { file: 'migrations/CREATE_PURCHASE_WORKFLOW.sql',             dir: SQL_DIR },
  // 24. Facturas
  { file: 'migrations/CREATE_INVOICES.sql',                      dir: SQL_DIR },
  // 25. Contas a pagar e razão geral
  { file: 'migrations/CREATE_AP_LEDGER.sql',                     dir: SQL_DIR },
  // 26. Novos módulos (drop + recria com schema correcto: RH, Projectos, Helpdesk…)
  { file: 'migrations/FIX_NEW_MODULES_SCHEMA.sql',               dir: SQL_DIR },
  // 27. Fix adicional schema de chat
  { file: 'migrations/FIX_CHAT_SCHEMA.sql',                      dir: SQL_DIR },
  // 28. Zonas de entrega de Maputo (seed)
  { file: 'migrations/SEED_DELIVERY_ZONES_MAPUTO.sql',           dir: SQL_DIR },
  // 29. Pontos retroativos para pedidos já entregues (corre por último)
  { file: 'migrations/RETROACTIVE_AWARD_POINTS.sql',             dir: SQL_DIR },
];

// ── SQL statement splitter (trata strings, comentários --, /* */) ─────────────
function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const nx = sql[i + 1];

    if (ch === '-' && nx === '-') {
      const end = sql.indexOf('\n', i);
      if (end === -1) { i = sql.length; break; }
      i = end + 1;
      continue;
    }

    if (ch === '/' && nx === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) { i = sql.length; break; }
      i = end + 2;
      continue;
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
        if (sc === "'") {
          if (sql[i] === "'") { cur += sql[i]; i++; }
          else break;
        }
      }
      continue;
    }

    if (ch === ';') {
      const stmt = cur.trim();
      if (stmt.length > 0) stmts.push(stmt + ';');
      cur = ''; i++;
      continue;
    }

    cur += ch; i++;
  }

  const last = cur.trim();
  if (last.length > 0) stmts.push(last);
  return stmts;
}

// ── Cores para terminal ───────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  dim:    '\x1b[2m',
};

function log(icon, color, msg) {
  console.log(`${color}${icon}${C.reset} ${msg}`);
}

// ── Executa um único ficheiro SQL ─────────────────────────────────────────────
async function runFile(pool, filePath, label) {
  if (!existsSync(filePath)) {
    log('⚠ ', C.yellow, `${label} — ficheiro não encontrado, ignorado`);
    return { ok: 0, fail: 0, skipped: true };
  }

  const sql = readFileSync(filePath, 'utf8');
  const statements = splitStatements(sql);

  if (statements.length === 0) {
    log('⚠ ', C.yellow, `${label} — sem statements, ignorado`);
    return { ok: 0, fail: 0, skipped: true };
  }

  const client = await pool.connect();
  let ok = 0, fail = 0;

  try {
    await client.query('BEGIN');

    for (let idx = 0; idx < statements.length; idx++) {
      const stmt = statements[idx];
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 90);
      try {
        await client.query(stmt);
        ok++;
      } catch (err) {
        fail++;
        console.log(`  ${C.red}✗${C.reset} ${C.dim}[${idx + 1}/${statements.length}]${C.reset} ${preview}`);
        console.log(`    ${C.red}→ ${err.message}${C.reset}`);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`${C.red}ROLLBACK em ${label}: ${err.message}${C.reset}`);
    fail += statements.length - ok;
  } finally {
    client.release();
  }

  return { ok, fail, skipped: false };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl:      process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15000,
  max: 5,
});

console.log(`\n${C.bold}${C.cyan}━━━ Migração Completa do Projecto ━━━${C.reset}`);
console.log(`${C.dim}DB: ${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}${C.reset}\n`);

// Testar ligação antes de começar
try {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  log('✅', C.green, 'Ligação à BD estabelecida');
} catch (err) {
  log('❌', C.red, `Não foi possível ligar à BD: ${err.message}`);
  process.exit(1);
}

console.log('');

let totalOk = 0, totalFail = 0, totalSkipped = 0;
const results = [];

for (let i = 0; i < MIGRATIONS.length; i++) {
  const { file, dir } = MIGRATIONS[i];
  const filePath = join(dir, file);
  const label = file;
  const num = String(i + 1).padStart(2, '0');

  process.stdout.write(`${C.dim}[${num}/${MIGRATIONS.length}]${C.reset} ${C.cyan}${label}${C.reset} … `);

  const { ok, fail, skipped } = await runFile(pool, filePath, label);

  if (skipped) {
    process.stdout.write(`${C.yellow}ignorado${C.reset}\n`);
    totalSkipped++;
  } else if (fail === 0) {
    process.stdout.write(`${C.green}✅ ${ok} statements${C.reset}\n`);
  } else {
    process.stdout.write(`${C.yellow}⚠  ${ok} OK, ${fail} erro(s)${C.reset}\n`);
  }

  totalOk   += ok;
  totalFail += fail;
  results.push({ file, ok, fail, skipped });
}

await pool.end();

console.log(`\n${C.bold}━━━ Resultado Final ━━━${C.reset}`);
console.log(`${C.green}✅ Statements executados: ${totalOk}${C.reset}`);
if (totalFail > 0) console.log(`${C.red}❌ Statements com erro:   ${totalFail}${C.reset}`);
if (totalSkipped > 0) console.log(`${C.yellow}⚠  Ficheiros ignorados:   ${totalSkipped}${C.reset}`);

if (totalFail > 0) {
  console.log(`\n${C.yellow}Ficheiros com erros:${C.reset}`);
  results.filter(r => r.fail > 0).forEach(r => {
    console.log(`  ${C.red}✗${C.reset} ${r.file} — ${r.fail} erro(s)`);
  });
}

console.log(`\n${C.dim}Dica: erros do tipo "already exists" ou "does not exist" em ALTER TABLE são normais se o schema já existia parcialmente.${C.reset}\n`);
