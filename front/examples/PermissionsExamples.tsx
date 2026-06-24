/**
 * Exemplos de Uso do Sistema de Permissões
 * 
 * Este arquivo demonstra como usar o novo sistema de permissões
 * em diferentes cenários comuns.
 */

import React from 'react';
import { ProtectedAction } from '../modules/core/components/ProtectedAction';
import { usePermissions } from '../modules/core/hooks/usePermissions';
import { useAuth } from '../modules/auth/hooks/useAuth';
import { permissionsService } from '../modules/core/services/permissionsService';

// ============================================
// Exemplo 1: Proteger um Botão de Delete
// ============================================
export const ProductDeleteButton: React.FC<{ productId: string }> = ({ productId }) => {
    const handleDelete = () => {
        // Lógica de delete
        console.log('Deleting product:', productId);
    };

    return (
        <ProtectedAction permission="products.delete">
            <button onClick={handleDelete} className="btn btn-danger">
                Apagar Produto
            </button>
        </ProtectedAction>
    );
};

// ============================================
// Exemplo 2: Mostrar Botão Desabilitado
// ============================================
export const ProductEditButton: React.FC<{ productId: string }> = ({ productId }) => {
    const handleEdit = () => {
        console.log('Editing product:', productId);
    };

    return (
        <ProtectedAction permission="products.edit" showDisabled>
            {(hasPermission) => (
                <button
                    onClick={handleEdit}
                    disabled={!hasPermission}
                    className="btn btn-primary"
                    title={!hasPermission ? 'Sem permissão para editar' : ''}
                >
                    Editar Produto
                </button>
            )}
        </ProtectedAction>
    );
};

// ============================================
// Exemplo 3: Múltiplas Permissões (ANY)
// ============================================
export const SalesEditButton: React.FC<{ saleId: string }> = ({ saleId }) => {
    const handleEdit = () => {
        console.log('Editing sale:', saleId);
    };

    // Pode editar se tiver sales.edit (próprias) OU sales.edit.all (todas)
    return (
        <ProtectedAction permission={['sales.edit', 'sales.edit.all']}>
            <button onClick={handleEdit} className="btn btn-primary">
                Editar Venda
            </button>
        </ProtectedAction>
    );
};

// ============================================
// Exemplo 4: Múltiplas Permissões (ALL)
// ============================================
export const FinancialReportExport: React.FC = () => {
    const handleExport = () => {
        console.log('Exporting financial report');
    };

    // Precisa de AMBAS as permissões
    return (
        <ProtectedAction
            permission={['financial.view', 'financial.export']}
            requireAll
        >
            <button onClick={handleExport} className="btn btn-success">
                Exportar Relatório Financeiro
            </button>
        </ProtectedAction>
    );
};

// ============================================
// Exemplo 5: Usar Hook Diretamente
// ============================================
export const DashboardStats: React.FC = () => {
    const { user } = useAuth();
    const { hasPermission, hasAnyPermission } = usePermissions(user);

    const canViewSales = hasPermission('sales.view');
    const canViewFinancial = hasPermission('financial.view');
    const canManageUsers = hasPermission('users.manage_roles');

    return (
        <div className="dashboard-stats">
            {canViewSales && (
                <div className="stat-card">
                    <h3>Vendas Totais</h3>
                    <p>R$ 150,000</p>
                </div>
            )}

            {canViewFinancial && (
                <div className="stat-card">
                    <h3>Receita Líquida</h3>
                    <p>R$ 120,000</p>
                </div>
            )}

            {canManageUsers && (
                <div className="stat-card">
                    <h3>Utilizadores Ativos</h3>
                    <p>25</p>
                </div>
            )}
        </div>
    );
};

// ============================================
// Exemplo 6: Verificação Assíncrona
// ============================================
export const ApprovalButton: React.FC<{ approvalLevel: number }> = ({ approvalLevel }) => {
    const { user } = useAuth();
    const [canApprove, setCanApprove] = React.useState(false);

    React.useEffect(() => {
        const checkApprovalPermission = async () => {
            if (user) {
                const result = await permissionsService.canApprove(user.id, approvalLevel);
                setCanApprove(result);
            }
        };

        checkApprovalPermission();
    }, [user, approvalLevel]);

    if (!canApprove) {
        return null;
    }

    return (
        <button className="btn btn-success">
            Aprovar
        </button>
    );
};

// ============================================
// Exemplo 7: Proteger Seção Inteira
// ============================================
export const AdminPanel: React.FC = () => {
    return (
        <ProtectedAction
            permission="system.settings"
            fallback={
                <div className="alert alert-warning">
                    Você não tem permissão para aceder ao painel de administração.
                </div>
            }
        >
            <div className="admin-panel">
                <h2>Painel de Administração</h2>
                <p>Configurações do sistema...</p>
            </div>
        </ProtectedAction>
    );
};

// ============================================
// Exemplo 8: Navegação Condicional
// ============================================
export const NavigationMenu: React.FC = () => {
    const { user } = useAuth();
    const { hasPermission } = usePermissions(user);

    return (
        <nav>
            <ul>
                <li><a href="/dashboard">Dashboard</a></li>

                {hasPermission('sales.view') && (
                    <li><a href="/sales">Vendas</a></li>
                )}

                {hasPermission('products.view') && (
                    <li><a href="/products">Produtos</a></li>
                )}

                {hasPermission('financial.view') && (
                    <li><a href="/financial">Financeiro</a></li>
                )}

                {hasPermission('users.view') && (
                    <li><a href="/users">Utilizadores</a></li>
                )}

                {hasPermission('system.settings') && (
                    <li><a href="/settings">Configurações</a></li>
                )}
            </ul>
        </nav>
    );
};

// ============================================
// Exemplo 9: Verificar Permissões em Ações
// ============================================
export const ProductActions: React.FC<{ productId: string }> = ({ productId }) => {
    const { user } = useAuth();
    const { hasPermission } = usePermissions(user);

    const handleAction = async (action: string) => {
        // Verificar permissão antes de executar ação
        if (action === 'delete' && !hasPermission('products.delete')) {
            alert('Você não tem permissão para apagar produtos');
            return;
        }

        if (action === 'edit' && !hasPermission('products.edit')) {
            alert('Você não tem permissão para editar produtos');
            return;
        }

        // Executar ação
        console.log(`Executing ${action} on product ${productId}`);
    };

    return (
        <div className="product-actions">
            <button onClick={() => handleAction('view')}>Ver</button>

            {hasPermission('products.edit') && (
                <button onClick={() => handleAction('edit')}>Editar</button>
            )}

            {hasPermission('products.delete') && (
                <button onClick={() => handleAction('delete')}>Apagar</button>
            )}
        </div>
    );
};
