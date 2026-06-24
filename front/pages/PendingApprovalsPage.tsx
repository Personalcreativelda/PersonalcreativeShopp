import React, { useState } from 'react';
import { useAuth } from '../modules/core/hooks/useAuth';
import { useApprovals } from '../modules/core/hooks/useApprovals';
import { ApprovalButton } from '../modules/core/components/ApprovalButton';
import { PendingApproval } from '../modules/core/types/auth';
import {
    Clock,
    CheckCircle,
    XCircle,
    Filter,
    RefreshCw,
    FileText,
    User,
    Calendar
} from 'lucide-react';

/**
 * Página de Aprovações Pendentes
 * 
 * Exibe todas as solicitações de aprovação que o utilizador pode aprovar,
 * bem como suas próprias solicitações.
 */
export const PendingApprovalsPage: React.FC = () => {
    const { user } = useAuth();
    const {
        approvableRequests,
        myRequests,
        isLoading,
        approve,
        reject,
        cancel,
        refresh
    } = useApprovals(user);

    const [activeTab, setActiveTab] = useState<'approvable' | 'my-requests'>('approvable');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

    const getActionLabel = (actionType: string): string => {
        const labels: Record<string, string> = {
            delete_product: 'Apagar Produto',
            delete_sale: 'Apagar Venda',
            delete_customer: 'Apagar Cliente',
            adjust_stock: 'Ajustar Stock',
            high_discount: 'Aplicar Desconto Elevado',
            cancel_sale: 'Cancelar Venda',
            delete_purchase: 'Apagar Compra',
            manage_roles: 'Alterar Roles',
        };
        return labels[actionType] || actionType;
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
            pending: {
                color: 'bg-yellow-100 text-yellow-800',
                icon: <Clock className="w-4 h-4" />,
                label: 'Pendente'
            },
            approved: {
                color: 'bg-green-100 text-green-800',
                icon: <CheckCircle className="w-4 h-4" />,
                label: 'Aprovado'
            },
            rejected: {
                color: 'bg-red-100 text-red-800',
                icon: <XCircle className="w-4 h-4" />,
                label: 'Rejeitado'
            },
            cancelled: {
                color: 'bg-gray-100 text-gray-800',
                icon: <XCircle className="w-4 h-4" />,
                label: 'Cancelado'
            },
        };

        const badge = badges[status] || badges.pending;

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                {badge.icon}
                {badge.label}
            </span>
        );
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    const renderApprovalCard = (approval: PendingApproval, showActions: boolean = true) => (
        <div key={approval.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {getActionLabel(approval.actionType)}
                        </h3>
                        {getStatusBadge(approval.status)}
                    </div>
                    <p className="text-sm text-gray-600">
                        {approval.entityType} • ID: {approval.entityId.slice(0, 8)}...
                    </p>
                </div>
            </div>

            {/* Entity Data Preview */}
            {approval.entityData && (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Detalhes</span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                        {approval.entityData.name && <p><strong>Nome:</strong> {approval.entityData.name}</p>}
                        {approval.entityData.code && <p><strong>Código:</strong> {approval.entityData.code}</p>}
                        {approval.entityData.total && <p><strong>Total:</strong> {approval.entityData.total}</p>}
                    </div>
                </div>
            )}

            {/* Reason */}
            {approval.reason && (
                <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-1">Justificativa:</p>
                    <p className="text-sm text-gray-600 italic">"{approval.reason}"</p>
                </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>Solicitado por: {approval.requestedBy.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(approval.requestedAt)}</span>
                </div>
            </div>

            {/* Review Notes */}
            {approval.reviewNotes && (
                <div className="mb-4 p-3 bg-blue-50 rounded-md">
                    <p className="text-sm font-medium text-blue-900 mb-1">Notas da Revisão:</p>
                    <p className="text-sm text-blue-800">"{approval.reviewNotes}"</p>
                    {approval.reviewedBy && (
                        <p className="text-xs text-blue-600 mt-1">
                            Por: {approval.reviewedBy.slice(0, 8)}... • {approval.reviewedAt && formatDate(approval.reviewedAt)}
                        </p>
                    )}
                </div>
            )}

            {/* Actions */}
            {showActions && approval.status === 'pending' && (
                <div className="flex gap-2 pt-4 border-t">
                    <ApprovalButton
                        approvalId={approval.id}
                        onApprove={async (id, notes) => {
                            await approve(id, notes);
                        }}
                        onReject={async (id, notes) => {
                            await reject(id, notes);
                        }}
                    />
                </div>
            )}

            {/* Cancel Button for Own Requests */}
            {!showActions && approval.status === 'pending' && (
                <div className="flex gap-2 pt-4 border-t">
                    <button
                        onClick={() => cancel(approval.id)}
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-600 rounded-md hover:bg-red-50 transition-colors"
                    >
                        Cancelar Solicitação
                    </button>
                </div>
            )}
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
        );
    }

    const displayedApprovals = activeTab === 'approvable' ? approvableRequests : myRequests;
    const filteredApprovals = filterStatus === 'all'
        ? displayedApprovals
        : displayedApprovals.filter(a => a.status === filterStatus);

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Aprovações</h1>
                <p className="text-gray-600">Gerir solicitações de aprovação</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b">
                <button
                    onClick={() => setActiveTab('approvable')}
                    className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'approvable'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Para Aprovar ({approvableRequests.length})
                </button>
                <button
                    onClick={() => setActiveTab('my-requests')}
                    className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'my-requests'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Minhas Solicitações ({myRequests.length})
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Filtrar:</span>
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">Todos</option>
                    <option value="pending">Pendentes</option>
                    <option value="approved">Aprovados</option>
                    <option value="rejected">Rejeitados</option>
                </select>

                <button
                    onClick={refresh}
                    className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* Approvals List */}
            {filteredApprovals.length === 0 ? (
                <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhuma solicitação encontrada</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredApprovals.map((approval) =>
                        renderApprovalCard(approval, activeTab === 'approvable')
                    )}
                </div>
            )}
        </div>
    );
};
