/**
 * Utilitário para testar conexão com Supabase e diagnosticar problemas CORS
 * Execute no console do navegador: testSupabaseConnection()
 */

import { getSupabaseConfig, getConfigInfo, getSupabaseClient } from '../services/supabaseClient';
import { testConnection } from './supabaseConfigValidator';
import { formatDateTimeForReport } from './dateUtils';

export const testSupabaseConnection = async () => {
  console.log('🔍 Testando conexão com Supabase...\n');

  // 1. Verificar configuração
  const configInfo = getConfigInfo();
  const config = getSupabaseConfig();

  if (!config) {
    console.error('❌ Nenhuma configuração encontrada!');
    console.log('\n💡 Dicas:');
    console.log('  - Configure via variáveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)');
    console.log('  - Ou configure via UI em Settings > Connection Settings');
    return;
  }

  console.log('📋 Configuração:');
  console.log('  Origem:', configInfo.source);
  console.log('  URL:', config.url);
  console.log('  Key:', config.anonKey.substring(0, 20) + '...\n');

  // 2. Validar configuração
  console.log('1️⃣ Validando configuração...');
  const { validateSupabaseConfig } = await import('./supabaseConfigValidator');
  const validation = validateSupabaseConfig(config);
  
  if (!validation.isValid) {
    console.error('  ❌ Configuração inválida:');
    validation.errors.forEach(err => console.error('    -', err));
    return;
  }
  
  if (validation.warnings.length > 0) {
    console.warn('  ⚠️  Avisos:');
    validation.warnings.forEach(warn => console.warn('    -', warn));
  }
  
  console.log('  ✅ Configuração válida\n');

  // 3. Testar conexão
  console.log('2️⃣ Testando conexão com Supabase...');
  const connectionTest = await testConnection(config);
  
  if (connectionTest.success) {
    console.log('  ✅', connectionTest.message);
    if (connectionTest.responseTime) {
      console.log('  ⏱️  Tempo de resposta:', connectionTest.responseTime + 'ms');
    }
  } else {
    console.error('  ❌', connectionTest.message);
    if (connectionTest.error) {
      console.error('  Erro:', connectionTest.error);
    }
    if (connectionTest.responseTime) {
      console.log('  ⏱️  Tempo de resposta:', connectionTest.responseTime + 'ms');
    }
  }

  console.log('\n');

  // 4. Verificar cliente Supabase
  console.log('3️⃣ Verificando cliente Supabase...');
  const client = getSupabaseClient();
  
  if (!client) {
    console.error('  ❌ Cliente não inicializado');
    return;
  }
  
  console.log('  ✅ Cliente inicializado');

  // 5. Verificar sessão
  console.log('\n4️⃣ Verificando sessão...');
  try {
    const { data: { session } } = await client.auth.getSession();
    
    if (session) {
      console.log('  ✅ Sessão encontrada');
      console.log('  Dados da sessão:', {
        expires_at: session.expires_at ? formatDateTimeForReport(new Date(session.expires_at * 1000)) : 'N/A',
        user_id: session.user?.id || 'N/A',
        email: session.user?.email || 'N/A'
      });
    } else {
      console.log('  ⚠️  Nenhuma sessão encontrada - faça login primeiro');
    }
  } catch (error: any) {
    console.error('  ❌ Erro ao verificar sessão:', error.message);
  }

  console.log('\n');

  // 6. Testar requisição autenticada (se houver sessão)
  console.log('5️⃣ Testando requisição autenticada...');
  try {
    const { data: { session } } = await client.auth.getSession();
    
    if (session) {
      const { data, error } = await client
        .from('profiles')
        .select('id, name')
        .limit(1);
      
      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
          console.log('  ⚠️  Erro de permissão (RLS) - isso é esperado se não houver dados ou políticas restritivas');
          console.log('  Mensagem:', error.message);
        } else {
          console.error('  ❌ Erro:', error.message);
        }
      } else {
        console.log('  ✅ Sucesso! Dados:', data);
      }
    } else {
      console.log('  ⚠️  Pulando teste autenticado - nenhuma sessão encontrada');
    }
  } catch (error: any) {
    console.error('  ❌ Erro:', error.message);
  }

  console.log('\n');
  console.log('✅ Teste concluído!');
  console.log('\n💡 Dicas:');
  console.log('  - Se houver erros CORS, verifique as configurações no Supabase Dashboard');
  console.log('  - Se houver erro 401, faça login novamente');
  console.log('  - Se houver erro 403, verifique as políticas RLS');
  console.log('  - Se usar variáveis de ambiente, elas têm prioridade sobre localStorage');
};

// Tornar disponível globalmente para uso no console
if (typeof window !== 'undefined') {
  (window as any).testSupabaseConnection = testSupabaseConnection;
}
