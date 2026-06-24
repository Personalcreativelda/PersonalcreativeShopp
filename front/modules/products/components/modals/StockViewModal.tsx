import React from 'react';
import { StockMovement } from '../../../core/types/types';
import { Modal } from '../shared/Modal';

export interface StockInsight {
 productName: string;
 variant?: string;
 stockQty: number;
 orderedQty: number;
 difference: number;
}

interface StockViewModalProps {
 open: boolean;
 stock: StockMovement | null;
 onClose: () => void;
 insights?: StockInsight[];
}

export const StockViewModal: React.FC<StockViewModalProps> = ({
 open,
 stock,
 onClose,
 insights = [],
}) => {
 if (!open || !stock) return null;

 return (
 <Modal open={open} onClose={onClose} title="Detalhes da Atualização de Stock" maxWidth="xl">
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Data</label>
 <p className="text-content-primary">{new Date(stock.date).toLocaleDateString('pt-MZ')}</p>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Itens ({stock.items.length})
 </label>
 <div className="space-y-2">
 {stock.items.map((item, idx) => (
 <div key={idx} className="p-3 bg-surface-base rounded-lg">
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium text-content-primary">{item.productName}</div>
 {item.variant && (
 <div className="text-sm text-content-muted">Variação: {item.variant}</div>
 )}
 </div>
 <div className="text-right">
 <div className="font-medium text-content-primary">
 {item.quantity} {item.unit || 'un'}
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {stock.notes && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Notas</label>
 <p className="text-content-primary">{stock.notes}</p>
 </div>
 )}

 {insights.length > 0 && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Comparação com Pedidos
 </label>
 <div className="space-y-2">
 {insights.map((insight, idx) => (
 <div
 key={idx}
 className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
 >
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium text-content-primary">
 {insight.productName} {insight.variant && `(${insight.variant})`}
 </div>
 <div className="text-sm text-content-secondary">
 Stock: {insight.stockQty} | Pedidos: {insight.orderedQty}
 </div>
 </div>
 <div
 className={`font-medium ${insight.difference > 0 ? 'text-green-600' : 'text-red-600'}`}
 >
 {insight.difference > 0 ? '+' : ''}{insight.difference.toFixed(1)}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </Modal>
 );
};
