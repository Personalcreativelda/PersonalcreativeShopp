/**
 * Tipos de clientes e fidelização
 */

export enum LoyaltyTier {
  BRONZE = 'Bronze',
  SILVER = 'Prata',
  GOLD = 'Ouro',
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  tier: LoyaltyTier;
  totalSpent: number;
  totalOrders: number;
  loyaltyPoints?: number;
  lastOrderDate?: string;
  createdAt?: string;
}
