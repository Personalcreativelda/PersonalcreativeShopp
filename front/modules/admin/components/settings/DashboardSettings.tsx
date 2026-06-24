import React, { useState } from 'react';
import { X, Eye, EyeOff, GripVertical, RotateCcw, Save, Search, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import { useDashboardPreferences, DashboardCard } from '../../../core/hooks/useDashboardPreferences';
import { normalizeForSearch } from '../../../core/services/serviceUtils';

const categoryLabels: Record<DashboardCard['category'], string> = {
 vendas: 'Vendas e Pedidos',
 loja: 'Loja',
 producao: 'Produçéo / Fé¡brica',
 financeiro: 'Financeiro',
 estoque: 'Estoque',
 geral: 'Geral',
};

const categoryColors: Record<DashboardCard['category'], string> = {
 vendas: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
 loja: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
 producao: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
 financeiro: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
 estoque: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
 geral: 'bg-surface-base border-border-default',
};

export const DashboardSettings: React.FC = () => {
 const {
 cards,
 isConfigOpen,
 setIsConfigOpen,
 toggleCardVisibility,
 resetToDefault,
 savePreferences,
 } = useDashboardPreferences();

 const [searchTerm, setSearchTerm] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<DashboardCard['category'] | 'all'>('all');
 const [localCards, setLocalCards] = useState<DashboardCard[]>(cards);

 React.useEffect(() => {
 if (isConfigOpen) {
 setLocalCards(cards);
 setSearchTerm('');
 setSelectedCategory('all');
 }
 }, [isConfigOpen, cards]);

 const filteredCards = localCards.filter(card => {
 const matchesSearch = normalizeForSearch(card.label).includes(normalizeForSearch(searchTerm));
 const matchesCategory = selectedCategory === 'all' || card.category === selectedCategory;
 return matchesSearch && matchesCategory;
 });

 const handleToggle = (cardId: string) => {
 setLocalCards(prev =>
 prev.map(card =>
 card.id === cardId ? { ...card, visible: !card.visible } : card
 )
 );
 };

 const sortedByOrder = React.useMemo(() => [...localCards].sort((a, b) => a.order - b.order), [localCards]);

 const handleMoveUp = (cardId: string) => {
 const idx = sortedByOrder.findIndex(c => c.id === cardId);
 if (idx <= 0) return;
 const newOrder = sortedByOrder.map((c, i) => ({
 ...c,
 order: i === idx ? sortedByOrder[idx - 1].order : i === idx - 1 ? sortedByOrder[idx].order : c.order
 }));
 const reordered = newOrder.sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }));
 setLocalCards(localCards.map(c => reordered.find(r => r.id === c.id) ?? c));
 };

 const handleMoveDown = (cardId: string) => {
 const idx = sortedByOrder.findIndex(c => c.id === cardId);
 if (idx < 0 || idx >= sortedByOrder.length - 1) return;
 const newOrder = sortedByOrder.map((c, i) => ({
 ...c,
 order: i === idx ? sortedByOrder[idx + 1].order : i === idx + 1 ? sortedByOrder[idx].order : c.order
 }));
 const reordered = newOrder.sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }));
 setLocalCards(localCards.map(c => reordered.find(r => r.id === c.id) ?? c));
 };

 const handleSave = () => {
 const withOrder = sortedByOrder.map((c, i) => ({ ...c, order: i }));
 savePreferences(localCards.map(c => withOrder.find(w => w.id === c.id) ?? c));
 setIsConfigOpen(false);
 };

 const handleReset = () => {
 if (window.confirm('Tem certeza que deseja restaurar as configurações padréo? Isso iré¡ ocultar todos os cards néo essenciais.')) {
 resetToDefault();
 setLocalCards(cards);
 }
 };

 const categories = Array.from(new Set(localCards.map(c => c.category)));

 const groupedCards = categories.reduce((acc, category) => {
 acc[category] = filteredCards.filter(c => c.category === category).sort((a, b) => a.order - b.order);
 return acc;
 }, {} as Record<string, DashboardCard[]>);

 if (!isConfigOpen) return null;

 return (
 <div className="fixed inset-0 min-h-screen min-w-full z-50 flex items-center justify-center modal-overlay sm:p-4">
 <div className="bg-surface-raised rounded-none sm:rounded-xl shadow-2xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col m-0 sm:m-4">
 {/* Header */}
 <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border-default flex-shrink-0">
 <div className="flex-1 min-w-0 pr-2">
 <h2 className="text-xl sm:text-2xl font-bold text-content-primary">Personalizar Dashboard</h2>
 <p className="text-xs sm:text-sm text-content-muted mt-1">
 Escolha quais cards deseja visualizar e a ordem no dashboard
 </p>
 </div>
 <button
 onClick={() => setIsConfigOpen(false)}
 className="p-2 sm:p-2 hover:bg-surface-base rounded-lg transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
 aria-label="Fechar"
 >
 <X className="w-5 h-5 sm:w-5 sm:h-5 text-content-muted" />
 </button>
 </div>

 {/* Filters */}
 <div className="p-3 sm:p-4 border-b border-border-default space-y-2 sm:space-y-3 flex-shrink-0">
 <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
 <input
 type="text"
 placeholder="Buscar cards..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 sm:py-2 text-base sm:text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 focus:border-transparent min-h-[44px]"
 />
 </div>
 <div className="relative">
 <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
 <select
 value={selectedCategory}
 onChange={(e) => setSelectedCategory(e.target.value as DashboardCard['category'] | 'all')}
 className="w-full sm:w-auto pl-10 pr-8 py-2.5 sm:py-2 text-base sm:text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none min-h-[44px]"
 >
 <option value="all">Todas as categorias</option>
 {categories.map(cat => (
 <option key={cat} value={cat}>{categoryLabels[cat]}</option>
 ))}
 </select>
 </div>
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
 {categories.map(category => {
 const categoryCards = groupedCards[category] || [];
 if (categoryCards.length === 0) return null;

 return (
 <div key={category} className="mb-6">
 <div className={`p-3 rounded-lg mb-3 ${categoryColors[category]}`}>
 <h3 className="font-semibold text-content-primary">
 {categoryLabels[category]}
 </h3>
 </div>
 <div className="space-y-2">
 {categoryCards.map(card => {
 const sortedIndex = sortedByOrder.findIndex(c => c.id === card.id);
 const canMoveUp = sortedIndex > 0;
 const canMoveDown = sortedIndex >= 0 && sortedIndex < sortedByOrder.length - 1;
 return (
 <div
 key={card.id}
 className="flex items-center justify-between p-3 sm:p-3 bg-surface-base/50 rounded-lg hover:bg-surface-base active:bg-surface-base dark:active:bg-gray-600 transition-colors"
 >
 <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
 <GripVertical className="w-5 h-5 text-content-muted flex-shrink-0" aria-hidden />
 <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-1 min-w-0">
 <span className="font-medium text-sm sm:text-base text-content-primary truncate">
 {card.label}
 </span>
 <div className="flex items-center gap-1.5 flex-wrap">
 {card.essential && (
 <span className="px-2 py-0.5 text-xs font-medium bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded flex-shrink-0">
 Essencial
 </span>
 )}
 {card.linkTo && (
 <span className="text-xs text-content-muted truncate">
 → {card.linkTo}
 </span>
 )}
 </div>
 </div>
 </div>
 <div className="flex items-center gap-1 flex-shrink-0">
 <button
 type="button"
 onClick={() => handleMoveUp(card.id)}
 disabled={!canMoveUp}
 className="p-2 rounded-lg transition-all min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-content-muted hover:text-content-secondary hover:bg-surface-base"
 title="Subir"
 aria-label="Subir na ordem"
 >
 <ChevronUp className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={() => handleMoveDown(card.id)}
 disabled={!canMoveDown}
 className="p-2 rounded-lg transition-all min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-content-muted hover:text-content-secondary hover:bg-surface-base"
 title="Descer"
 aria-label="Descer na ordem"
 >
 <ChevronDown className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleToggle(card.id)}
 className={`p-2.5 sm:p-2 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95 ${card.visible
 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
 : 'bg-surface-base text-content-muted'
 }`}
 title={card.visible ? 'Ocultar' : 'Mostrar'}
 aria-label={card.visible ? 'Ocultar card' : 'Mostrar card'}
 >
 {card.visible ? (
 <Eye className="w-5 h-5 sm:w-5 sm:h-5" />
 ) : (
 <EyeOff className="w-5 h-5 sm:w-5 sm:h-5" />
 )}
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
 })}

 {filteredCards.length === 0 && (
 <div className="text-center py-12">
 <p className="text-content-muted">
 Nenhum card encontrado com os filtros selecionados.
 </p>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 p-4 sm:p-6 border-t border-border-default flex-shrink-0 bg-surface-raised">
 <button
 onClick={handleReset}
 className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 text-sm font-medium text-content-secondary hover:bg-surface-base rounded-lg transition-all active:scale-95 min-h-[44px] sm:min-h-[auto]"
 >
 <RotateCcw className="w-4 h-4" />
 Restaurar Padréo
 </button>
 <div className="flex gap-2 sm:gap-3">
 <button
 onClick={() => setIsConfigOpen(false)}
 className="flex-1 sm:flex-none px-4 py-3 sm:py-2 text-sm font-medium text-content-secondary hover:bg-surface-base rounded-lg transition-all active:scale-95 min-h-[44px] sm:min-h-[auto]"
 >
 Cancelar
 </button>
 <button
 onClick={handleSave}
 className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-all active:scale-95 min-h-[44px] sm:min-h-[auto]"
 >
 <Save className="w-4 h-4" />
 <span className="sm:inline">Salvar Alterações</span>
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};


