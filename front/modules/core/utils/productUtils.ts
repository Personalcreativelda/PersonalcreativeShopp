import { Product, ProductVariant } from '../types/types';

/**
 * Obtém a imagem da variação com fallback para a imagem do produto
 * @param variant Variação do produto (opcional)
 * @param product Produto principal
 * @param defaultImage URL da imagem padrão (opcional)
 * @returns URL da imagem a ser exibida
 */
export const getVariantImage = (
  variant: ProductVariant | undefined,
  product: Product,
  defaultImage?: string
): string => {
  // Prioridade: variant.image > product.image > defaultImage
  if (variant?.image) {
    return variant.image;
  }
  if (product.image) {
    return product.image;
  }
  return defaultImage || 'https://via.placeholder.com/300x300?text=Sem+Imagem';
};
