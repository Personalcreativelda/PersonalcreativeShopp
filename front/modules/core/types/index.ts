/**
 * Barrel: re-exporta todos os tipos do core.
 * Permite importar de '@/modules/core/types' ou './types'.
 * Os domínios auth, customer, product, order, sale, purchase estão em ficheiros separados;
 * types.ts contém o resto e re-exporta estes para compatibilidade.
 */

export * from './auth';
export * from './customer';
export * from './product';
export * from './order';
export * from './sale';
export * from './purchase';
// types.ts contém stock, location, delivery, financial, activity, media, series, etc.
export * from './types';
