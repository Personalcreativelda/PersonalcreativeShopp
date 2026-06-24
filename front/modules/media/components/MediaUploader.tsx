import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileImage, FileText, Loader2 } from 'lucide-react';
import { validateMediaFile, formatFileSize, getMediaType } from '../services/mediaService';
import type { MediaCategory } from '../../core/types/types';

interface MediaUploaderProps {
 onUpload: (files: File[]) => Promise<void>;
 category?: MediaCategory;
 multiple?: boolean;
 accept?: string;
 maxFiles?: number;
 className?: string;
}

interface FileWithPreview extends File {
 preview?: string;
 id: string;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
 onUpload,
 category = 'media-library',
 multiple = true,
 accept,
 maxFiles = 10,
 className = ''
}) => {
 const [files, setFiles] = useState<FileWithPreview[]>([]);
 const [isDragging, setIsDragging] = useState(false);
 const [isUploading, setIsUploading] = useState(false);
 const [errors, setErrors] = useState<{ file: File; error: string }[]>([]);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
 if (!selectedFiles || selectedFiles.length === 0) return;

 const fileArray = Array.from(selectedFiles);
 const newFiles: FileWithPreview[] = [];
 const newErrors: { file: File; error: string }[] = [];

 // Validar néºmero mé¡ximo de arquivos
 const totalFiles = files.length + fileArray.length;
 if (totalFiles > maxFiles) {
 newErrors.push({
 file: fileArray[0],
 error: `Mé¡ximo de ${maxFiles} arquivos permitidos.`
 });
 setErrors(prev => [...prev, ...newErrors]);
 return;
 }

 fileArray.forEach((file) => {
 const validation = validateMediaFile(file);
 if (!validation.valid) {
 newErrors.push({ file, error: validation.error || 'Arquivo invé¡lido' });
 return;
 }

 const fileWithPreview: FileWithPreview = Object.assign(file, {
 id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
 preview: getMediaType(file) === 'image' ? URL.createObjectURL(file) : undefined
 });

 newFiles.push(fileWithPreview);
 });

 if (newErrors.length > 0) {
 setErrors(prev => [...prev, ...newErrors]);
 }

 if (newFiles.length > 0) {
 setFiles(prev => [...prev, ...newFiles]);
 }
 }, [files.length, maxFiles]);

 const handleDragOver = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setIsDragging(true);
 }, []);

 const handleDragLeave = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setIsDragging(false);
 }, []);

 const handleDrop = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setIsDragging(false);
 handleFileSelect(e.dataTransfer.files);
 }, [handleFileSelect]);

 const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 handleFileSelect(e.target.files);
 // Reset input para permitir selecionar o mesmo arquivo novamente
 if (fileInputRef.current) {
 fileInputRef.current.value = '';
 }
 }, [handleFileSelect]);

 const removeFile = useCallback((fileId: string) => {
 setFiles(prev => {
 const file = prev.find(f => f.id === fileId);
 if (file?.preview) {
 URL.revokeObjectURL(file.preview);
 }
 return prev.filter(f => f.id !== fileId);
 });
 setErrors(prev => prev.filter(e => e.file.name !== fileId));
 }, []);

 const handleUpload = useCallback(async () => {
 if (files.length === 0) return;

 setIsUploading(true);
 setErrors([]);

 try {
 await onUpload(files);
 // Limpar arquivos apé³s upload bem-sucedido
 files.forEach(file => {
 if (file.preview) {
 URL.revokeObjectURL(file.preview);
 }
 });
 setFiles([]);
 } catch (error: any) {
 console.error('Erro ao fazer upload:', error);
 setErrors(prev => [...prev, { file: files[0], error: error.message || 'Erro ao fazer upload' }]);
 } finally {
 setIsUploading(false);
 }
 }, [files, onUpload]);

 const clearAll = useCallback(() => {
 files.forEach(file => {
 if (file.preview) {
 URL.revokeObjectURL(file.preview);
 }
 });
 setFiles([]);
 setErrors([]);
 }, [files]);

 return (
 <div className={`space-y-4 ${className}`}>
 {/* érea de drag & drop */}
 <div
 onDragOver={handleDragOver}
 onDragLeave={handleDragLeave}
 onDrop={handleDrop}
 className={`
 border-2 border-dashed rounded-lg p-8 text-center transition-colors
 ${isDragging
 ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20'
 : 'border-border-default hover:border-gray-400 dark:hover:border-gray-500'
 }
 ${files.length > 0 ? 'bg-surface-base/50' : ''}
 `}
 >
 <input
 ref={fileInputRef}
 type="file"
 multiple={multiple}
 accept={accept}
 onChange={handleFileInputChange}
 className="hidden"
 />

 <div className="flex flex-col items-center gap-4">
 <div className={`p-4 rounded-full ${isDragging ? 'bg-brand-100 dark:bg-brand-900/30' : 'bg-surface-base'}`}>
 <Upload className={`w-8 h-8 ${isDragging ? 'text-brand-600 dark:text-brand-400' : 'text-content-muted'}`} />
 </div>

 <div>
 <p className="text-sm font-medium text-content-secondary">
 Arraste arquivos aqui ou{' '}
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
 >
 clique para selecionar
 </button>
 </p>
 <p className="text-xs text-content-muted mt-1">
 Imagens (JPEG, PNG, WEBP, GIF, SVG, ICO) até© 5MB ou Documentos (PDF, Word, Excel, PowerPoint, TXT, RTF) até© 10MB
 </p>
 </div>
 </div>
 </div>

 {/* Lista de arquivos selecionados */}
 {files.length > 0 && (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <p className="text-sm font-medium text-content-secondary">
 {files.length} arquivo{files.length !== 1 ? 's' : ''} selecionado{files.length !== 1 ? 's' : ''}
 </p>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={clearAll}
 className="text-xs text-content-muted hover:text-content-secondary "
 >
 Limpar tudo
 </button>
 <button
 type="button"
 onClick={handleUpload}
 disabled={isUploading}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
 >
 {isUploading ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Enviando...
 </>
 ) : (
 <>
 <Upload className="w-4 h-4" />
 Enviar {files.length} arquivo{files.length !== 1 ? 's' : ''}
 </>
 )}
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {files.map((file) => (
 <div
 key={file.id}
 className="relative border border-border-default rounded-lg p-3 bg-surface-raised"
 >
 <button
 type="button"
 onClick={() => removeFile(file.id)}
 className="absolute top-2 right-2 p-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
 >
 <X className="w-4 h-4" />
 </button>

 {file.preview ? (
 <img
 src={file.preview}
 alt={file.name}
 className="w-full h-32 object-cover rounded mb-2"
 />
 ) : (
 <div className="w-full h-32 bg-surface-base rounded mb-2 flex items-center justify-center">
 {getMediaType(file) === 'document' ? (
 <FileText className="w-8 h-8 text-content-muted" />
 ) : (
 <FileImage className="w-8 h-8 text-content-muted" />
 )}
 </div>
 )}

 <p className="text-xs font-medium text-content-primary truncate" title={file.name}>
 {file.name}
 </p>
 <p className="text-xs text-content-muted">
 {formatFileSize(file.size)}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Mensagens de erro */}
 {errors.length > 0 && (
 <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
 <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
 Erros de validaçéo:
 </p>
 <ul className="list-disc list-inside space-y-1 text-xs text-red-700 dark:text-red-300">
 {errors.map((error, index) => (
 <li key={index}>
 <span className="font-medium">{error.file.name}:</span> {error.error}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 );
};



