/**
 * Tipos e interfaces para configuração do Supabase
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Origem da configuração do Supabase
 */
export enum ConfigSource {
  /** Configuração via variáveis de ambiente */
  ENV = 'env',
  /** Configuração via localStorage (UI) */
  LOCAL_STORAGE = 'localStorage',
  /** Nenhuma configuração disponível */
  NONE = 'none'
}

/**
 * Configuração completa do Supabase
 */
export interface SupabaseConfig {
  /** URL do projeto Supabase */
  url: string;
  /** Chave anônima (anon key) do Supabase */
  anonKey: string;
  /** Chave de service role (opcional, apenas para operações admin) */
  serviceRoleKey?: string;
  /** Google Client ID para OAuth (opcional) */
  googleClientId?: string;
}

/**
 * Opções de configuração do cliente Supabase
 */
export interface SupabaseClientOptions {
  /** Auto-refresh de tokens */
  autoRefreshToken?: boolean;
  /** Persistir sessão */
  persistSession?: boolean;
  /** Detectar sessão automaticamente */
  detectSessionInUrl?: boolean;
}

/**
 * Resultado da validação de configuração
 */
export interface ValidationResult {
  /** Se a configuração é válida */
  isValid: boolean;
  /** Mensagens de erro (se houver) */
  errors: string[];
  /** Mensagens de aviso (se houver) */
  warnings: string[];
}

/**
 * Resultado do teste de conexão
 */
export interface ConnectionTestResult {
  /** Se a conexão foi bem-sucedida */
  success: boolean;
  /** Mensagem de resultado */
  message: string;
  /** Erro (se houver) */
  error?: string;
  /** Tempo de resposta em ms */
  responseTime?: number;
}

/**
 * Informações sobre a configuração atual
 */
export interface ConfigInfo {
  /** Configuração atual */
  config: SupabaseConfig | null;
  /** Origem da configuração */
  source: ConfigSource;
  /** Se está configurado */
  isConfigured: boolean;
}

/**
 * Tipo para instância do cliente Supabase
 */
export type SupabaseClientInstance = SupabaseClient<any, 'public', any> | null;
