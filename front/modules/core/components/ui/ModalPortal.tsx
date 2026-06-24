/**
 * Overlay global para modais.
 * Renderiza em document.body via Portal para garantir cobertura total do ecrã
 * e evitar problemas de z-index com header/sidebar.
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
 open: boolean;
 onClose: () => void;
 children: React.ReactNode;
 /** z-index do overlay. Default 9999 para ficar acima do header. */
 zIndex?: number;
 /** Fechar ao clicar no overlay. Default true */
 closeOnOverlayClick?: boolean;
 /** Classes adicionais no wrapper (ex: p-4 para padding) */
 className?: string;
}

export const ModalPortal: React.FC<ModalPortalProps> = ({
 open,
 onClose,
 children,
 zIndex = 9999,
 closeOnOverlayClick = true,
 className = 'p-4',
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

 return createPortal(
 <div
 className={`fixed inset-0 flex items-center justify-center overflow-y-auto ${className}`}
 style={{ zIndex }}
 >
 {/* Overlay */}
 <div
 className="fixed inset-0 modal-overlay-bg"
 onClick={closeOnOverlayClick ? onClose : undefined}
 aria-hidden
 />
 {/* Conteúdo — my-auto garante centralização mesmo com overflow */}
 <div className="relative w-full flex justify-center my-auto" onClick={(e) => e.stopPropagation()}>
 {children}
 </div>
 </div>,
 document.body
 );
};
