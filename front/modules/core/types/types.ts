// Re-export domain types (definitions in auth, customer, product, order, sale, purchase).
export * from './auth';
export * from './customer';
export * from './product';
export * from './order';
export * from './sale';
export * from './purchase';

// ==========================================
// STOCK & INVENTORY TYPES
// ==========================================

export enum StockTransactionSource {
    PURCHASE = 'purchase',
    SALE = 'sale',
    ADJUSTMENT = 'adjustment',
    TRANSFER = 'transfer',
    RETURN = 'return',
    WASTE = 'waste',
}

/** Tipo de origem do movimento. Inclui 'order' (pedidos) e 'purchase' (compras) para alinhar com a BD e o stockIntegrityService. */
export type StockMovementSourceType = StockTransactionSource | 'order' | 'purchase';

export interface StockMovementSourceReference {
    type: StockMovementSourceType;
    id: string;
}

export interface StockMovement {
    id: string;
    date: string;
    items: StockItem[];
    notes?: string;
    createdAt: string;
    updatedAt?: string;
    source?: StockTransactionSource;
    sourceReference?: StockMovementSourceReference;
    createdBy?: string;
    locationId?: string;
}

export interface StockItem {
    productId: string;
    productName?: string;
    variantId?: string;
    variantName?: string;
    variant?: string; // used in some places instead of variantName
    quantity: number;
    unit?: string;
    unitPrice?: number; // custo unitário do movimento (ex: custo de compra)
    locationId?: string;
    matchedProduct?: any; // used in preview/validation
    needsManualMatch?: boolean;
}

export enum StockAdjustmentReason {
    DAMAGED = 'damaged',          // Produto estragado
    RETURN = 'return',            // Devolucao de cliente
    CORRECTION = 'correction',    // Correcao de contagem
    LOSS = 'loss',                // Perda/Roubo
    PRODUCTION = 'production',    // Producao interna
    EXPIRED = 'expired',          // Produto expirado
    OTHER = 'other'               // Outro motivo
}

export interface StockAdjustment {
    id: string;
    productId: string;
    productName?: string;
    variantId?: string;
    variantName?: string;
    quantity: number;             // positivo = entrada, negativo = saida
    reason: StockAdjustmentReason;
    notes?: string;
    date: string;
    createdBy?: string;
    createdAt: string;
}

/** Linha de ajuste para modo lote no modal (um produto/variante + quantidade). */
export interface AdjustmentLine {
    productId: string;
    productName?: string;
    variantId?: string;
    variantName?: string;
    quantity: number;
    unit?: string;
}

export enum StockAuditStatus {
    DRAFT = 'draft',
    COMPLETED = 'completed',
    APPLIED = 'applied'
}

export enum StockAuditScope {
    ALL = 'all',
    SELECTED = 'selected',
    CATEGORY = 'category'
}

export interface StockAudit {
    id: string;
    auditDate: string;
    description?: string;
    status: StockAuditStatus;
    scope: StockAuditScope;
    scopeFilter?: any;
    createdBy?: string;
    createdAt: string;
    completedAt?: string;
    appliedAt?: string;
    audit_items?: StockAuditItem[];
}

export interface StockAuditItem {
    id: string;
    auditId: string;
    productId: string;
    productName?: string;
    variantId?: string;
    variantName?: string;
    systemQuantity: number;
    countedQuantity?: number;
    discrepancy?: number;
    unit?: string;
    costPrice?: number;
    notes?: string;
    adjustmentReason?: StockAdjustmentReason;
    adjustmentNotes?: string;
    approved?: boolean;
    adjustmentId?: string;
    categoryName?: string;
    createdAt: string;
    updatedAt: string;
}



// ==========================================
// CUSTOMER ACTIONS & FEEDBACK
// ==========================================

export enum ActionType {
    PHONE_CALL = 'Chamada Telefónica',
    EMAIL = 'Email',
    MESSAGE = 'Mensagem',
    VISIT = 'Visita',
    FOLLOW_UP = 'Follow-up',
    OTHER = 'Outro',
}

export enum ActionStatus {
    PENDING = 'Pendente',
    COMPLETED = 'Concluída',
    CANCELLED = 'Cancelada',
}

export interface CustomerAction {
    id: string;
    customerId: string;
    userId: string;
    type: ActionType;
    actionType: ActionType;
    status: ActionStatus;
    scheduledDate?: string;
    completedDate?: string;
    notes?: string;
    priority?: 'low' | 'medium' | 'high';
    pointsEarned?: number;
    createdAt: string;
}

export interface CustomerFeedback {
    id: string;
    customerId: string;
    orderId?: string;
    rating: number;
    comment?: string;
    createdAt: string;
}

export interface CustomerInsight {
    id: string;
    customerId: string;
    customerName: string;
    tier: LoyaltyTier | string;
    riskLevel: 'high' | 'medium' | 'low';
    daysSinceLastOrder: number;
    totalSpent: number;
    totalOrders: number;
    lastOrderDate?: string;
    suggestedAction?: string;
    insightType: string;
    value: number;
    valueText?: string;
    period?: string;
    metadata?: any;
    calculatedAt: string;
}

export interface WeeklyGoal {
    id: string;
    userId: string;
    targetAmount: number;
    currentAmount: number;
    weekStart: string;
    weekEnd: string;
    status: 'active' | 'completed' | 'failed';
}

// ==========================================
// DELIVERY TYPES
// ==========================================

export interface DeliveryZone {
    id: string;
    name: string;
    price: number;
    locationId?: string;
}

// ==========================================
// ACTIVITY & TRACKING TYPES
// ==========================================

export enum ActivityCategory {
    ORDER = 'order',
    PRODUCT = 'product',
    CUSTOMER = 'customer',
    USER = 'user',
    SYSTEM = 'system',
}

export interface Activity {
    id: string;
    userId: string;
    userName?: string;
    category: ActivityCategory;
    action: string;
    description: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}

// ==========================================
// SHOP RECEIPT (receção de mercadoria na loja)
// ==========================================

export type ShopReceiptSource = 'FORNECEDOR' | 'FABRICA' | 'OUTRO';

export interface ShopReceiptItem {
    id?: string;
    productId?: string;
    productName: string;
    variantId?: string;
    variantName?: string;
    quantity: number;
    unit: string;
    costPrice?: number;
    sellingPrice?: number;
    source?: ShopReceiptSource | string;
    factoryOutputId?: string;
    notes?: string;
}

export interface ShopReceipt {
    id: string;
    source: ShopReceiptSource;
    supplierId?: string;
    supplierName?: string;
    factoryOutputId?: string;
    items: ShopReceiptItem[];
    receivedAt?: string;
    date: string;
    reference?: string;
    receivedBy: string;
    invoiceNumber?: string;
    totalItems?: number;
    totalCost?: number;
    totalValue?: number;
    notes?: string;
    status: 'pending' | 'completed' | 'cancelled';
    locationId?: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
}

// ==========================================
// MEDIA TYPES
// ==========================================

export enum MediaType {
    IMAGE = 'image',
    VIDEO = 'video',
    DOCUMENT = 'document',
    OTHER = 'other',
}

export enum MediaCategory {
    PRODUCTS = 'products',
    AVATARS = 'avatars',
    PAYMENT_PROOFS = 'payment-proofs',
    SYSTEM = 'system',
    DOCUMENTS = 'documents',
    MEDIA_LIBRARY = 'media-library',
    OTHER = 'other',
}

export interface MediaFile {
    id: string;
    name: string;
    url: string;
    path: string;
    type: MediaType | string;
    category: MediaCategory | string;
    size: number;
    mimeType?: string;
    uploadedBy?: string;
    uploadedAt: string;
    createdAt?: string;
    updatedAt?: string;
}

// ==========================================
// TEMPLATE TYPES
// ==========================================

export interface VariantTemplate {
    id: string;
    name: string;
    variants: Array<{
        name: string;
        unit: string;
        priceMultiplier?: number;
    }>;
}

// ==========================================
// CUSTOMER ACTION TYPES (Extended)
// ==========================================

export enum CustomerActionType {
    COMPLETAR_PERFIL = 'completar_perfil',
    PARTILHAR_PRODUTO = 'partilhar_produto',
    AVALIAR_PRODUTO = 'avaliar_produto',
    CRIAR_REVIEW = 'criar_review',
    PRIMEIRA_COMPRA = 'primeira_compra',
    COMPRA_RECORRENTE = 'compra_recorrente',
}

export enum InsightType {
    SPENDING_TREND = 'spending_trend',
    PURCHASE_FREQUENCY = 'purchase_frequency',
    FAVORITE_PRODUCTS = 'favorite_products',
    CHURN_RISK = 'churn_risk',
}

export enum AchievementType {
    FIRST_PURCHASE = 'first_purchase',
    LOYAL_CUSTOMER = 'loyal_customer',
    BIG_SPENDER = 'big_spender',
    FREQUENT_BUYER = 'frequent_buyer',
}

export interface SocialShare {
    id: string;
    customerId: string;
    productId: string;
    platform: 'whatsapp' | 'facebook' | 'instagram' | 'twitter' | 'other';
    shareUrl?: string;
    pointsEarned: number;
    createdAt: string;
}

export interface ProductReview {
    id: string;
    customerId: string;
    productId: string;
    rating: number;
    reviewText?: string;
    helpfulCount?: number;
    verifiedPurchase?: boolean;
    status?: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    updatedAt?: string;
    productName?: string;
}

export interface CustomerGoal {
    id: string;
    customerId: string;
    goalType: string;
    title: string;
    description?: string;
    targetValue: number;
    currentValue: number;
    deadline?: string;
    status: 'active' | 'completed' | 'failed';
    rewardPoints?: number;
    completedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface CustomerAchievement {
    id: string;
    customerId: string;
    achievementType: AchievementType | string;
    unlockedAt: string;
    metadata?: any;
}

// ==========================================
// AFFILIATE PROGRAM TYPES
// ==========================================

export interface AffiliateProgram {
    id: string;
    customerId: string;
    affiliateCode: string;
    affiliateLink: string;
    commissionRateLevel1: number;
    commissionRateLevel2?: number;
    commissionRateRecurring?: number;
    totalEarnings: number;
    totalReferrals: number;
    totalClicks: number;
    totalConversions: number;
    conversionRate?: number;
    status: 'active' | 'inactive' | 'suspended';
    tier?: string;
    paymentMethod?: string;
    paymentThreshold?: number;
    bankAccount?: string;
    mobileMoney?: string;
    notes?: string;
    createdAt: string;
    updatedAt?: string;
    customerName?: string;
}

export interface AffiliateReferral {
    id: string;
    affiliateId: string;
    referredCustomerId: string;
    referralCode: string;
    referralType: 'direct' | 'indirect';
    referralLevel: number;
    clickTimestamp?: string;
    conversionDate?: string;
    firstOrderId?: string;
    commissionAmount: number;
    totalCommissionEarned: number;
    status: 'pending' | 'active' | 'inactive';
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
    createdAt: string;
    updatedAt?: string;
    referredCustomerName?: string;
    affiliateCode?: string;
}

export interface AffiliateMaterial {
    id: string;
    title: string;
    description?: string;
    type: 'banner' | 'image' | 'video' | 'text' | 'link';
    fileUrl?: string;
    thumbnailUrl?: string;
    category?: string;
    platform?: string;
    isActive: boolean;
    downloadCount?: number;
    createdAt: string;
    updatedAt?: string;
}

export interface AffiliatePayment {
    id: string;
    affiliateId: string;
    referralId?: string;
    orderId?: string;
    commissionAmount: number;
    paymentAmount: number;
    paymentStatus: 'pending' | 'processing' | 'paid' | 'failed';
    paymentMethod?: string;
    paymentDate?: string;
    paymentReference?: string;
    notes?: string;
    createdAt: string;
    updatedAt?: string;
    affiliateCode?: string;
}

// ==========================================
// REPORT TYPES (Vendas, Stock, Clientes, Pedidos)
// ==========================================

export enum ReportCategory {
    SALES = 'sales',
    STOCK = 'stock',
    CUSTOMERS = 'customers',
    ORDERS = 'orders',
}

export type ReportType =
    | 'sales_summary' | 'sales_by_product' | 'sales_by_period' | 'top_products'
    | 'stock_summary' | 'stock_movements' | 'low_stock' | 'stock_valuation'
    | 'customers_summary' | 'loyalty_report' | 'top_customers'
    | 'orders_summary' | 'orders_by_status' | 'orders_by_period' | 'pending_orders';

export interface SalesReport {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    salesByProduct: Array<{ productName: string; quantity: number; totalValue: number }>;
    salesByPeriod: Array<{ period: string; value: number }>;
    topProducts: Array<{ productName: string; quantity: number; totalValue: number; percentage: number }>;
}

export interface StockReport {
    totalProducts: number;
    totalValue: number;
    lowStockItems: Array<{ productName: string; currentStock: number; minStock: number; unit?: string }>;
    movements: Array<{ date: string; type: 'entry' | 'exit'; productName?: string; quantity: number }>;
    valuation: { totalCost: number; totalValue: number; profitMargin: number };
}

export interface CustomersReport {
    totalCustomers: number;
    newCustomers: number;
    activeCustomers: number;
    customersByTier: Array<{ tier: string; count: number; totalSpent: number }>;
    topCustomers: Array<{ customerName: string; totalOrders: number; totalSpent: number; lastOrderDate?: string }>;
    loyaltyStats: { totalPoints: number; pointsRedeemed: number; activeMembers: number };
}

export interface OrdersReport {
    totalOrders: number;
    ordersByStatus: Array<{ status: string; count: number; totalValue: number }>;
    ordersByPeriod: Array<{ period: string; count: number; totalValue: number }>;
    pendingOrders: Array<{ orderId: string; customerName: string; totalAmount: number; createdAt: string; daysPending: number }>;
    averageProcessingTime: number;
}

// ==========================================
// TOAST & UI TYPES
// ==========================================

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
}
// ==========================================
// SERIES & CHAPTER TYPES
// ==========================================

export enum SeriesCategory {
    AVENTURA = 'Aventura',
    DRAMA = 'Drama',
    COMEDIA = 'Comé©dia',
    FANTASIA = 'Fantasia',
    ACAO = 'Açéo',
    ROMANCE = 'Romance',
    TERROR = 'Terror',
    FICCAO = 'Ficçéo',
    OUTRO = 'Outro',
}

export interface Series {
    id: string;
    title: string;
    description: string;
    coverImage?: string;
    category: SeriesCategory | string;
    status: 'ongoing' | 'completed' | 'hiatus';
    releaseDate: string;
    createdAt: string;
    updatedAt?: string;
    slug: string;
}

export interface Chapter {
    id: string;
    seriesId: string;
    title: string;
    content: string; // Text content or link/video
    coverImage?: string;
    chapterNumber: number;
    releaseDate: string;
    createdAt: string;
    updatedAt?: string;
    slug: string;
}

export interface ChapterProgress {
    id: string;
    userId: string;
    chapterId: string;
    seriesId: string;
    progressPercentage: number;
    lastPosition: number;
    completed: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface ChapterComment {
    id: string;
    chapterId: string;
    userId: string;
    content: string;
    parentId?: string;
    createdAt: string;
    updatedAt?: string;
    user?: {
        id: string;
        email?: string;
        name?: string;
        avatar?: string;
    };
    replies?: ChapterComment[];
}

