/**
 * Utilitário para validação de configuração do Supabase
 */

import type { SupabaseConfig, ValidationResult, ConnectionTestResult } from '../types/supabaseConfig';
import { createClient } from '@supabase/supabase-js';

/**
 * Valida se uma URL do Supabase é válida
 */
export const validateSupabaseUrl = (url: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!url || typeof url !== 'string') {
    errors.push('URL é obrigatória');
    return { isValid: false, errors, warnings };
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    errors.push('URL não pode estar vazia');
    return { isValid: false, errors, warnings };
  }

  // Validar formato de URL
  try {
    const urlObj = new URL(trimmedUrl);
    
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
      errors.push('URL deve usar protocolo http:// ou https://');
    }

    if (urlObj.protocol === 'http:') {
      warnings.push('Usar HTTPS é recomendado para produção');
    }

    // Validar se é um domínio Supabase
    if (!trimmedUrl.includes('supabase.co') && !trimmedUrl.includes('supabase.in')) {
      warnings.push('URL não parece ser um domínio Supabase válido');
    }
  } catch (e) {
    errors.push('URL inválida. Deve ser uma URL válida (ex: https://seuprojeto.supabase.co)');
    return { isValid: false, errors, warnings };
  }

  return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Valida se um token JWT é válido (validação básica de formato)
 */
export const validateJWT = (token: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!token || typeof token !== 'string') {
    errors.push('Token é obrigatório');
    return { isValid: false, errors, warnings };
  }

  const trimmedToken = token.trim();

  if (trimmedToken.length === 0) {
    errors.push('Token não pode estar vazio');
    return { isValid: false, errors, warnings };
  }

  // JWT básico: deve começar com "eyJ" (base64 de {")
  if (!trimmedToken.startsWith('eyJ')) {
    errors.push('Token parece inválido. Deve ser um JWT válido começando com "eyJ"');
    return { isValid: false, errors, warnings };
  }

  // JWT deve ter pelo menos 50 caracteres (mínimo razoável)
  if (trimmedToken.length < 50) {
    errors.push('Token parece muito curto. Verifique se está completo');
    return { isValid: false, errors, warnings };
  }

  // Validar estrutura básica do JWT (deve ter 3 partes separadas por ponto)
  const parts = trimmedToken.split('.');
  if (parts.length !== 3) {
    errors.push('Token JWT deve ter 3 partes separadas por ponto (header.payload.signature)');
    return { isValid: false, errors, warnings };
  }

  // Validar que cada parte não está vazia
  if (parts.some(part => part.length === 0)) {
    errors.push('Token JWT tem partes vazias');
    return { isValid: false, errors, warnings };
  }

  return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Valida uma configuração completa do Supabase
 */
export const validateSupabaseConfig = (config: SupabaseConfig): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validar URL
  const urlValidation = validateSupabaseUrl(config.url);
  errors.push(...urlValidation.errors);
  warnings.push(...urlValidation.warnings);

  // Validar anon key
  const keyValidation = validateJWT(config.anonKey);
  errors.push(...keyValidation.errors);
  warnings.push(...keyValidation.warnings);

  // Validar service role key se fornecida
  if (config.serviceRoleKey) {
    const serviceKeyValidation = validateJWT(config.serviceRoleKey);
    if (!serviceKeyValidation.isValid) {
      warnings.push('Service Role Key parece inválida: ' + serviceKeyValidation.errors.join(', '));
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Testa a conexão com o Supabase usando a configuração fornecida
 */
export const testConnection = async (config: SupabaseConfig): Promise<ConnectionTestResult> => {
  const startTime = Date.now();

  try {
    // Validar configuração primeiro
    const validation = validateSupabaseConfig(config);
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Configuração inválida',
        error: validation.errors.join('; ')
      };
    }

    // Criar cliente temporário para teste
    const testClient = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Tentar uma requisição simples (buscar uma tabela comum ou verificar saúde)
    // Usar uma query simples que não requer autenticação
    const { data, error } = await Promise.race([
      testClient.from('profiles').select('id').limit(1),
      new Promise<{ error: { message: string } }>((_, reject) =>
        setTimeout(() => reject({ error: { message: 'Timeout após 10 segundos' } }), 10000)
      )
    ]) as any;

    const responseTime = Date.now() - startTime;

    if (error) {
      // Alguns erros são esperados (como RLS ou tabela não existir)
      // Mas ainda indicam que a conexão funciona
      if (error.code === 'PGRST116' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
        return {
          success: true,
          message: 'Conexão estabelecida com sucesso (erro de permissão esperado)',
          responseTime
        };
      }

      return {
        success: false,
        message: 'Erro ao conectar com Supabase',
        error: error.message || 'Erro desconhecido',
        responseTime
      };
    }

    return {
      success: true,
      message: 'Conexão estabelecida com sucesso',
      responseTime
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    // Erro de CORS ou rede
    if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
      return {
        success: false,
        message: 'Erro de CORS ou rede. Verifique as configurações do Supabase Dashboard',
        error: error.message || 'Erro de rede',
        responseTime
      };
    }

    // Timeout
    if (error.error?.message?.includes('Timeout')) {
      return {
        success: false,
        message: 'Timeout ao conectar. Verifique sua conexão com a internet',
        error: error.error.message,
        responseTime
      };
    }

    return {
      success: false,
      message: 'Erro ao testar conexão',
      error: error.message || 'Erro desconhecido',
      responseTime
    };
  }
};
