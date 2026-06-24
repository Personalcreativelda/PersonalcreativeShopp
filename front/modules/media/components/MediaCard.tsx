import React from 'react';
import { FileText, FileImage, Download, Trash2, Eye } from 'lucide-react';
import { formatFileSize, getFileIcon } from '../services/mediaService';
import type { MediaFile } from '../../core/types/types';

interface MediaCardProps {
 file: MediaFile;
 onView?: (file: MediaFile) => void;
 onDownload?: (file: MediaFile) => void;
 onDelete?: (file: MediaFile) => void;
 isSelected?: boolean;
 onSelect?: (file: MediaFile) => void;
 showActions?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
 file,
 onView,
 onDownload,
 onDelete,
 isSelected = false,
 onSelect,
 showActions = true
}) => {
 const handleDownload = (e: React.MouseEvent) => {
 e.stopPropagation();
 if (onDownload) {
 onDownload(file);
 } else {
 // Download padréo
 const link = document.createElement('a');
 link.href = file.url;
 link.download = file.name;
 link.target = '_blank';
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 }
 };

 const handleDelete = (e: React.MouseEvent) => {
 e.stopPropagation();
 if (onDelete && window.confirm(`Tem certeza que deseja deletar "${file.name}"?`)) {
 onDelete(file);
 }
 };

 const handleView = (e: React.MouseEvent) => {
 e.stopPropagation();
 if (onView) {
 onView(file);
 }
 };

 const handleCardClick = () => {
 if (onSelect) {
 onSelect(file);
 } else if (onView) {
 onView(file);
 }
 };

 const isImage = file.type === 'image';

 return (
 <div
 className={`
 relative group border rounded-lg overflow-hidden transition-all
 ${isSelected
 ? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-800'
 : 'border-border-default hover:border-border-default dark:hover:border-gray-600'
 }
 ${onSelect || onView ? 'cursor-pointer' : ''}
 bg-surface-raised
 `}
 onClick={handleCardClick}
 >
 {/* Checkbox de seleçéo */}
 {onSelect && (
 <div className="absolute top-2 left-2 z-10">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => onSelect(file)}
 onClick={(e) => e.stopPropagation()}
 className="w-5 h-5 rounded border-border-default text-brand-600 focus:ring-brand-500"
 />
 </div>
 )}

 {/* Preview/Thumbnail */}
 <div className="aspect-square bg-surface-base relative overflow-hidden">
 {isImage ? (
 <img
 src={file.url}
 alt={file.name}
 className="w-full h-full object-cover"
 loading="lazy"
 onError={(e) => {
 // Fallback para é­cone se imagem néo carregar
 const target = e.target as HTMLImageElement;
 target.style.display = 'none';
 const parent = target.parentElement;
 if (parent) {
 parent.innerHTML = `
 <div class="w-full h-full flex items-center justify-center">
 <svg class="w-12 h-12 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 </div>
 `;
 }
 }}
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <FileText className="w-12 h-12 text-content-muted" />
 </div>
 )}

 {/* Overlay com açéµes */}
 {showActions && (
 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
 {onView && (
 <button
 onClick={handleView}
 className="p-2 bg-surface-raised/90 hover:bg-surface-raised rounded-lg transition-colors"
 title="Visualizar"
 >
 <Eye className="w-5 h-5 text-content-secondary" />
 </button>
 )}
 <button
 onClick={handleDownload}
 className="p-2 bg-surface-raised/90 hover:bg-surface-raised rounded-lg transition-colors"
 title="Download"
 >
 <Download className="w-5 h-5 text-content-secondary" />
 </button>
 {onDelete && (
 <button
 onClick={handleDelete}
 className="p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors"
 title="Deletar"
 >
 <Trash2 className="w-5 h-5" />
 </button>
 )}
 </div>
 )}
 </div>

 {/* Informações do arquivo */}
 <div className="p-3">
 <p
 className="text-sm font-medium text-content-primary truncate"
 title={file.name}
 >
 {file.name}
 </p>
 <div className="flex items-center justify-between mt-1">
 <span className="text-xs text-content-muted">
 {formatFileSize(file.size)}
 </span>
 <span className="text-xs px-2 py-0.5 rounded bg-surface-base text-content-secondary">
 {file.type === 'image' ? 'Imagem' : file.type === 'document' ? 'Documento' : 'Outro'}
 </span>
 </div>
 </div>
 </div>
 );
};



