import React, { useState } from 'react';
import { useAuth } from '../modules/core/hooks/useAuth';
import { useAuditLog } from '../modules/core/hooks/useAuditLog';
import { AuditLogViewer } from '../modules/core/components/AuditLogViewer';
import { ProtectedAction } from '../modules/core/components/ProtectedAction';
import {
    FileText,
    Download,
    RefreshCw,
    BarChart3,
    Calendar,
    Filter
} from 'lucide-react';

/**
 * Página de Logs de Auditoria
 * 
 * Exibe todos os logs de auditoria do sistema com filtros e estatísticas.
 */
export const AuditLogsPage: React.FC = () => {
    const { user } = useAuth();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedAction, setSelectedAction] = useState<string>('');
    const [selectedEntity, setSelectedEntity] = useState<string>('');

    const { auditLogs, isLoading, refresh, stats } = useAuditLog(user, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        action: selectedAction || undefined,
        entityType: selectedEntity || undefined,
        limit: 100,
    });

    const handleExport = () => {
        // Implementar export para CSV
        const csv = auditLogs.map((log) => ({
            Data: new Date(log.createdAt).toLocaleString('pt-PT'),
            Utilizador: log.userName || log.userEmail || 'Sistema',
            Ação: log.action,
            Entidade: log.entityType,
            Nome: log.entityName || '-',
            IP: log.ipAddress || '-',
        }));

        const csvContent = [
            Object.keys(csv[0]).join(','),
            ...csv.map((row) => Object.values(row).join(',')),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString()}.csv`;
        a.click();
    };

    return (
        <ProtectedAction permission="system.audit_logs">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Logs de Auditoria</h1>
                    <p className="text-gray-600">Rastreamento completo de ações do sistema</p>
                </div>

                {/* Statistics Dashboard */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <FileText className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Total de Ações</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalActions}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <BarChart3 className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Tipos de Ações</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {Object.keys(stats.actionsByType).length}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <FileText className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Utilizadores Ativos</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.topUsers.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions by Type Chart */}
                {stats && Object.keys(stats.actionsByType).length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações por Tipo</h3>
                        <div className="space-y-2">
                            {Object.entries(stats.actionsByType)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 10)
                                .map(([action, count]) => {
                                    const percentage = (count / stats.totalActions) * 100;
                                    return (
                                        <div key={action} className="flex items-center gap-3">
                                            <span className="text-sm text-gray-600 w-32">{action}</span>
                                            <div className="flex-1 bg-gray-200 rounded-full h-6">
                                                <div
                                                    className="bg-blue-600 h-6 rounded-full flex items-center justify-end px-2"
                                                    style={{ width: `${percentage}%` }}
                                                >
                                                    <span className="text-xs text-white font-medium">{count}</span>
                                                </div>
                                            </div>
                                            <span className="text-sm text-gray-500 w-16 text-right">
                                                {percentage.toFixed(1)}%
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter className="w-5 h-5 text-gray-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Data Início
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Data Fim
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ação</label>
                            <select
                                value={selectedAction}
                                onChange={(e) => setSelectedAction(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                                <option value="">Todas</option>
                                <option value="create">Criar</option>
                                <option value="update">Atualizar</option>
                                <option value="delete">Apagar</option>
                                <option value="login">Login</option>
                                <option value="logout">Logout</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Entidade</label>
                            <select
                                value={selectedEntity}
                                onChange={(e) => setSelectedEntity(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                                <option value="">Todas</option>
                                <option value="product">Produto</option>
                                <option value="sale">Venda</option>
                                <option value="customer">Cliente</option>
                                <option value="user">Utilizador</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={refresh}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Atualizar
                        </button>

                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            <Download className="w-4 h-4" />
                            Exportar CSV
                        </button>
                    </div>
                </div>

                {/* Audit Logs */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Ações</h3>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                        </div>
                    ) : (
                        <AuditLogViewer logs={auditLogs} />
                    )}
                </div>
            </div>
        </ProtectedAction>
    );
};
