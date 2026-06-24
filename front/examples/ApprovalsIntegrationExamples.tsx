/**
 * Exemplos de Integração do Sistema de Aprovações
 * 
 * Este arquivo demonstra como integrar o sistema de aprovações
 * em diferentes componentes e ações críticas.
 */

import React, { useState } from 'react';
import { useAuth } from '../modules/auth/hooks/useAuth';
import { usePermissions } from '../modules/core/hooks/usePermissions';
import { useApprovals } from '../modules/core/hooks/useApprovals';
import { RequestApprovalModal } from '../modules/core/components/modals/RequestApprovalModal';
import { ProtectedAction } from '../modules/core/components/ProtectedAction';
import { Trash2, Edit, DollarSign } from 'lucide-react';

// ============================================
// Exemplo 1: Deletar Produto com Aprovação
// ============================================
export const ProductDeleteWithApproval: React.FC<{ product: any }> = ({ product }) => {
    const { user } = useAuth();
    const { hasPermission } = usePermissions(user);
    const { requestApproval } = useApprovals(user);
    const [showApprovalModal, setShowApprovalModal] = useState(false);

    const handleDelete = async () => {
        // Se tem permissão direta, deletar imediatamente
        if (hasPermission('products.delete')) {
            if (confirm('Tem certeza que deseja apagar este produto?')) {
                await deleteProduct(product.id);
                alert('Produto apagado com sucesso');
            }
        } else {
            // Caso contrário, solicitar aprovação
            setShowApprovalModal(true);
        }
    };

    const deleteProduct = async (productId: string) => {
        // Lógica real de delete
        console.log('Deleting product:', productId);
    };

    return (
        <>
            <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-2 text-red-600 border border-red-600 rounded-md hover:bg-red-50"
            >
                <Trash2 className="w-4 h-4" />
                Apagar Produto
            </button>

            <RequestApprovalModal
                isOpen={showApprovalModal}
                onClose={() => setShowApprovalModal(false)}
                actionType="delete_product"
                entityType="product"
                entityId={product.id}
                entityData={{
                    name: product.name,
                    code: product.code,
                    price: product.price,
                }}
                onSubmit={async (reason) => {
                    await requestApproval({
                        actionType: 'delete_product',
                        entityType: 'product',
                        entityId: product.id,
                        entityData: product,
                        reason,
                        approvalLevel: 2, // Requer GERENTE ou superior
                    });
                    alert('Solicitação de aprovação enviada com sucesso');
                }}
            />
        </>
    );
};

// ============================================
// Exemplo 2: Ajuste de Stock com Aprovação
// ============================================
export const StockAdjustmentWithApproval: React.FC<{ productId: string }> = ({ productId }) => {
    const { user } = useAuth();
    const { hasPermission } = usePermissions(user);
    const { requestApproval } = useApprovals(user);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [adjustment, setAdjustment] = useState({ quantity: 0, reason: '' });

    const handleAdjust = async () => {
        const adjustmentValue = Math.abs(adjustment.quantity);

        // Se ajuste é pequeno (< 10 unidades) e tem permissão, executar diretamente
        if (adjustmentValue < 10 && hasPermission('stock.adjust')) {
            await adjustStock(productId, adjustment.quantity, adjustment.reason);
            alert('Stock ajustado com sucesso');
        } else {
            // Ajustes grandes ou sem permissão requerem aprovação
            setShowApprovalModal(true);
        }
    };

    const adjustStock = async (productId: string, quantity: number, reason: string) => {
        console.log('Adjusting stock:', { productId, quantity, reason });
    };

    return (
        <>
            <div className="space-y-3">
                <input
                    type="number"
                    value={adjustment.quantity}
                    onChange={(e) => setAdjustment({ ...adjustment, quantity: parseInt(e.target.value) })}
                    placeholder="Quantidade"
                    className="w-full px-3 py-2 border rounded-md"
                />
                <button
                    onClick={handleAdjust}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Ajustar Stock
                </button>
            </div>

            <RequestApprovalModal
                isOpen={showApprovalModal}
                onClose={() => setShowApprovalModal(false)}
                actionType="adjust_stock"
                entityType="stock_adjustment"
                entityId={productId}
                entityData={{
                    productId,
                    quantity: adjustment.quantity,
                    currentStock: 100, // Exemplo
                }}
                onSubmit={async (reason) => {
                    await requestApproval({
                        actionType: 'adjust_stock',
                        entityType: 'stock_adjustment',
                        entityId: productId,
                        entityData: { ...adjustment, productId },
                        reason,
                        approvalLevel: 3, // Requer SUPERVISOR ou superior
                    });
                    alert('Solicitação de ajuste enviada para aprovação');
                }}
            />
        </>
    );
};

// ============================================
// Exemplo 3: Desconto Elevado com Aprovação
// ============================================
export const HighDiscountWithApproval: React.FC<{ sale: any }> = ({ sale }) => {
    const { user } = useAuth();
    const { hasPermission } = usePermissions(user);
    const { requestApproval } = useApprovals(user);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [discount, setDiscount] = useState(0);

    const handleApplyDiscount = async () => {
        const discountPercentage = (discount / sale.total) * 100;

        // Descontos até 20% podem ser aplicados com permissão básica
        if (discountPercentage <= 20 && hasPermission('sales.discount')) {
            await applyDiscount(sale.id, discount);
            alert('Desconto aplicado com sucesso');
        }
        // Descontos > 20% requerem aprovação ou permissão especial
        else if (discountPercentage > 20 && hasPermission('sales.discount.high')) {
            await applyDiscount(sale.id, discount);
            alert('Desconto elevado aplicado');
        } else {
            setShowApprovalModal(true);
        }
    };

    const applyDiscount = async (saleId: string, amount: number) => {
        console.log('Applying discount:', { saleId, amount });
    };

    return (
        <>
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium mb-1">Desconto (R$)</label>
                    <input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border rounded-md"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        {((discount / sale.total) * 100).toFixed(1)}% do total
                    </p>
                </div>
                <button
                    onClick={handleApplyDiscount}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                    <DollarSign className="w-4 h-4" />
                    Aplicar Desconto
                </button>
            </div>

            <RequestApprovalModal
                isOpen={showApprovalModal}
                onClose={() => setShowApprovalModal(false)}
                actionType="high_discount"
                entityType="sale"
                entityId={sale.id}
                entityData={{
                    saleId: sale.id,
                    total: sale.total,
                    discount,
                    percentage: ((discount / sale.total) * 100).toFixed(1),
                }}
                onSubmit={async (reason) => {
                    await requestApproval({
                        actionType: 'high_discount',
                        entityType: 'sale',
                        entityId: sale.id,
                        entityData: { sale, discount },
                        reason,
                        approvalLevel: 2, // Requer GERENTE ou superior
                    });
                    alert('Solicitação de desconto enviada para aprovação');
                }}
            />
        </>
    );
};

// ============================================
// Exemplo 4: Integração com ProtectedAction
// ============================================
export const ProductActionsWithApproval: React.FC<{ product: any }> = ({ product }) => {
    const { user } = useAuth();
    const { hasPermission } = usePermissions(user);
    const { requestApproval } = useApprovals(user);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    return (
        <div className="flex gap-2">
            {/* Editar - Sempre visível se tiver permissão */}
            <ProtectedAction permission="products.edit">
                <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md">
                    <Edit className="w-4 h-4" />
                    Editar
                </button>
            </ProtectedAction>

            {/* Apagar - Visível sempre, mas pode requerer aprovação */}
            <button
                onClick={() => {
                    if (hasPermission('products.delete')) {
                        // Delete direto
                        if (confirm('Apagar produto?')) {
                            console.log('Deleting...');
                        }
                    } else {
                        // Solicitar aprovação
                        setShowDeleteModal(true);
                    }
                }}
                className="flex items-center gap-2 px-3 py-2 text-red-600 border border-red-600 rounded-md"
            >
                <Trash2 className="w-4 h-4" />
                Apagar
            </button>

            <RequestApprovalModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                actionType="delete_product"
                entityType="product"
                entityId={product.id}
                entityData={product}
                onSubmit={async (reason) => {
                    await requestApproval({
                        actionType: 'delete_product',
                        entityType: 'product',
                        entityId: product.id,
                        entityData: product,
                        reason,
                    });
                    setShowDeleteModal(false);
                    alert('Solicitação enviada');
                }}
            />
        </div>
    );
};

// ============================================
// Exemplo 5: Notificação de Aprovações Pendentes
// ============================================
export const ApprovalNotificationBadge: React.FC = () => {
    const { user } = useAuth();
    const { approvableRequests } = useApprovals(user);

    if (approvableRequests.length === 0) {
        return null;
    }

    return (
        <div className="relative">
            <button className="p-2 rounded-full hover:bg-gray-100">
                <span className="sr-only">Aprovações pendentes</span>
                🔔
            </button>
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                {approvableRequests.length}
            </span>
        </div>
    );
};
