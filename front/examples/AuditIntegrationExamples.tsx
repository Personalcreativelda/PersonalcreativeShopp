/**
 * Exemplos de Integração do Sistema de Auditoria
 * 
 * Este arquivo demonstra como integrar o sistema de auditoria
 * em diferentes operações CRUD.
 */

import { auditService } from '../modules/core/services/auditService';
import { supabase } from '../modules/core/services/supabaseClient';

// ============================================
// Exemplo 1: Criar Produto com Auditoria
// ============================================
export const createProductWithAudit = async (productData: any, user: any) => {
    try {
        // Criar produto
        const { data: product, error } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

        if (error) throw error;

        // Registrar auditoria
        await auditService.logCreate({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            entityType: 'product',
            entityId: product.id,
            entityName: product.name,
            newData: product,
        });

        return { success: true, product };
    } catch (error: any) {
        console.error('Erro ao criar produto:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// Exemplo 2: Atualizar Produto com Auditoria
// ============================================
export const updateProductWithAudit = async (
    productId: string,
    updates: any,
    user: any
) => {
    try {
        // Buscar produto atual (antes da atualização)
        const { data: oldProduct } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        // Atualizar produto
        const { data: updatedProduct, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', productId)
            .select()
            .single();

        if (error) throw error;

        // Registrar auditoria
        await auditService.logUpdate({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            entityType: 'product',
            entityId: productId,
            entityName: updatedProduct.name,
            oldData: oldProduct,
            newData: updatedProduct,
        });

        return { success: true, product: updatedProduct };
    } catch (error: any) {
        console.error('Erro ao atualizar produto:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// Exemplo 3: Deletar Produto com Auditoria
// ============================================
export const deleteProductWithAudit = async (productId: string, user: any) => {
    try {
        // Buscar produto antes de deletar (para snapshot)
        const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        // Deletar produto
        const { error } = await supabase.from('products').delete().eq('id', productId);

        if (error) throw error;

        // Registrar auditoria
        await auditService.logDelete({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            entityType: 'product',
            entityId: productId,
            entityName: product?.name || 'Produto Desconhecido',
            oldData: product,
        });

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao deletar produto:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// Exemplo 4: Ajuste de Stock com Auditoria
// ============================================
export const adjustStockWithAudit = async (
    productId: string,
    adjustment: number,
    reason: string,
    user: any
) => {
    try {
        // Buscar stock atual
        const { data: product } = await supabase
            .from('products')
            .select('stock, name')
            .eq('id', productId)
            .single();

        const oldStock = product?.stock || 0;
        const newStock = oldStock + adjustment;

        // Atualizar stock
        const { error } = await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);

        if (error) throw error;

        // Registrar auditoria
        await auditService.logAction({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action: 'stock_adjusted',
            entityType: 'product',
            entityId: productId,
            entityName: product?.name,
            oldData: { stock: oldStock },
            newData: { stock: newStock, adjustment, reason },
        });

        return { success: true, newStock };
    } catch (error: any) {
        console.error('Erro ao ajustar stock:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// Exemplo 5: Login com Auditoria
// ============================================
export const loginWithAudit = async (user: any) => {
    try {
        await auditService.logLogin({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
        });

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao registrar login:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// Exemplo 6: Logout com Auditoria
// ============================================
export const logoutWithAudit = async (user: any) => {
    try {
        await auditService.logLogout({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
        });

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao registrar logout:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// Exemplo 7: Atribuir Role com Auditoria
// ============================================
export const assignRoleWithAudit = async (
    userId: string,
    roleId: string,
    roleName: string,
    assignedBy: any
) => {
    try {
        // Atribuir role
        const { error } = await supabase.from('user_roles').insert({
            user_id: userId,
            role_id: roleId,
            assigned_by: assignedBy.id,
        });

        if (error) throw error;

        // Registrar auditoria
        await auditService.logAction({
            userId: assignedBy.id,
            userName: assignedBy.name,
            userEmail: assignedBy.email,
            action: 'role_assigned',
            entityType: 'user',
            entityId: userId,
            newData: { roleId, roleName },
        });

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao atribuir role:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// Exemplo 8: Hook Personalizado com Auditoria
// ============================================
import { useState } from 'react';
import { useAuth } from '../modules/auth/hooks/useAuth';

export const useProductWithAudit = () => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const createProduct = async (productData: any) => {
        if (!user) return { success: false, error: 'Não autenticado' };

        setIsLoading(true);
        const result = await createProductWithAudit(productData, user);
        setIsLoading(false);
        return result;
    };

    const updateProduct = async (productId: string, updates: any) => {
        if (!user) return { success: false, error: 'Não autenticado' };

        setIsLoading(true);
        const result = await updateProductWithAudit(productId, updates, user);
        setIsLoading(false);
        return result;
    };

    const deleteProduct = async (productId: string) => {
        if (!user) return { success: false, error: 'Não autenticado' };

        setIsLoading(true);
        const result = await deleteProductWithAudit(productId, user);
        setIsLoading(false);
        return result;
    };

    return {
        createProduct,
        updateProduct,
        deleteProduct,
        isLoading,
    };
};
