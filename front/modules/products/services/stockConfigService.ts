/**
 * Servico de configuracao de stock (metodo de valorizacao, etc.)
 */
import { supabase, isSupabaseConfigured } from '../../core/services/supabaseClient';
import { handleSupabaseError } from '../../core/services/serviceUtils';

export type ValuationMethod = 'fifo' | 'lifo' | 'average' | 'standard_cost';

const VALID_METHODS: ValuationMethod[] = ['fifo', 'lifo', 'average', 'standard_cost'];
const VALUATION_METHOD_STORAGE_KEY = 'stock_valuation_method';

const isValidMethod = (value: unknown): value is ValuationMethod =>
  typeof value === 'string' && VALID_METHODS.includes(value as ValuationMethod);

const getCachedMethod = (): ValuationMethod | null => {
  if (typeof window === 'undefined') return null;
  const cached = localStorage.getItem(VALUATION_METHOD_STORAGE_KEY);
  return isValidMethod(cached) ? cached : null;
};

const setCachedMethod = (method: ValuationMethod): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VALUATION_METHOD_STORAGE_KEY, method);
};

const isTransientNetworkError = (error: unknown): boolean => {
  const message = String((error as { message?: unknown })?.message ?? '').toLowerCase();
  return (
    message.includes('networkerror') ||
    message.includes('failed to fetch') ||
    message.includes('cors') ||
    message.includes('502')
  );
};

export const stockConfigService = {
  async getValuationMethod(): Promise<ValuationMethod> {
    const cachedMethod = getCachedMethod();
    const fallback = cachedMethod ?? 'fifo';
    if (!isSupabaseConfigured() || !supabase) return fallback;
    try {
      const { data, error } = await supabase
        .from('stock_settings')
        .select('value')
        .eq('key', 'valuation_method')
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') return fallback; // tabela nao existe
        if (isTransientNetworkError(error)) return fallback;
        handleSupabaseError('getValuationMethod', error);
        return fallback;
      }

      const val = (data?.value ?? fallback) as string;
      const resolved = isValidMethod(val) ? val : fallback;
      setCachedMethod(resolved);
      return resolved;
    } catch (error) {
      if (isTransientNetworkError(error)) return fallback;
      return fallback;
    }
  },

  async setValuationMethod(method: ValuationMethod): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Base de dados nao configurada' };
    }
    if (!VALID_METHODS.includes(method)) {
      return { success: false, error: `Metodo invalido: ${method}` };
    }
    try {
      const { error } = await supabase
        .from('stock_settings')
        .upsert({ key: 'valuation_method', value: method, updated_at: new Date().toISOString() }, {
          onConflict: 'key',
        });

      if (error) {
        if (error.code === '42P01') {
          return { success: false, error: 'Tabela stock_settings nao existe. Execute a migracao sql/stock_config_valuation.sql' };
        }
        if (isTransientNetworkError(error)) {
          setCachedMethod(method);
          return { success: true };
        }
        handleSupabaseError('setValuationMethod', error);
        return { success: false, error: error.message };
      }

      setCachedMethod(method);
      return { success: true };
    } catch (e: any) {
      if (isTransientNetworkError(e)) {
        setCachedMethod(method);
        return { success: true };
      }
      return { success: false, error: e?.message || 'Erro ao guardar metodo de valorizacao' };
    }
  },
};
