import React from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown } from 'lucide-react';
import { getTodayDateString } from '../../utils/dateUtils';

export type PeriodOption =
 | 'all'
 | 'today'
 | 'yesterday'
 | 'thisWeek'
 | 'thisMonth'
 | 'thisYear'
 | 'lastWeek'
 | 'lastMonth'
 | 'lastYear'
 | 'custom';

export interface PeriodFilterProps {
 selectedPeriod: PeriodOption;
 onPeriodChange: (period: PeriodOption) => void;
 customStartDate?: string;
 customEndDate?: string;
 onCustomDatesChange?: (start: string, end: string) => void;
}

export const PeriodFilter: React.FC<PeriodFilterProps> = ({
 selectedPeriod,
 onPeriodChange,
 customStartDate,
 customEndDate,
 onCustomDatesChange
}) => {
 const [isOpen, setIsOpen] = React.useState(false);
 const [showCustomPicker, setShowCustomPicker] = React.useState(false);

 const periodLabels: Record<PeriodOption, string> = {
 all: 'Todos os registos',
 today: 'Hoje',
 yesterday: 'Ontem',
 thisWeek: 'Esta semana',
 thisMonth: 'Este mês',
 thisYear: 'Este ano',
 lastWeek: 'Semana passada',
 lastMonth: 'Mês passado',
 lastYear: 'Ano passado',
 custom: 'Período personalizado'
 };

 const basicPeriods: PeriodOption[] = ['all', 'today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'lastYear', 'custom'];

 const handlePeriodSelect = (period: PeriodOption) => {
 onPeriodChange(period);
 if (period === 'custom') {
 setShowCustomPicker(true);
 } else {
 setShowCustomPicker(false);
 setIsOpen(false);
 setDropdownPosition(null);
 }
 };

 const handleCustomDates = () => {
 if (customStartDate && onCustomDatesChange) {
 // Se não houver data final, usar a mesma data inicial (um único dia)
 const endDate = customEndDate || customStartDate;
 onCustomDatesChange(customStartDate, endDate);
 setIsOpen(false);
 setShowCustomPicker(false);
 setDropdownPosition(null);
 }
 };

 // Get date range for selected period (for display only)
 const getDateRange = (): { start: Date; end: Date } => {
 const today = new Date();
 let start = new Date();
 let end = new Date();

 switch (selectedPeriod) {
 case 'all':
 start = new Date(2000, 0, 1);
 end = new Date(2099, 11, 31);
 end.setHours(23, 59, 59, 999);
 break;
 case 'today':
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 break;
 case 'yesterday':
 start.setDate(today.getDate() - 1);
 start.setHours(0, 0, 0, 0);
 end.setDate(today.getDate() - 1);
 end.setHours(23, 59, 59, 999);
 break;
 case 'thisWeek': {
 // Segunda-feira da semana atual
 const dayOfWeek = today.getDay();
 const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
 start.setDate(diff);
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 break;
 }
 case 'thisMonth':
 start = new Date(today.getFullYear(), today.getMonth(), 1);
 start.setHours(0, 0, 0, 0);
 const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
 end.setTime(lastDayOfMonth.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'thisYear':
 start = new Date(today.getFullYear(), 0, 1);
 start.setHours(0, 0, 0, 0);
 const lastDayOfYear = new Date(today.getFullYear(), 11, 31);
 end.setTime(lastDayOfYear.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'lastWeek': {
 const dayOfWeek = today.getDay();
 const mondayOffset = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
 const lastMonday = mondayOffset - 7;
 start.setDate(lastMonday);
 start.setHours(0, 0, 0, 0);
 end.setDate(lastMonday + 6);
 end.setHours(23, 59, 59, 999);
 break;
 }
 case 'lastMonth':
 start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
 start.setHours(0, 0, 0, 0);
 const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
 end.setTime(lastDayLastMonth.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'lastYear':
 start = new Date(today.getFullYear() - 1, 0, 1);
 start.setHours(0, 0, 0, 0);
 const lastDayLastYear = new Date(today.getFullYear() - 1, 11, 31);
 end.setTime(lastDayLastYear.getTime());
 end.setHours(23, 59, 59, 999);
 break;
 case 'custom':
 if (customStartDate) {
 start = new Date(customStartDate);
 start.setHours(0, 0, 0, 0);
 // Se não houver data final, usar a mesma data inicial (um único dia)
 end = new Date(customEndDate || customStartDate);
 end.setHours(23, 59, 59, 999);
 } else {
 start.setHours(0, 0, 0, 0);
 end.setHours(23, 59, 59, 999);
 }
 break;
 }

 return { start, end };
 };

 const { start, end } = getDateRange();
 const formatDate = (date: Date) => {
 const day = String(date.getDate()).padStart(2, '0');
 const month = String(date.getMonth() + 1).padStart(2, '0');
 const year = date.getFullYear();
 return `${day}/${month}/${year}`;
 };

 const buttonRef = React.useRef<HTMLButtonElement>(null);
 const dropdownRef = React.useRef<HTMLDivElement>(null);
 const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number } | null>(null);

 const calculatePosition = React.useCallback(() => {
 if (!buttonRef.current) return;
 
 const rect = buttonRef.current.getBoundingClientRect();
 const viewportWidth = window.innerWidth;
 const viewportHeight = window.innerHeight;
 const dropdownWidth = showCustomPicker ? 320 : 220;
 const dropdownHeight = showCustomPicker ? 200 : Math.min(300, viewportHeight - 40);
 const spacing = 8;
 const padding = 12;
 
 // Calcular posição horizontal - alinhar é  esquerda do botão
 let left = rect.left;
 
 // Se não cabe à  direita, ajustar para a esquerda
 if (left + dropdownWidth > viewportWidth - padding) {
 left = viewportWidth - dropdownWidth - padding;
 }
 
 // Se não cabe à  esquerda, alinhar é  esquerda da viewport
 if (left < padding) {
 left = padding;
 }
 
 // Calcular posição vertical - priorizar abaixo, mas ajustar se necessário
 let top = rect.bottom + spacing;
 
 // Se não cabe abaixo, mostrar acima
 if (top + dropdownHeight > viewportHeight - padding) {
 top = rect.top - dropdownHeight - spacing;
 
 // Se também não cabe acima, ajustar para caber na viewport
 if (top < padding) {
 top = padding;
 // Limitar altura se necessário
 const maxHeight = viewportHeight - top - padding;
 if (maxHeight < dropdownHeight) {
 // A altura será limitada pelo CSS maxHeight
 }
 }
 }
 
 setDropdownPosition({ top, left });
 }, [showCustomPicker]);

 React.useEffect(() => {
 if (isOpen && buttonRef.current) {
 // Calcular posição inicial após renderização
 const timeoutId = setTimeout(() => {
 calculatePosition();
 }, 0);
 
 // Reposicionar ao rolar ou redimensionar
 const handleScroll = () => {
 calculatePosition();
 };
 const handleResize = () => {
 calculatePosition();
 };
 
 window.addEventListener('scroll', handleScroll, true);
 window.addEventListener('resize', handleResize);
 
 return () => {
 clearTimeout(timeoutId);
 window.removeEventListener('scroll', handleScroll, true);
 window.removeEventListener('resize', handleResize);
 };
 } else {
 setDropdownPosition(null);
 }
 }, [isOpen, showCustomPicker, calculatePosition]);

 // Fechar dropdown ao pressionar Escape
 React.useEffect(() => {
 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && isOpen) {
 setIsOpen(false);
 setShowCustomPicker(false);
 }
 };
 
 if (isOpen) {
 document.addEventListener('keydown', handleEscape);
 return () => document.removeEventListener('keydown', handleEscape);
 }
 }, [isOpen]);

 return (
 <div className="relative flex items-center gap-3 flex-wrap">
 <button
 ref={buttonRef}
 type="button"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 setIsOpen(!isOpen);
 }}
 className={`flex items-center gap-2 px-4 py-2 bg-surface-raised border rounded-lg hover:bg-surface-base transition-colors text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-500 ${
 selectedPeriod !== 'today' || customStartDate || customEndDate
 ? 'border-brand-500 dark:border-brand-400 bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 '
 : 'border-border-strong text-content-primary'
 }`}
 aria-expanded={isOpen}
 aria-haspopup="true"
 >
 <Calendar className="w-4 h-4" />
 <span>{periodLabels[selectedPeriod]}</span>
 <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
 </button>

 {isOpen && dropdownPosition && typeof document !== 'undefined' ? createPortal(
 <>
 <div 
 className="fixed inset-0 z-[9998]" 
 onClick={(e) => {
 e.stopPropagation();
 setIsOpen(false);
 setShowCustomPicker(false);
 setDropdownPosition(null);
 }}
 role="presentation"
 />
 <div 
 ref={dropdownRef}
 className="fixed z-[9999] bg-surface-raised border border-border-strong rounded-lg shadow-xl"
 style={{
 top: `${dropdownPosition.top}px`,
 left: `${dropdownPosition.left}px`,
 width: showCustomPicker ? '320px' : '220px',
 maxHeight: 'calc(100vh - 24px)',
 overflow: 'hidden',
 display: 'flex',
 flexDirection: 'column'
 }}
 onClick={(e) => e.stopPropagation()}
 role="menu"
 aria-label="Selecionar período"
 >
 {!showCustomPicker ? (
 <div className="py-2 overflow-y-auto overflow-x-hidden">
 {basicPeriods.map((period) => (
 <button
 key={period}
 type="button"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 handlePeriodSelect(period);
 }}
 className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-base transition-colors whitespace-nowrap focus:outline-none focus:bg-surface-base ${
 selectedPeriod === period
 ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 font-medium'
 : 'text-content-primary'
 }`}
 >
 {periodLabels[period]}
 </button>
 ))}
 </div>
 ) : (
 <div className="p-4 space-y-3">
 <div>
 <label className="block text-xs font-medium text-content-primary mb-1">
 Data inicial <span className="text-content-muted">(obrigatório)</span>
 </label>
 <input
 type="date"
 value={customStartDate || ''}
 onChange={(e) => onCustomDatesChange?.(e.target.value, customEndDate || '')}
 className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
 max={customEndDate || getTodayDateString()}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-content-primary mb-1">
 Data final <span className="text-content-muted">(opcional)</span>
 </label>
 <input
 type="date"
 value={customEndDate || ''}
 onChange={(e) => onCustomDatesChange?.(customStartDate || '', e.target.value)}
 className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
 min={customStartDate || undefined}
 max={getTodayDateString()}
 />
 </div>
 {customStartDate && !customEndDate && (
 <div className="text-xs text-content-muted bg-blue-50 dark:bg-blue-900/20 px-2 py-1.5 rounded">
 Será selecionado apenas o dia {formatDate(new Date(customStartDate))}
 </div>
 )}
 <div className="flex gap-2">
 <button
 onClick={handleCustomDates}
 disabled={!customStartDate}
 className="flex-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 Aplicar
 </button>
 <button
 onClick={() => {
 setShowCustomPicker(false);
 setIsOpen(false);
 setDropdownPosition(null);
 }}
 className="px-3 py-2 bg-surface-base hover:bg-border-strong text-content-primary rounded-lg text-sm font-medium transition-colors"
 >
 Cancelar
 </button>
 </div>
 </div>
 )}
 </div>
 </>,
 document.body
 ) : null}

 {selectedPeriod !== 'custom' && selectedPeriod !== 'all' && (
 <span className="ml-3 text-xs text-content-muted">
 {formatDate(start)} - {formatDate(end)}
 </span>
 )}
 </div>
 );
};


