
import { LoyaltyTier, Order, OrderStatus } from '../types/types';
import { extractLocalDate as extractLocalDateFromUtils, getTodayDateString } from '../utils/dateUtils';

// Re-exportar extractLocalDate centralizado
export const extractLocalDate = extractLocalDateFromUtils;

// Helper to check for valid UUID format
export const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Helper to handle Supabase errors gracefully
export const handleSupabaseError = (context: string, error: any) => {
    // Error 42P01: relation (table) does not exist
    if (error?.code === '42P01') {
        console.warn(`[${context}] Tabelas não encontradas no Supabase. A usar dados Mock. Execute o SQL em Configurações.`);
        return true; // Indicates handled as "missing table"
    }
    // Error PGRST205: table not found in schema cache (PostgREST/Supabase specific)
    if (error?.code === 'PGRST205' || (error?.message && error.message.includes('Could not find the table'))) {
        console.warn(`[${context}] Tabela não encontrada no schema cache do Supabase. Execute a migração SQL necessária.`);
        return true; // Indicates handled as "missing table"
    }
    // Error 42703: column does not exist
    if (error?.code === '42703') {
        console.warn(`[${context}] Coluna em falta no banco de dados. Atualize o Schema nas Configurações.`, error.message);
        return true;
    }

    console.error(`[${context}] Erro:`, error.message || error);
    return false;
};

// Helper to calculate tier
export const calculateTier = (totalOrders: number, totalSpent: number): LoyaltyTier => {
    if (totalOrders > 15 || totalSpent > 20000) return LoyaltyTier.GOLD;
    if (totalOrders > 5 || totalSpent > 5000) return LoyaltyTier.SILVER;
    return LoyaltyTier.BRONZE;
};

// Helper to normalize product name for search
export const normalizeProductNameForPrice = (name: string): string => {
    return name.toUpperCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/Á/g, 'A')
        .replace(/É/g, 'E')
        .replace(/Í/g, 'I')
        .replace(/Ó/g, 'O')
        .replace(/Ú/g, 'U')
        .replace(/Ç/g, 'C')
        .replace(/Ã/g, 'A')
        .replace(/Õ/g, 'O');
};

/** Normalize text for accent-insensitive search: trim, lowercase, remove diacritics (NFD). */
export const normalizeForSearch = (str: string): string => {
    if (str == null || typeof str !== 'string') return '';
    return str
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

// ==========================================================
// SISTEMA DE CACHE SIMPLES PARA EVITAR REQUISIÇÕES DUPLICADAS
// ==========================================================
export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    promise?: Promise<T>;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 30000; // 30 segundos

export const getCached = <T>(key: string): T | null => {
    const entry = cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL) {
        cache.delete(key);
        return null;
    }

    return entry.data;
};

export const setCached = <T>(key: string, data: T): void => {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
};

export const getOrSetCache = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
    // Verificar se já existe uma requisição em andamento
    const existing = cache.get(key);
    if (existing?.promise) {
        return existing.promise;
    }

    // Verificar cache
    const cached = getCached<T>(key);
    if (cached !== null) {
        return cached;
    }

    // Criar nova requisição
    const promise = fetcher();
    cache.set(key, {
        data: null as any,
        timestamp: Date.now(),
        promise
    });

    try {
        const data = await promise;
        setCached(key, data);
        // Remover promise do cache após completar
        const entry = cache.get(key);
        if (entry) {
            entry.promise = undefined;
        }
        return data;
    } catch (error) {
        // Em caso de erro, remover do cache
        cache.delete(key);
        throw error;
    }
};

export const clearCache = (key?: string): void => {
    if (key) {
        cache.delete(key);
    } else {
        cache.clear();
    }
};

// Helper to parse monetary value (handles various formats)
export const parseMonetaryValue = (value: string): number => {
    if (!value || value.trim() === '') return 0;

    // Remove currency symbols and extra spaces
    let clean = value.toString()
        .replace(/MT/gi, '')
        .replace(/MZN/gi, '')
        .replace(/\s/g, '')
        .trim();

    // Remove any non-numeric characters except . and ,
    clean = clean.replace(/[^\d.,]/g, '');

    if (!clean) return 0;

    // Handle different decimal separators
    // Priority: Formato português (ponto = milhares, vírgula = decimal)

    // Case 1: Contains both . and , -> Formato português
    if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    }
    // Case 2: Only comma
    else if (clean.includes(',')) {
        const commaIndex = clean.indexOf(',');
        const afterComma = clean.substring(commaIndex + 1);
        if (afterComma.length <= 2 && /^\d+$/.test(afterComma)) {
            clean = clean.replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    }
    // Case 3: Only dots
    else if (clean.includes('.')) {
        const dotMatches = clean.match(/\./g);
        const dotCount = dotMatches ? dotMatches.length : 0;

        if (dotCount > 1) {
            clean = clean.replace(/\./g, '');
        } else {
            const dotIndex = clean.indexOf('.');
            const afterDot = clean.substring(dotIndex + 1);

            if (afterDot.length === 3) {
                clean = clean.replace('.', '');
            }
            else if (afterDot.length <= 2) {
                // Assume decimal
            }
            else {
                clean = clean.replace('.', '');
            }
        }
    }

    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
};

// ------------------------------------------------------------------
// ORDER HELPERS (shared with Orders, Sales, dataService)
// ------------------------------------------------------------------
function migrateOrderStatus(status: string): OrderStatus {
    switch (status) {
        case 'pending':
            return OrderStatus.PENDING;
        case 'confirmed':
        case 'preparing':
        case 'ready':
        case 'delivering':
            return OrderStatus.PROCESSING;
        case 'delivered':
        case 'completed':
            return OrderStatus.DELIVERED;
        case 'cancelled':
            return OrderStatus.CANCELLED;
        case 'paid':
            return OrderStatus.DELIVERED;
        default:
            if (status === OrderStatus.PENDING || status === 'Pendente') return OrderStatus.PENDING;
            if (status === OrderStatus.PROCESSING || status === 'Em Processamento') return OrderStatus.PROCESSING;
            if (status === OrderStatus.DELIVERED || status === 'Entregue' || status === 'Concluído') return OrderStatus.DELIVERED;
            if (status === OrderStatus.CANCELLED || status === 'Cancelado') return OrderStatus.CANCELLED;
            return OrderStatus.PENDING;
    }
}

export const normalizeOrderStatus = (order: Order): OrderStatus => {
    const currentStatus = order.status;
    if (Object.values(OrderStatus).includes(currentStatus as OrderStatus)) {
        return currentStatus as OrderStatus;
    }
    return migrateOrderStatus(currentStatus);
};

export const hasPaymentProof = (order: Order): boolean => {
    const hasImageProof = typeof order.paymentProof === 'string' && order.paymentProof.trim().length > 0;
    const hasTextProof = typeof order.paymentProofText === 'string' && order.paymentProofText.trim().length > 0;
    return hasImageProof || hasTextProof;
};

export const getPaidAmount = (order: Order): number => {
    if (!hasPaymentProof(order)) return 0;

    const total = order.totalAmount || 0;
    if (total <= 0) return 0;

    if (typeof order.amountPaid === 'number') {
        const clamped = !Number.isFinite(order.amountPaid) ? 0 : Math.max(0, order.amountPaid);
        return clamped;
    }

    if (order.paymentStatus === 'paid') return total;

    return total;
};

// Helper to parse product name into base and variant
export const parseProductName = (productName: string): { baseName: string; variant: string | null } => {
    const name = productName.trim();

    // Padrões comuns de variação (peso, tamanho, etc.)
    const variantPatterns = [
        /\s+(\d+[\.,]?\d*\s*(kg|g|ml|l|un|dúzia|duzia))\s*$/i, // Peso/tamanho no final
        /\s+(\d+[\.,]?\d*)\s*(kg|g|ml|l|un)\s*$/i, // Número + unidade
        /\s+(\d+)\s*(un|dúzia|duzia)\s*$/i, // Unidades
    ];

    for (const pattern of variantPatterns) {
        const match = name.match(pattern);
        if (match) {
            const variant = match[0].trim();
            const baseName = name.replace(pattern, '').trim();
            return { baseName, variant };
        }
    }

    // Se não encontrou padrão, verifica se tem palavras comuns de variação
    const words = name.split(/\s+/);
    const lastWord = words[words.length - 1];

    // Se a última palavra parece ser uma variação (contém números)
    if (/\d/.test(lastWord)) {
        const variant = lastWord;
        const baseName = words.slice(0, -1).join(' ').trim();
        if (baseName) {
            return { baseName, variant };
        }
    }

    return { baseName: name, variant: null };
};

export const normalizeBaseName = (name: string): string => {
    return name
        .toLowerCase()
        .normalize('NFD') // Separar acentos
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^a-z0-9\s]/g, '') // Manter apenas letras e números
        .trim()
        .replace(/\s+/g, ' '); // Remover espaços duplicados
};

export const normalizeVariantForMovement = (variant: string | undefined): string | undefined => {
    if (!variant) return undefined;
    // Normalizar: remover espaços extras, converter para formato consistente
    return variant.trim();
};
