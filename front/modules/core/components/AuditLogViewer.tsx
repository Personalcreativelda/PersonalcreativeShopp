import React, { useState } from 'react';
import { AuditLog } from '../types/auth';
import {
 getActionLabel,
 getEntityTypeLabel,
 getActionColor,
 getActionIcon,
 formatDiff
} from '../utils/auditUtils';
import { Clock, User, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface AuditLogViewerProps {
 logs: AuditLog[];
 showFilters?: boolean;
 compact?: boolean;
}

/**
 * Componente para visualizar logs de auditoria
 * 
 * @example
 * <AuditLogViewer logs={auditLogs} showFilters />
 */
export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
 logs,
 showFilters = false,
 compact = false,
}) => {
 const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
 const [filterAction, setFilterAction] = useState<string>('all');
 const [filterEntity, setFilterEntity] = useState<string>('all');

 const toggleExpanded = (logId: string) => {
 const newExpanded = new Set(expandedLogs);
 if (newExpanded.has(logId)) {
 newExpanded.delete(logId);
 } else {
 newExpanded.add(logId);
 }
 setExpandedLogs(newExpanded);
 };

 const formatDate = (dateString: string) => {
 const date = new Date(dateString);
 return new Intl.DateTimeFormat('pt-PT', {
 day: '2-digit',
 month: '2-digit',
 year: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit',
 }).format(date);
 };

 // Filtrar logs
 const filteredLogs = logs.filter((log) => {
 if (filterAction !== 'all' && log.action !== filterAction) return false;
 if (filterEntity !== 'all' && log.entityType !== filterEntity) return false;
 return true;
 });

 // Obter ações únicas para filtro
 const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));
 const uniqueEntities = Array.from(new Set(logs.map((log) => log.entityType)));

 const renderDiff = (log: AuditLog) => {
 if (!log.oldData && !log.newData) return null;

 const diff = formatDiff(log.oldData, log.newData);

 return (
 <div className="mt-3 p-3 bg-surface-base rounded-md text-sm">
 <h4 className="font-medium text-content-secondary mb-2">Alterações:</h4>

 {/* Campos alterados */}
 {Object.keys(diff.changed).length > 0 && (
 <div className="mb-2">
 <p className="text-xs font-medium text-content-secondary mb-1">Modificados:</p>
 {Object.entries(diff.changed).map(([key, value]) => (
 <div key={key} className="ml-2 mb-1">
 <span className="font-medium">{key}:</span>
 <div className="ml-4">
 <span className="text-red-600">- {JSON.stringify(value.old)}</span>
 <br />
 <span className="text-green-600">+ {JSON.stringify(value.new)}</span>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Campos adicionados */}
 {Object.keys(diff.added).length > 0 && (
 <div className="mb-2">
 <p className="text-xs font-medium text-content-secondary mb-1">Adicionados:</p>
 {Object.entries(diff.added).map(([key, value]) => (
 <div key={key} className="ml-2 text-green-600">
 <span className="font-medium">{key}:</span> {JSON.stringify(value)}
 </div>
 ))}
 </div>
 )}

 {/* Campos removidos */}
 {Object.keys(diff.removed).length > 0 && (
 <div>
 <p className="text-xs font-medium text-content-secondary mb-1">Removidos:</p>
 {Object.entries(diff.removed).map(([key, value]) => (
 <div key={key} className="ml-2 text-red-600">
 <span className="font-medium">{key}:</span> {JSON.stringify(value)}
 </div>
 ))}
 </div>
 )}
 </div>
 );
 };

 if (logs.length === 0) {
 return (
 <div className="text-center py-8 text-content-muted">
 <FileText className="w-12 h-12 mx-auto mb-2 text-content-muted" />
 <p>Nenhum log de auditoria encontrado</p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Filtros */}
 {showFilters && (
 <div className="flex gap-4 p-4 bg-surface-base rounded-lg">
 <div className="flex-1">
 <label className="block text-sm font-medium text-content-secondary mb-1">Ação</label>
 <select
 value={filterAction}
 onChange={(e) => setFilterAction(e.target.value)}
 className="w-full px-3 py-2 border border-border-default rounded-md text-sm"
 >
 <option value="all">Todas</option>
 {uniqueActions.map((action) => (
 <option key={action} value={action}>
 {getActionLabel(action)}
 </option>
 ))}
 </select>
 </div>

 <div className="flex-1">
 <label className="block text-sm font-medium text-content-secondary mb-1">Entidade</label>
 <select
 value={filterEntity}
 onChange={(e) => setFilterEntity(e.target.value)}
 className="w-full px-3 py-2 border border-border-default rounded-md text-sm"
 >
 <option value="all">Todas</option>
 {uniqueEntities.map((entity) => (
 <option key={entity} value={entity}>
 {getEntityTypeLabel(entity)}
 </option>
 ))}
 </select>
 </div>
 </div>
 )}

 {/* Timeline de Logs */}
 <div className="space-y-3">
 {filteredLogs.map((log) => {
 const isExpanded = expandedLogs.has(log.id);

 return (
 <div
 key={log.id}
 className="bg-surface-raised border border-border-default rounded-lg p-4 hover:shadow-md transition-shadow"
 >
 {/* Header */}
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3 flex-1">
 <span className="text-2xl">{getActionIcon(log.action)}</span>
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <span className={`font-semibold ${getActionColor(log.action)}`}>
 {getActionLabel(log.action)}
 </span>
 <span className="text-content-muted">•</span>
 <span className="text-sm text-content-secondary">
 {getEntityTypeLabel(log.entityType)}
 </span>
 {log.entityName && (
 <>
 <span className="text-content-muted">•</span>
 <span className="text-sm font-medium text-content-primary">
 {log.entityName}
 </span>
 </>
 )}
 </div>

 {/* Metadata */}
 <div className="flex items-center gap-4 text-xs text-content-muted">
 {log.userName && (
 <div className="flex items-center gap-1">
 <User className="w-3 h-3" />
 <span>{log.userName}</span>
 </div>
 )}
 <div className="flex items-center gap-1">
 <Clock className="w-3 h-3" />
 <span>{formatDate(log.createdAt)}</span>
 </div>
 {log.ipAddress && log.ipAddress !== 'client-ip' && (
 <span>IP: {log.ipAddress}</span>
 )}
 </div>
 </div>
 </div>

 {/* Expand Button */}
 {(log.oldData || log.newData) && (
 <button
 onClick={() => toggleExpanded(log.id)}
 className="p-1 hover:bg-surface-base rounded transition-colors"
 >
 {isExpanded ? (
 <ChevronUp className="w-5 h-5 text-content-secondary" />
 ) : (
 <ChevronDown className="w-5 h-5 text-content-secondary" />
 )}
 </button>
 )}
 </div>

 {/* Expanded Details */}
 {isExpanded && renderDiff(log)}
 </div>
 );
 })}
 </div>

 {/* Results Count */}
 <div className="text-center text-sm text-content-muted">
 Mostrando {filteredLogs.length} de {logs.length} logs
 </div>
 </div>
 );
};
