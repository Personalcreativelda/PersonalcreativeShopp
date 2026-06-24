/**
 * check-schema.js — Verifica o estado real das tabelas no PostgreSQL
 * e compara com o que o dashboard precisa.
 * Uso: node check-schema.js
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: false,
  connectionTimeoutMillis: 10000,
});

// Definição esperada: tabela → colunas mínimas necessárias
const EXPECTED = {
  profiles: ['id','email','name','role','created_at'],
  products: ['id','name','slug','price','cost_price','stock','min_stock','unit','category','image','show_in_shop','description','description_long','benefits','how_to_use','ingredients','type'],
  product_variants: ['id','product_id','name','price','cost_price','stock','min_stock','unit','is_default','display_order','image'],
  categories: ['id','name','description','color','icon','is_active','display_order'],
  units: ['id','name','abbreviation','description','is_active'],
  variant_templates: ['id','name','description','values','is_active'],
  customers: ['id','name','phone','email','address','total_orders','total_spent','tier','last_order_date','created_at'],
  orders: ['id','customer_id','customer_name','customer_phone','items','total_amount','status','payment_status','amount_paid','is_delivery','delivery_fee','created_at','created_by'],
  sales: ['id','date','items','total_sales','total_deliveries','value_received','difference','notes','sale_type','created_at'],
  purchases: ['id','supplier_id','supplier_name','items','total_amount','status','payment_status','date','created_at'],
  suppliers: ['id','name','contact','phone','email','address','notes','created_at'],
  stock_movements: ['id','date','items','notes','source_reference','created_at'],
  stock_transactions: ['id','product_id','variant_id','quantity','type','source_type','created_at'],
  stock_adjustments: ['id','product_id','variant_id','quantity','reason','created_at'],
  stock_audits: ['id','audit_date','description','created_by','status','created_at'],
  stock_config: ['id','reset_date','reset_reason','is_active','created_at'],
  stock_initial_snapshot: ['id','snapshot_date','product_id','variant_id','quantity'],
  delivery_zones: ['id','name','price','is_active'],
  shop_visits: ['id','visitor_id','page_path','session_id','device_type','created_at'],
  admin_activity_log: ['id','user_id','page_path','action_type','created_at'],
  roles: ['id','name','display_name','description','is_system_role'],
  permissions: ['id','name','description','category'],
  role_permissions: ['id','role_id','permission_id'],
  user_roles: ['id','user_id','role_id'],
  shop_banners: ['id','title','image_url','is_active'],
};

async function main() {
  const client = await pool.connect();
  console.log(`✅ Conectado a ${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}\n`);

  // 1. Listar todas as tabelas existentes
  const { rows: existingTables } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const existing = new Set(existingTables.map(r => r.table_name));

  console.log('══════════════════════════════════════════');
  console.log('  ESTADO DAS TABELAS');
  console.log('══════════════════════════════════════════\n');

  const missing_tables = [];
  const missing_columns = {};

  for (const [table, expectedCols] of Object.entries(EXPECTED)) {
    if (!existing.has(table)) {
      missing_tables.push(table);
      console.log(`❌ TABELA EM FALTA: ${table}`);
      continue;
    }

    // Verificar colunas
    const { rows: cols } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    const colNames = new Set(cols.map(c => c.column_name));

    const missingCols = expectedCols.filter(c => !colNames.has(c));
    if (missingCols.length > 0) {
      missing_columns[table] = missingCols;
      console.log(`⚠️  ${table} — colunas em falta: ${missingCols.join(', ')}`);
    } else {
      console.log(`✅ ${table} — OK (${cols.length} colunas)`);
    }
  }

  // Tabelas que existem mas não estão na lista esperada (informativo)
  const extra = [...existing].filter(t => !t.startsWith('_') && !EXPECTED[t]);
  if (extra.length > 0) {
    console.log(`\nℹ️  Tabelas extras no banco (não verificadas): ${extra.join(', ')}`);
  }

  // Resumo
  console.log('\n══════════════════════════════════════════');
  console.log('  RESUMO');
  console.log('══════════════════════════════════════════');
  if (missing_tables.length === 0 && Object.keys(missing_columns).length === 0) {
    console.log('🎉 Tudo em ordem! Nenhuma tabela ou coluna em falta.');
  } else {
    if (missing_tables.length > 0) {
      console.log(`\n❌ Tabelas em falta (${missing_tables.length}):`);
      missing_tables.forEach(t => console.log(`   - ${t}`));
    }
    if (Object.keys(missing_columns).length > 0) {
      console.log(`\n⚠️  Tabelas com colunas em falta:`);
      for (const [t, cols] of Object.entries(missing_columns)) {
        console.log(`   - ${t}: ${cols.join(', ')}`);
      }
    }
  }

  client.release();
  try { await pool.end(); } catch {}
}

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});
