/**
 * Tipos de compras e fornecedores
 */

export enum PurchaseRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ORDERED = 'ordered',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variant?: string;
  unit?: string;
  costPrice?: number;
  total?: number;
}

export interface PurchaseRequestItem {
  id: string;
  productId: string;
  productName: string;
  requestedQuantity: number;
  estimatedPrice?: number;
  notes?: string;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName?: string;
  supplierLocationId?: string;
  supplierLocationName?: string;
  items: PurchaseItem[];
  totalAmount: number;
  status?: string;
  orderDate?: string;
  date?: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  notes?: string;
  createdBy?: string;
  locationId?: string;
  invoiceNumber?: string;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  amountPaid?: number;
  paymentDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseRequest {
  id: string;
  requestedBy: string;
  requestedByName?: string;
  items: PurchaseRequestItem[];
  status: PurchaseRequestStatus;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  locationId?: string;
}
