import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { ModalPortal } from '../../../core/components/ui/ModalPortal';

export interface ModalFooterAction {
 label: string;
 onClick: () => void;
 disabled?: boolean;
 primary?: boolean;
}

interface ModalProps {
 open: boolean;
 onClose: () => void;
 title: string;
 children: React.ReactNode;
 footer?: React.ReactNode;
 maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '4xl';
 /** Use "high" quando o modal é aberto por cima de outro modal (ex.: Adicionar Variação sobre Variações do Produto) */
 priority?: 'normal' | 'high';
}

const maxWidthClasses = {
 sm: 'max-w-sm',
 md: 'max-w-md',
 lg: 'max-w-lg',
 xl: 'max-w-xl',
 '4xl': 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
 open,
 onClose,
 title,
 children,
 footer,
 maxWidth = '4xl',
 priority = 'normal',
}) => {
 useEffect(() => {
 if (!open) return;
 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape') onClose();
 };
 window.addEventListener('keydown', handleEscape);
 return () => window.removeEventListener('keydown', handleEscape);
 }, [open, onClose]);

 if (!open) return null;

 const z = priority === 'high' ? 10000 : 9999;

 return (
 <ModalPortal open={open} onClose={onClose} zIndex={z}>
 <div
 className={`bg-surface-raised rounded-xl shadow-2xl w-full ${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-y-auto flex flex-col`}
 >
 <div className="sticky top-0 bg-surface-raised border-b border-border-default px-6 py-4 flex items-center justify-between z-10 shrink-0">
 <h2 className="text-xl font-bold text-content-primary">
 {title}
 </h2>
 <button
 type="button"
 onClick={onClose}
 className="text-content-muted hover:text-content-primary transition-colors"
 aria-label="Fechar"
 >
 <X className="w-6 h-6" />
 </button>
 </div>

 <div className="p-6 overflow-y-auto flex-1">
 {children}
 </div>

 {footer != null && (
 <div className="sticky bottom-0 bg-surface-raised border-t border-border-default px-6 py-4 flex items-center justify-end gap-3 shrink-0">
 {footer}
 </div>
 )}
 </div>
 </ModalPortal>
 );
};
