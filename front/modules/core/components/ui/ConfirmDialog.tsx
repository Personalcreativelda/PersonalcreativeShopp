import React from 'react';
import { ModalPortal } from './ModalPortal';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
 isOpen: boolean;
 title?: string;
 message: string;
 confirmText?: string;
 cancelText?: string;
 onConfirm: () => void;
 onCancel: () => void;
 variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
 isOpen,
 title = 'Confirmar Ação',
 message,
 confirmText = 'Confirmar',
 cancelText = 'Cancelar',
 onConfirm,
 onCancel,
 variant = 'warning'
}) => {
 const variantStyles = {
 danger: {
 button: 'bg-red-600 hover:bg-red-700 text-white',
 icon: 'text-red-600 dark:text-red-400',
 border: 'border-red-200 dark:border-red-800'
 },
 warning: {
 button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
 icon: 'text-yellow-600 dark:text-yellow-400',
 border: 'border-yellow-200 dark:border-yellow-800'
 },
 info: {
 button: 'bg-brand-600 hover:bg-brand-700 text-white',
 icon: 'text-blue-600 dark:text-blue-400',
 border: 'border-blue-200 dark:border-blue-800'
 }
 };

 const styles = variantStyles[variant];

 const dialogContent = (
 <ModalPortal open={isOpen} onClose={onCancel} zIndex={10000}>
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in-up border border-border-default">
 <div className="flex items-start gap-4">
 <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : variant === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
 <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="text-lg font-semibold text-content-primary mb-1.5">
 {title}
 </h3>
 <p className="text-sm text-content-secondary whitespace-pre-line leading-relaxed">
 {message}
 </p>
 </div>
 <button
 onClick={onCancel}
 className="flex-shrink-0 text-content-muted hover:text-content-primary transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
 <button
 onClick={onCancel}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg font-medium text-sm transition-colors"
 >
 {cancelText}
 </button>
 <button
 onClick={onConfirm}
 className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${styles.button}`}
 >
 {confirmText}
 </button>
 </div>
 </div>
 </ModalPortal>
 );

 return dialogContent;
};


