import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

type PaginationMode = 'simple' | 'full';

export interface PaginationProps {
 mode?: PaginationMode;
 currentPage: number;
 totalItems: number;
 itemsPerPage: number;
 onPageChange: (page: number) => void;
 className?: string;
 showRangeText?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
 mode = 'full',
 currentPage,
 totalItems,
 itemsPerPage,
 onPageChange,
 className = '',
 showRangeText = true,
}) => {
 const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
 if (totalPages <= 1) return null;

 const safePage = Math.min(Math.max(1, currentPage), totalPages);
 const start = (safePage - 1) * itemsPerPage + 1;
 const end = Math.min(safePage * itemsPerPage, totalItems);

 const goTo = (page: number) => onPageChange(Math.min(Math.max(1, page), totalPages));

 const btnCls = 'p-2 rounded-lg border border-border-default disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base transition-colors text-content-secondary';

 if (mode === 'simple') {
 return (
 <div
 className={[
 'bg-surface-base px-6 py-4 flex items-center justify-between border-t border-border-default',
 className,
 ].join(' ')}
 >
 {showRangeText ? (
 <div className="text-sm text-content-muted">
 Mostrando {start} a {end} de {totalItems}
 </div>
 ) : (
 <div />
 )}
 <div className="flex items-center gap-2">
 <button type="button" onClick={() => goTo(safePage - 1)} disabled={safePage === 1} className={btnCls} aria-label="Página anterior">
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span className="text-sm text-content-muted">Página {safePage} de {totalPages}</span>
 <button type="button" onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages} className={btnCls} aria-label="Próxima página">
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className={['flex justify-center items-center gap-2', className].join(' ')}>
 <button type="button" onClick={() => goTo(1)} disabled={safePage === 1} className={btnCls} aria-label="Primeira página">
 <ChevronsLeft className="w-4 h-4" />
 </button>
 <button type="button" onClick={() => goTo(safePage - 1)} disabled={safePage === 1} className={btnCls} aria-label="Página anterior">
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span className="px-4 py-2 text-sm text-content-secondary">
 Página {safePage} de {totalPages}
 </span>
 <button type="button" onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages} className={btnCls} aria-label="Próxima página">
 <ChevronRight className="w-4 h-4" />
 </button>
 <button type="button" onClick={() => goTo(totalPages)} disabled={safePage === totalPages} className={btnCls} aria-label="Última página">
 <ChevronsRight className="w-4 h-4" />
 </button>
 {showRangeText && (
 <span className="ml-2 text-sm text-content-muted">
 Mostrando {start}-{end} de {totalItems}
 </span>
 )}
 </div>
 );
};
