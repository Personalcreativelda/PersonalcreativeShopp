import React from 'react';
import { ModalPortal } from '../../../core/components/ui/ModalPortal';
import { Loader2, X, CheckCircle2 } from 'lucide-react';

export interface SyncProgressState {
 stage: string;
 current: number;
 total: number;
 logs: Array<{ message: string; type?: 'info' | 'success' | 'warning' | 'error' }>;
 stats: { created: number; updated: number; deleted: number };
}

interface SyncProgressModalProps {
 open: boolean;
 progress: SyncProgressState;
 onClose: () => void;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
 open,
 progress,
 onClose,
}) => {
 if (!open) return null;

 const isComplete = progress.current === progress.total;

 return (
 <ModalPortal open={open} onClose={onClose}>
 <div className="bg-surface-raised rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
 <div className="p-6 border-b border-border-default">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Loader2 className="w-6 h-6 animate-spin text-green-600 dark:text-green-400" />
 <h3 className="text-xl font-bold text-content-primary">Sincronizando Stock</h3>
 </div>
 {isComplete && (
 <button
 type="button"
 onClick={onClose}
 className="text-content-muted hover:text-content-secondary "
 >
 <X className="w-5 h-5" />
 </button>
 )}
 </div>
 <p className="text-sm text-content-muted mt-2">{progress.stage}</p>
 </div>

 <div className="p-6 flex-1 overflow-y-auto">
 <div className="mb-6">
 <div className="flex items-center justify-between text-sm text-content-secondary mb-2">
 <span>Progresso</span>
 <span>{progress.current}%</span>
 </div>
 <div className="w-full bg-surface-base rounded-full h-3 overflow-hidden">
 <div
 className="bg-green-600 h-full transition-all duration-300 ease-out"
 style={{ width: `${progress.current}%` }}
 />
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4 mb-6">
 <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
 <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Criados</div>
 <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
 {progress.stats.created}
 </div>
 </div>
 <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
 <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-1">Atualizados</div>
 <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
 {progress.stats.updated}
 </div>
 </div>
 <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
 <div className="text-sm text-red-600 dark:text-red-400 mb-1">Removidos</div>
 <div className="text-2xl font-bold text-red-700 dark:text-red-300">
 {progress.stats.deleted}
 </div>
 </div>
 </div>

 <div className="bg-surface-base/50 rounded-lg p-4 border border-border-default">
 <div className="text-sm font-semibold text-content-secondary mb-3">
 Log de Processamento
 </div>
 <div className="space-y-1 max-h-64 overflow-y-auto">
 {progress.logs.map((log, index) => (
 <div
 key={index}
 className={`text-xs p-2 rounded ${
 log.type === 'success'
 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
 : log.type === 'error'
 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
 : log.type === 'warning'
 ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
 : 'bg-surface-base text-content-secondary'
 }`}
 >
 <span className="font-mono">{log.message}</span>
 </div>
 ))}
 </div>
 </div>
 </div>

 {isComplete && (
 <div className="p-6 border-t border-border-default bg-green-50 dark:bg-green-900/20">
 <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
 <CheckCircle2 className="w-5 h-5" />
 <span className="font-semibold">Sincronização concluída com sucesso!</span>
 </div>
 </div>
 )}
 </div>
 </ModalPortal>
 );
};
