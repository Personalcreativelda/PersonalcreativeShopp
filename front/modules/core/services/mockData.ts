

import { Customer, LoyaltyTier, Order, OrderStatus, Product, ProductType, User, UserRole } from '../../core/types/types';

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Ana Silva',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    avatar: 'https://picsum.photos/seed/admin/100/100',
  },
  {
    id: 'u2',
    name: 'João Operador',
    email: 'staff@example.com',
    role: UserRole.STAFF,
    avatar: 'https://picsum.photos/seed/staff/100/100',
  }
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Mandioca Fresca', price: 60.00, costPrice: 35.00, type: ProductType.FRESH, category: 'Diversos', stock: 50, minStock: 10, unit: 'kg', updatedAt: '2025-11-20' },
  { id: 'p2', name: 'Maracujé¡', price: 300.00, costPrice: 180.00, type: ProductType.FRESH, category: 'Diversos', stock: 20, minStock: 5, unit: 'kg', updatedAt: '2025-11-22' },
  { id: 'p3', name: 'Polpa de Maracujé¡', price: 250.00, costPrice: 150.00, type: ProductType.FROZEN, category: 'Polpas', stock: 100, minStock: 20, unit: 'kg', updatedAt: '2025-11-23' },
  { id: 'p4', name: 'Pato Fumado', price: 1200.00, costPrice: 800.00, type: ProductType.PROCESSED, category: 'Carnes', stock: 3, minStock: 5, unit: 'un', updatedAt: '2025-11-24' },
  { id: 'p5', name: 'Maçanica Seca', price: 150.00, costPrice: 90.00, type: ProductType.FRESH, category: 'Diversos', stock: 30, minStock: 10, unit: 'kg', updatedAt: '2025-11-21' },
  { id: 'p6', name: 'Galinha Cafreal', price: 650.00, costPrice: 450.00, type: ProductType.FROZEN, category: 'Carnes', stock: 45, minStock: 10, unit: 'un', updatedAt: '2025-11-25' },
];

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'Vasta',
    phone: '840105682',
    email: 'vasta@gmail.com',
    address: 'Matola, Rio',
    totalOrders: 18,
    totalSpent: 4500.00,
    tier: LoyaltyTier.GOLD,
    lastOrderDate: '2025-11-20T10:00:00Z'
  },
  {
    id: 'c2',
    name: 'Arsé©nio',
    phone: '845498841',
    address: 'Maputo, Polana',
    totalOrders: 6,
    totalSpent: 1200.00,
    tier: LoyaltyTier.SILVER,
    lastOrderDate: '2025-10-20T14:30:00Z'
  },
  {
    id: 'c3',
    name: 'Khatija',
    phone: '824681320',
    address: 'Zimpeto',
    totalOrders: 2,
    totalSpent: 450.00,
    tier: LoyaltyTier.BRONZE,
    lastOrderDate: '2025-09-15T09:00:00Z'
  }
];

export const MOCK_ORDERS: Order[] = [
  {
    id: 'o1001',
    externalId: '1810',
    customerId: 'c1',
    customerName: 'Vasta',
    customerPhone: '840105682',
    items: [
      { productId: 'p1', productName: 'Mandioca', quantity: 2, priceAtTime: 60.00, unit: 'kg' },
      { productId: 'p2', productName: 'Maracujé¡', quantity: 1, priceAtTime: 300.00, unit: 'kg' }
    ],
    totalAmount: 420.00,
    status: OrderStatus.COMPLETED,
    createdAt: '2025-11-24T10:00:00Z',
    source: 'WhatsApp',
    isDelivery: false
  },
  {
    id: 'o1002',
    customerId: 'c2',
    customerName: 'Arsé©nio',
    customerPhone: '845498841',
    items: [
      { productId: 'p5', productName: 'Maçanica Seca', quantity: 1, priceAtTime: 150.00, unit: 'kg' }
    ],
    totalAmount: 230.00,
    status: OrderStatus.OUT_FOR_DELIVERY,
    createdAt: '2025-11-25T08:30:00Z',
    source: 'Facebook',
    isDelivery: true,
    deliveryLocation: 'Polana Cimento',
    deliveryFee: 80.00
  }
];

