import React, { useState, useRef } from 'react';
import { Upload, Image, X, Loader2, Search } from 'lucide-react';
import { uploadMediaFile, listMediaFiles } from '../../../media/services/mediaService';
import { normalizeForSearch } from '../../../core/services/serviceUtils';
import type { MediaFile } from '../../../core/types/types';
import { MediaType, MediaCategory } from '../../../core/types/types';

interface ImageSelectorProps {
 value: string;
 onChange: (url: string) => void;
 label: string;
 description?: string;
 accept?: string;
 category?: MediaCategory;
 previewSize?: 'sm' | 'md' | 'lg';
 showPreview?: boolean;
 onError?: (error: string) => void;
}

export const ImageSelector: React.FC<ImageSelectorProps> = ({
 value,
 onChange,
 label,
 description,
 accept = 'image/*',
 category = MediaCategory.SYSTEM,
 previewSize = 'md',
 showPreview = true,
 onError
}) => {
 const [isUploading, setIsUploading] = useState(false);
 const [showGallery, setShowGallery] = useState(false);
 const [galleryFiles, setGalleryFiles] = useState<MediaFile[]>([]);
 const [galleryLoading, setGalleryLoading] = useState(false);
 const [gallerySearch, setGallerySearch] = useState('');
 const fileInputRef = useRef<HTMLInputElement>(null);

 const previewSizes = {
 sm: 'w-16 h-16',
 md: 'w-24 h-24',
 lg: 'w-32 h-32'
 };

 const handleFileSelect = async (file: File) => {
 setIsUploading(true);
 try {
 const mediaFile = await uploadMediaFile(file, category);
 onChange(mediaFile.url);
 } catch (error: any) {
 console.error('Erro ao fazer upload:', error);
 onError?.(error.message || 'Erro ao fazer upload da imagem');
 } finally {
 setIsUploading(false);
 if (fileInputRef.current) {
 fileInputRef.current.value = '';
 }
 }
 };

 const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 handleFileSelect(file);
 }
 };

 const loadGallery = async () => {
 setGalleryLoading(true);
 try {
 const files = await listMediaFiles(category);
 // Filtrar apenas imagens
 const images = files.filter(f => f.type === MediaType.IMAGE || f.type === 'image');
 setGalleryFiles(images);
 } catch (error: any) {
 console.error('Erro ao carregar galeria:', error);
 onError?.(error.message || 'Erro ao carregar galeria');
 } finally {
 setGalleryLoading(false);
 }
 };

 const handleOpenGallery = () => {
 setShowGallery(true);
 if (galleryFiles.length === 0) {
 loadGallery();
 }
 };

 const handleSelectFromGallery = (file: MediaFile) => {
 onChange(file.url);
 setShowGallery(false);
 };

 const filteredGallery = galleryFiles.filter(file =>
 normalizeForSearch(file.name).includes(normalizeForSearch(gallerySearch)) ||
 normalizeForSearch(file.path).includes(normalizeForSearch(gallerySearch))
 );

 return (
 <div className="space-y-2">
 <label className="block text-sm font-medium text-content-secondary">
 {label}
 </label>

 <div className="space-y-3">
 {/* State: No Image - Show Upload Button */}
 {!value && (
 <div className="flex gap-3">
 <input
 type="file"
 ref={fileInputRef}
 onChange={handleFileInputChange}
 accept={accept}
 className="hidden"
 id={`image-upload-${label.replace(/\s+/g, '-')}`}
 />

 <label
 htmlFor={`image-upload-${label.replace(/\s+/g, '-')}`}
 className={`flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed border-border-default rounded-xl cursor-pointer hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-all group ${isUploading ? 'opacity-50 cursor-not-allowed' : ''
 }`}
 >
 <div className="flex flex-col items-center gap-2 p-4">
 {isUploading ? (
 <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
 ) : (
 <Upload className="w-8 h-8 text-content-muted group-hover:text-brand-500 transition-colors" />
 )}
 <span className="text-sm font-medium text-content-muted group-hover:text-brand-600 dark:group-hover:text-brand-400">
 {isUploading ? 'A carregar...' : 'Carregar Imagem'}
 </span>
 <span className="text-xs text-center text-content-muted">
 Clique para selecionar
 </span>
 </div>
 </label>

 <button
 type="button"
 onClick={handleOpenGallery}
 className="w-32 flex flex-col items-center justify-center h-32 border-2 border-dashed border-border-default rounded-xl hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-all group"
 title="Selecionar da galeria"
 >
 <Image className="w-8 h-8 text-content-muted group-hover:text-brand-500 transition-colors mb-2" />
 <span className="text-xs font-medium text-content-muted group-hover:text-brand-600 dark:group-hover:text-brand-400">
 Galeria
 </span>
 </button>
 </div>
 )}

 {/* State: Has Image - Show Preview with Replace Options */}
 {value && (
 <div className="relative group rounded-xl overflow-hidden border border-border-default bg-surface-base/50 p-2">
 <div className="flex items-center gap-4">
 <div className={`flex-shrink-0 ${previewSizes[previewSize]} bg-surface-raised rounded-lg border border-border-default flex items-center justify-center p-1`}>
 <img
 src={value}
 alt={label}
 className="max-w-full max-h-full object-contain rounded"
 onError={(e) => {
 const target = e.target as HTMLImageElement;
 target.style.display = 'none';
 }}
 />
 </div>

 <div className="flex-1 min-w-0 py-2">
 <p className="text-sm font-medium text-content-primary truncate mb-1">
 Imagem carregada
 </p>
 <div className="flex flex-wrap gap-2">
 <input
 type="file"
 ref={fileInputRef}
 onChange={handleFileInputChange}
 accept={accept}
 className="hidden"
 id={`image-replace-${label.replace(/\s+/g, '-')}`}
 />
 <label
 htmlFor={`image-replace-${label.replace(/\s+/g, '-')}`}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised border border-border-default rounded-md text-xs font-medium text-content-secondary hover:bg-surface-base cursor-pointer transition-colors"
 >
 <Upload className="w-3.5 h-3.5" />
 Substituir
 </label>

 <button
 type="button"
 onClick={handleOpenGallery}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised border border-border-default rounded-md text-xs font-medium text-content-secondary hover:bg-surface-base transition-colors"
 >
 <Image className="w-3.5 h-3.5" />
 Galeria
 </button>

 <button
 type="button"
 onClick={() => onChange('')}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors ml-auto"
 >
 <X className="w-3.5 h-3.5" />
 Remover
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Optional URL Input (Hidden by default, toggleable or kept small if needed) 
 For this request we keep it minimal/hidden or just remove it to enforce upload/gallery as primary.
 I will hide it but keep the logic if needed later, or replace the input area completely with the above.
 */}

 {description && (
 <p className="text-xs text-content-muted mt-1">
 {description}
 </p>
 )}
 </div>

 {/* Modal da Galeria */}
 {showGallery && (
 <div
 className="fixed inset-0 min-h-screen min-w-full z-[100] modal-overlay flex items-center justify-center p-4"
 onClick={() => setShowGallery(false)}
 >
 <div
 className="bg-surface-raised rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Cabeçalho */}
 <div className="p-4 border-b border-border-default flex items-center justify-between">
 <h3 className="text-lg font-semibold text-content-primary">
 Selecionar da Galeria
 </h3>
 <button
 onClick={() => setShowGallery(false)}
 className="p-2 hover:bg-surface-base rounded-lg transition-colors"
 >
 <X className="w-5 h-5 text-content-muted" />
 </button>
 </div>

 {/* Busca */}
 <div className="p-4 border-b border-border-default">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-content-muted" />
 <input
 type="text"
 value={gallerySearch}
 onChange={(e) => setGallerySearch(e.target.value)}
 placeholder="Buscar imagens..."
 className="w-full pl-10 pr-4 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-surface-raised text-content-primary"
 />
 </div>
 </div>

 {/* Grid de Imagens */}
 <div className="flex-1 overflow-auto p-4">
 {galleryLoading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
 </div>
 ) : filteredGallery.length === 0 ? (
 <div className="text-center py-12">
 <Image className="w-16 h-16 mx-auto text-content-muted mb-4" />
 <p className="text-content-muted">
 {gallerySearch ? 'Nenhuma imagem encontrada' : 'Nenhuma imagem na galeria'}
 </p>
 </div>
 ) : (
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
 {filteredGallery.map((file) => (
 <button
 key={file.id}
 onClick={() => handleSelectFromGallery(file)}
 className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${value === file.url
 ? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-800'
 : 'border-border-default hover:border-brand-300 dark:hover:border-brand-600'
 }`}
 >
 <img
 src={file.url}
 alt={file.name}
 className="w-full h-full object-cover"
 loading="lazy"
 />
 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
 <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium px-2 py-1 bg-black/50 rounded">
 Selecionar
 </span>
 </div>
 {value === file.url && (
 <div className="absolute top-2 right-2 bg-brand-500 text-white rounded-full p-1">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
 </svg>
 </div>
 )}
 </button>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 );
};



