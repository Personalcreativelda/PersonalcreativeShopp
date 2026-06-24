/**
 * Tipos de pedidos
 */

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  priceAtTime?: number;
  unit?: string;
}

/** Status pode vir da BD em inglês (OrderStatus) ou em português (ex.: 'Entregue'). */
export type OrderStatusValue = OrderStatus | 'Entregue' | string;

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatusValue;
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  amountPaid?: number;
  paymentProof?: string;
  paymentProofText?: string;
  paymentMethod?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  isDelivery?: boolean;
  deliveryLocation?: string;
  deliveryZoneId?: string;
  deliveryZoneName?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryAddressFormatted?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string;
  locationId?: string;
  createdBy?: string;
  createdByName?: string;
  orderNumber?: string;
  trackingCode?: string;
  externalId?: string;
  source?: string;
  couponCode?: string;
  discountAmount?: number;
  estimatedDeliveryDate?: string | null;
  disputeDeadline?: string | null;
}
