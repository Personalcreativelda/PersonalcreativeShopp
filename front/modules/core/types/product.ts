/**
 * Tipos de produtos
 */

export enum ProductType {
  FRESH = 'fresh',
  FROZEN = 'frozen',
  PROCESSED = 'processed',
}

export enum ProductCategory {
  CARNE = 'Carne',
  POLPA = 'Polpa',
  VERDURA = 'Verdura',
  OVOS = 'Ovos',
  OLEO = 'Óleo',
  GERAL = 'Geral',
}

export enum ProductUnit {
  KG = 'kg',
  G = 'g',
  L = 'l',
  ML = 'ml',
  UN = 'un',
  DZ = 'duzia',
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  isDefault: boolean;
  displayOrder?: number | null;
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  costPrice?: number;
  type: ProductType | string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  image?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  updatedAt?: string;
  totalSold?: number;
  showInShop?: boolean;
  variants?: ProductVariant[];
  hasVariants?: boolean;
  description?: string;
  descriptionLong?: string;
  benefits?: string;
  howToUse?: string;
  ingredients?: string;
  promotionalPrice?: number | null;
  promotionalPriceStart?: string | null;
  promotionalPriceEnd?: string | null;
  createdAt?: string;
  barcode?: string | null;
  vatRegime?: 'standard' | 'exempt';
  landingPageEnabled?: boolean;
  landingPageData?: {
    heroTitle?: string;
    heroSubtitle?: string;
    benefitsTitle?: string;
    benefits?: Array<{
      title: string;
      description: string;
      icon?: string;
    }>;
    ingredientsTitle?: string;
    ingredients?: Array<{
      name: string;
      description?: string;
      image?: string;
    }>;
    videoUrl?: string;
    videoTitle?: string;
    howToConsume?: string;
    testimonialsTitle?: string;
    testimonials?: Array<{
      author: string;
      text: string;
      rating: number;
      avatar?: string;
    }>;
    certifications?: Array<{
      name: string;
      icon?: string;
    }>;
    primaryColor?: string;
    secondaryColor?: string;
  };
}
