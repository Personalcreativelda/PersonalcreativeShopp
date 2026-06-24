/**
 * Cliente PostgreSQL
 * 
 * Configuração central para conexão com PostgreSQL
 */

import postgres from 'postgres';

// Verificar se está usando PostgreSQL
const usePostgres = import.meta.env.VITE_DATABASE_TYPE === 'postgresql';

// Configurar conexão PostgreSQL
let sql: ReturnType<typeof postgres> | null = null;

if (usePostgres) {
  sql = postgres({
    host: import.meta.env.VITE_PG_HOST || 'localhost',
    port: parseInt(import.meta.env.VITE_PG_PORT || '5432'),
    database: import.meta.env.VITE_PG_DATABASE || 'naturerva_erp',
    username: import.meta.env.VITE_PG_USER || 'postgres',
    password: import.meta.env.VITE_PG_PASSWORD,
    max: 20, // pool size
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {}, // Silenciar notices do PostgreSQL
  });

  console.log('✅ PostgreSQL conectado');
}

export { sql, usePostgres };

// Tipos para queries
export type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  price: number;
  cost_price?: number;
  stock: number;
  min_stock?: number;
  unit: string;
  image?: string;
  show_in_shop: boolean;
  featured?: boolean;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
  image?: string;
  created_at: Date;
  updated_at: Date;
};

// Helper para testar conexão
export async function testConnection() {
  if (!sql) {
    console.warn('⚠️ PostgreSQL não configurado');
    return false;
  }

  try {
    const [result] = await sql`SELECT NOW() as timestamp, current_database() as db`;
    console.log('✅ Teste de conexão PostgreSQL:', result);
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar PostgreSQL:', error);
    return false;
  }
}

// Helper para encerrar conexão (útil para cleanup)
export async function closeConnection() {
  if (sql) {
    await sql.end();
    console.log('🔌 Conexão PostgreSQL encerrada');
  }
}
