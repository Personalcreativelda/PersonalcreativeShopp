import { Product } from '../types/product';

export interface EffectivePrice {
  price: number;
  isPromo: boolean;
  originalPrice?: number;
  /** Quantos dias faltam para expirar (null = sem data fim definida) */
  daysLeft: number | null;
}

/**
 * Devolve o preço efectivo de um produto com base na promoção e datas de validade.
 * Usado no POS, loja e recibos para garantir consistência.
 */
export function getEffectivePrice(product: Pick<Product, 'price' | 'promotionalPrice' | 'promotionalPriceStart' | 'promotionalPriceEnd'>): EffectivePrice {
  const { price, promotionalPrice, promotionalPriceStart, promotionalPriceEnd } = product;

  if (!promotionalPrice || promotionalPrice <= 0 || promotionalPrice >= price) {
    return { price, isPromo: false, daysLeft: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Verificar data de início
  if (promotionalPriceStart) {
    const start = new Date(promotionalPriceStart);
    start.setHours(0, 0, 0, 0);
    if (today < start) {
      return { price, isPromo: false, daysLeft: null };
    }
  }

  // Verificar data de fim
  if (promotionalPriceEnd) {
    const end = new Date(promotionalPriceEnd);
    end.setHours(23, 59, 59, 999);
    if (today > end) {
      // Promoção expirada — devolve preço normal
      return { price, isPromo: false, daysLeft: 0 };
    }
    const msLeft = end.getTime() - today.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    return { price: promotionalPrice, isPromo: true, originalPrice: price, daysLeft };
  }

  // Sem data de fim: promoção sempre activa
  return { price: promotionalPrice, isPromo: true, originalPrice: price, daysLeft: null };
}
