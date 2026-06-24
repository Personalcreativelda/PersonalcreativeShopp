import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'naturerva_erp',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: false
});

let _connected = false;
pool.on('connect', () => {
  if (!_connected) {
    _connected = true;
    console.log('✅ PostgreSQL conectado à VPS');
  }
});

pool.on('error', (err) => {
  console.error('❌ Erro na pool PostgreSQL:', err.message);
});

export default pool;
