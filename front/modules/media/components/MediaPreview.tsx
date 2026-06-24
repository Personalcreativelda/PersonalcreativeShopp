import React, { useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { formatFileSize } from '../services/mediaService';
import type { MediaFile } from '../../core/types/types';

interface MediaPreviewProps {
 file: MediaFile | null;
 isOpen: boolean;
 onClose: () => void;
 onDownload?: (file: MediaFile) => void;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
 file,
 isOpen,
 onClose,
 onDownload
}) => {
 useEffect(() => {
 if (isOpen) {
 document.body.style.overflow = 'hidden';
 } else {
 document.body.style.overflow = '';
 }

 return () => {
 document.body.style.overflow = '';
 };
 }, [isOpen]);

 useEffect(() => {
 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
 onClose();
 }
 };

 if (isOpen) {
 window.addEventListener('keydown', handleEscape);
 }

 return () => {
 window.removeEventListener('keydown', handleEscape);
 };
 }, [isOpen, onClose]);

 if (!isOpen || !file) return null;

 const isImage = file.type === 'image';
 const isPDF = file.mimeType === 'application/pdf';

 const handleDownload = () => {
 if (onDownload) {
 onDownload(file);
 } else {
 const link = document.createElement('a');
 link.href = file.url;
 link.download = file.name;
 link.target = '_blank';
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 }
 };

 const handleOpenInNewTab = () => {
 window.open(file.url, '_blank');
 };

 return (
 <div
 className="fixed inset-0 min-h-screen min-w-full z-[100] modal-overlay flex items-center justify-center p-4"
 onClick={onClose}
 >
 <div
 className="relative bg-surface-raised rounded-lg max-w-7xl w-full max-h-[90vh] flex flex-col"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Cabeçalho */}
 <div className="flex items-center justify-between p-4 border-b border-border-default">
 <div className="flex-1 min-w-0">
 <h3 className="text-lg font-semibold text-content-primary truncate">
 {file.name}
 </h3>
 <div className="flex items-center gap-4 mt-1">
 <span className="text-sm text-content-muted">
 {formatFileSize(file.size)}
 </span>
 <span className="text-sm text-content-muted">
 {file.type === 'image' ? 'Imagem' : file.type === 'document' ? 'Documento' : 'Arquivo'}
 </span>
 <span className="text-sm text-content-muted">
 {new Date(file.createdAt).toLocaleDateString('pt-PT')}
 </span>
 </div>
 </div>

 <div className="flex items-center gap-2 ml-4">
 <button
 onClick={handleDownload}
 className="p-2 hover:bg-surface-base rounded-lg transition-colors"
 title="Download"
 >
 <Download className="w-5 h-5 text-content-secondary" />
 </button>
 <button
 onClick={handleOpenInNewTab}
 className="p-2 hover:bg-surface-base rounded-lg transition-colors"
 title="Abrir em nova aba"
 >
 <ExternalLink className="w-5 h-5 text-content-secondary" />
 </button>
 <button
 onClick={onClose}
 className="p-2 hover:bg-surface-base rounded-lg transition-colors"
 title="Fechar"
 >
 <X className="w-5 h-5 text-content-secondary" />
 </button>
 </div>
 </div>

 {/* Conteéºdo */}
 <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-surface-base">
 {isImage ? (
 <img
 src={file.url}
 alt={file.name}
 className="max-w-full max-h-full object-contain rounded-lg"
 />
 ) : isPDF ? (
 <iframe
 src={file.url}
 className="w-full h-full min-h-[600px] rounded-lg border border-border-default"
 title={file.name}
 />
 ) : (
 <div className="text-center py-12">
 <p className="text-content-muted mb-4">
 Preview néo disponé­vel para este tipo de arquivo
 </p>
 <div className="flex gap-2 justify-center">
 <button
 onClick={handleDownload}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2"
 >
 <Download className="w-4 h-4" />
 Download
 </button>
 <button
 onClick={handleOpenInNewTab}
 className="px-4 py-2 bg-surface-base hover:bg-surface-base text-content-secondary rounded-lg flex items-center gap-2"
 >
 <ExternalLink className="w-4 h-4" />
 Abrir em nova aba
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};



