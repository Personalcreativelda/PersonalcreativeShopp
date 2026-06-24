/**
 * supabaseClient.ts — STUB (Supabase removido)
 * 
 * Este ficheiro existe apenas para compatibilidade de imports que ainda
 * referenciam este módulo. NÃO usa Supabase. Toda a lógica foi migrada
 * para apiClient.ts + backend REST (porta 3060).
 */

export const supabase = null as any;

export const isSupabaseConfigured = (): boolean => false;

export const getSupabaseStatus = () => ({
  isConfigured: false,
  hasValidUrl: false,
  hasValidKey: false,
  isConnected: false,
  message: 'Supabase removido — a usar PostgreSQL directo via backend REST'
});

export const clearSupabaseAuthStorage = () => {};
export const getSupabaseConfig = () => null;
export const getSupabaseClient = () => null;
export const getAdminClient = () => null;

// Compatibilidade: alguns módulos importam AuthUser do supabaseClient
export type { };
