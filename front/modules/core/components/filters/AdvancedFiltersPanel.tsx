import React from 'react';

export interface AdvancedFiltersPanelProps {
 title?: string;
 description?: string;
 isOpen: boolean;
 isStickyOnMobile?: boolean;
 stickyTopClassName?: string;
 className?: string;
 children: React.ReactNode;
}

export const AdvancedFiltersPanel: React.FC<AdvancedFiltersPanelProps> = ({
 title = 'Filtros Avançados',
 description = 'Filtros adicionais para busca mais específica',
 isOpen,
 isStickyOnMobile = false,
 stickyTopClassName = 'top-[45px]',
 className = '',
 children,
}) => {
 if (!isOpen) return null;

 return (
 <div
 className={[
 'bg-surface-raised rounded-xl shadow-sm border border-border-default p-2 mb-2',
 isStickyOnMobile ? `sticky ${stickyTopClassName} z-30` : '',
 className,
 ].join(' ')}
 >
 <div className="mb-3">
 <h4 className="text-sm font-semibold text-content-primary">{title}</h4>
 <p className="text-xs text-content-muted">{description}</p>
 </div>
 {children}
 </div>
 );
};
