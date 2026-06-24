/**
 * Modal de detalhe de um lote de stock.
 * Mostra produto, variante, origem, quantidade, custo e associação à factura (quando de compra).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ModalPortal } from '../../../core/components/ui/ModalPortal';
import { X, Edit2, ExternalLink } from 'lucide-react';
import { StockLotRow, stockLotsService } from '../../services/stockLotsService';
import { PurchaseViewerModal } from './PurchaseViewerModal';
import { Purchase } from '../../../core/types/types';
interface LotDetailModalProps {
 open: boolean;
 lot: StockLotRow | null;
 onClose: () => void;
 onEdit: (lot: StockLotRow) => void;
}

const formatDate = (s: string) => (s ? new Date(s).toLocaleDateString('pt-PT', { dateStyle: 'short' }) : '—');
const formatMoney = (n: number) => n.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const LotDetailModal: React.FC<LotDetailModalProps> = ({ open, lot, onClose, onEdit }) => {
 const [isPurchaseModalOpen, setIsPurchaseModalOpen] = React.useState(false);
 const [viewingPurchase, setViewingPurchase] = React.useState<Purchase | null>(null);

 if (!lot) return null;

 return (
 <ModalPortal open={open} onClose={onClose} zIndex={10001}>
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b border-border-default flex justify-between items-center">
 <h2 className="text-xl font-bold text-content-primary">Detalhes do Lote</h2>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => { onEdit(lot); onClose(); }}
 className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors text-sm"
 title="Editar lote"
 >
 <Edit2 className="w-4 h-4" />
 Editar
 </button>
 <button
 type="button"
 onClick={onClose}
 className="text-content-muted hover:text-content-secondary "
 >
 <X className="w-6 h-6" />
 </button>
 </div>
 </div>
 <div className="p-6 space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Produto</label>
 <p className="text-content-primary">{lot.productName || '—'}</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Variante</label>
 <p className="text-content-primary">{lot.variantName || '—'}</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Origem</label>
 <p className="text-content-primary">{stockLotsService.getSourceTypeLabel(lot.sourceType)}</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Data de recepção</label>
 <p className="text-content-primary">{formatDate(lot.receivedAt)}</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Quantidade</label>
 <p className="text-content-primary">{formatMoney(lot.quantity)} {lot.unit}</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Custo unitário</label>
 <p className="text-content-primary">{formatMoney(lot.unitCost)} MTn</p>
 </div>
 <div className="sm:col-span-2">
 <label className="block text-sm font-medium text-content-secondary mb-1">Valor total</label>
 <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatMoney(lot.totalValue)} MTn</p>
 </div>
 </div>

 {lot.sourceType === 'purchase' && (lot.invoiceNumber || lot.supplierName || lot.purchaseDate || lot.sourceId) && (
 <div className="pt-4 border-t border-border-default">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-semibold text-content-secondary">Associação à compra</h3>
 {lot.sourceId && (
 <button
 onClick={async () => {
 try {
 const { dataService } = await import('../../../core/services/dataService');
 const purchases = await dataService.getPurchases();
 const foundPurchase = purchases.find(p => p.id === lot.sourceId);
 if (foundPurchase) {
 setViewingPurchase(foundPurchase);
 setIsPurchaseModalOpen(true);
 } else {
 console.error('Compra não encontrada');
 }
 } catch (error) {
 console.error('Erro ao carregar os detalhes da compra:', error);
 }
 }}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/50 rounded-md transition-colors"
 >
 Ver Fatura
 <ExternalLink className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {lot.invoiceNumber && (
 <div>
 <label className="block text-xs font-medium text-content-muted mb-1">Fatura</label>
 <p className="text-content-primary">{lot.invoiceNumber}</p>
 </div>
 )}
 {lot.supplierName && (
 <div>
 <label className="block text-xs font-medium text-content-muted mb-1">Fornecedor</label>
 <p className="text-content-primary">{lot.supplierName}</p>
 </div>
 )}
 {lot.purchaseDate && (
 <div>
 <label className="block text-xs font-medium text-content-muted mb-1">Data da compra</label>
 <p className="text-content-primary">{formatDate(lot.purchaseDate)}</p>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 
 <PurchaseViewerModal
 open={isPurchaseModalOpen}
 purchase={viewingPurchase}
 onClose={() => {
 setIsPurchaseModalOpen(false);
 setViewingPurchase(null);
 }}
 />
 </ModalPortal>
 );
};
