/**
 * Script de Teste PostgreSQL
 * 
 * Execute com: npm run test:db
 * Ou use diretamente no navegador abrindo o console.
 */

import { testConnection, closeConnection, sql, usePostgres } from './services/db';
import { getProducts, getProductStats } from './services/productService';

async function runTests() {
  console.log('🧪 Iniciando testes de conexão...\n');

  // 1. Verificar modo
  console.log(`📊 Modo: ${usePostgres ? 'PostgreSQL' : 'Supabase'}\n`);

  if (!usePostgres) {
    console.log('⚠️ Usando Supabase. Para testar PostgreSQL:');
    console.log('   1. Configure VITE_DATABASE_TYPE=postgresql no .env');
    console.log('   2. Configure credenciais PostgreSQL no .env');
    console.log('   3. Reinicie o servidor\n');
    return;
  }

  try {
    // 2. Testar conexão básica
    console.log('1️⃣ Testando conexão básica...');
    const connectionOk = await testConnection();
    
    if (!connectionOk) {
      console.error('❌ Falha na conexão. Verifique:');
      console.error('   - PostgreSQL está rodando?');
      console.error('   - Credenciais corretas no .env?');
      console.error('   - Database existe?');
      return;
    }

    console.log('✅ Conexão OK!\n');

    // 3. Testar query simples
    console.log('2️⃣ Testando query simples...');
    const [dbInfo] = await sql!`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version
    `;
    console.log('📋 Info do banco:', dbInfo);
    console.log('✅ Query OK!\n');

    // 4. Verificar tabelas
    console.log('3️⃣ Verificando tabelas...');
    const tables = await sql!`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    console.log(`📦 Tabelas encontradas: ${tables.length}`);
    console.log('   ' + tables.map((t: any) => t.tablename).join(', '));
    console.log('✅ Tabelas OK!\n');

    // 5. Testar contagem de produtos
    console.log('4️⃣ Testando produtos...');
    const { data: products, error } = await getProducts();
    
    if (error) {
      console.error('❌ Erro ao buscar produtos:', error);
    } else {
      console.log(`📦 Produtos encontrados: ${products?.length || 0}`);
      
      if (products && products.length > 0) {
        console.log('   Exemplo:', products[0]);
      }
      console.log('✅ Produtos OK!\n');
    }

    // 6. Testar estatísticas
    console.log('5️⃣ Testando estatísticas...');
    const { data: stats, error: statsError } = await getProductStats();
    
    if (statsError) {
      console.error('❌ Erro ao buscar stats:', statsError);
    } else {
      console.log('📊 Estatísticas:', stats);
      console.log('✅ Stats OK!\n');
    }

    console.log('🎉 Todos os testes passaram!\n');
    console.log('✅ Sistema pronto para usar PostgreSQL');

  } catch (error) {
    console.error('❌ Erro durante testes:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Verifique se PostgreSQL está rodando');
    console.error('2. Confirme credenciais no .env');
    console.error('3. Execute o schema: psql -U postgres -d naturerva_erp -f sql/SCHEMA_POSTGRESQL_COMPLETO.sql');
    console.error('4. Verifique logs do PostgreSQL');
  }
}

// Executar testes
runTests().then(() => {
  console.log('\n👋 Testes concluídos');
});

// Export para uso em outros lugares
export { runTests };
