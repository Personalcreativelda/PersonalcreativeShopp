import React, { useState, useEffect } from 'react';
import { Product } from '../../../core/types/types';
import { Modal } from '../shared/Modal';
import { Upload, X, ImageOff, Loader2, Camera, ScanLine } from 'lucide-react';
import { BarcodeScanner } from '../../../sales/components/BarcodeScanner';

// Comprime imagens > 2 MB ou > 1920 px antes de enviar (fotos de câmera chegam a 8–12 MB)
async function compressImage(file: File, maxSizeMB = 2, maxDim = 1920): Promise<File> {
 return new Promise((resolve) => {
 if (file.size <= maxSizeMB * 1024 * 1024) { resolve(file); return; }
 const img = new Image();
 const url = URL.createObjectURL(file);
 img.onload = () => {
 URL.revokeObjectURL(url);
 const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
 const canvas = document.createElement('canvas');
 canvas.width = Math.round(img.width * scale);
 canvas.height = Math.round(img.height * scale);
 canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
 canvas.toBlob(
 (blob) => resolve(blob
 ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
 : file),
 'image/jpeg', 0.85
 );
 };
 img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
 img.src = url;
 });
}
import uploadService from '../../../../services/uploadService';

export interface ProductCategoryOption {
 id: string;
 name: string;
}

export interface ProductUnitOption {
 id: string;
 name: string;
 abbreviation: string;
}

export interface ProductFormData {
 name: string;
 category: string;
 price: number;
 costPrice: number;
 minStock: number;
 stock: number;
 unit: string;
 image: string;
 image2: string;
 image3: string;
 image4: string;
 showInShop: boolean;
 description: string;
 descriptionLong: string;
 benefits: string;
 howToUse: string;
 ingredients: string;
 promotionalPrice: number | null;
 promotionalPriceStart: string | null;
 promotionalPriceEnd: string | null;
 barcode: string;
 vatRegime: 'standard' | 'exempt';
}

interface ProductFormModalProps {
 open: boolean;
 onClose: () => void;
 product: Product | null;
 categories: ProductCategoryOption[];
 units: ProductUnitOption[];
 onSave: (data: ProductFormData) => void;
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
 uploadProductImage: (file: File, productId?: string) => Promise<string | null>;
 deleteProductImage: (imageUrl: string) => Promise<void | boolean>;
 validateImageFile: (file: File) => { valid: boolean; error?: string };
}

const defaultFormData: ProductFormData = {
 name: '',
 category: '',
 price: 0,
 costPrice: 0,
 minStock: 5,
 stock: 0,
 unit: '',
 image: '',
 image2: '',
 image3: '',
 image4: '',
 showInShop: true,
 description: '',
 descriptionLong: '',
 benefits: '',
 howToUse: '',
 ingredients: '',
 promotionalPrice: null,
 promotionalPriceStart: null,
 promotionalPriceEnd: null,
 barcode: '',
 vatRegime: 'standard',
};

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
 open,
 onClose,
 product,
 categories,
 units,
 onSave,
 showToast,
 uploadProductImage,
 deleteProductImage,
 validateImageFile,
}) => {
 const [formData, setFormData] = useState<ProductFormData>(defaultFormData);
 const [uploadingImage, setUploadingImage] = useState<Record<string, boolean>>({});
 const [imageLoadError, setImageLoadError] = useState<Record<string, boolean>>({});
 const [showScanner, setShowScanner] = useState(false);
 const initializedRef = React.useRef<string | null>(null); // guarda o "id" da abertura actual

 useEffect(() => {
 // Cria uma chave única para esta abertura: id do produto ou 'new'
 const openKey = open ? (product?.id ?? 'new') : null;

 // Só reseta o formulário quando o modal abre ou muda de produto
 if (!open || openKey === initializedRef.current) return;

 initializedRef.current = openKey;
 setImageLoadError({});

 if (product) {
 setFormData({
 name: product.name || '',
 category: product.category || '',
 price: product.price ?? 0,
 costPrice: product.costPrice ?? 0,
 minStock: product.minStock ?? 5,
 stock: product.stock ?? 0,
 unit: product.unit || '',
 image: product.image || '',
 image2: product.image2 || '',
 image3: product.image3 || '',
 image4: product.image4 || '',
 showInShop: product.showInShop !== false,
 description: (product as any).description || '',
 descriptionLong: (product as any).descriptionLong || '',
 benefits: (product as any).benefits || '',
 howToUse: (product as any).howToUse || '',
 ingredients: (product as any).ingredients || '',
 promotionalPrice: (product as any).promotionalPrice ?? null,
 promotionalPriceStart: (product as any).promotionalPriceStart ?? null,
 promotionalPriceEnd: (product as any).promotionalPriceEnd ?? null,
 barcode: (product as any).barcode || '',
 vatRegime: (product as any).vatRegime || 'standard',
 });
 } else {
 const defaultCategory = categories.length > 0 ? categories[0].name : '';
 const defaultUnit = units.length > 0 ? units[0].abbreviation : 'un';
 setFormData({
 ...defaultFormData,
 category: defaultCategory,
 unit: defaultUnit,
 });
 }
 }, [open, product, categories, units]);

 // Quando o modal fecha, limpa a chave para que na próxima abertura reinicialize
 useEffect(() => {
 if (!open) {
 initializedRef.current = null;
 }
 }, [open]);

 const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, imageKey: keyof ProductFormData) => {
 const raw = event.target.files?.[0];
 if (!raw) return;

 // Validar tipo (antes de comprimir)
 const validation = validateImageFile(raw);
 if (!validation.valid) {
 showToast(validation.error || 'Erro ao validar imagem', 'error');
 event.target.value = '';
 return;
 }

 // Comprimir se necessário (fotos de câmera chegam a 8–12 MB)
 const file = await compressImage(raw);
 if (file.size > 5 * 1024 * 1024) {
 showToast('Imagem demasiado grande mesmo após compressão. Máximo 5 MB.', 'error');
 event.target.value = '';
 return;
 }

 // Preview instantâneo enquanto o upload acontece em background
 const previewUrl = URL.createObjectURL(file);
 setFormData((prev) => ({ ...prev, [imageKey]: previewUrl }));
 setUploadingImage(prev => ({ ...prev, [imageKey]: true }));
 setImageLoadError(prev => ({ ...prev, [imageKey]: false }));

 try {
 const productId = product?.id;
 const imageUrl = await uploadProductImage(file, productId);
 URL.revokeObjectURL(previewUrl);

 if (imageUrl) {
 setFormData((prev) => ({ ...prev, [imageKey]: imageUrl }));
 showToast('Imagem carregada com sucesso', 'success');
 } else {
 setFormData((prev) => ({ ...prev, [imageKey]: '' }));
 showToast('Erro ao fazer upload da imagem', 'error');
 }
 } catch (error: any) {
 URL.revokeObjectURL(previewUrl);
 setFormData((prev) => ({ ...prev, [imageKey]: '' }));
 showToast(error.message || 'Erro ao fazer upload da imagem', 'error');
 } finally {
 setUploadingImage(prev => ({ ...prev, [imageKey]: false }));
 event.target.value = '';
 }
 };

 const handleRemoveImage = async (imageKey: keyof ProductFormData) => {
 const imageUrl = formData[imageKey] as string;
 if (!imageUrl) return;

 if (imageUrl.includes('supabase.co/storage')) {
 try {
 await deleteProductImage(imageUrl);
 } catch (error) {
 console.error('Erro ao remover imagem do storage:', error);
 }
 }

 setFormData((prev) => ({ ...prev, [imageKey]: '' }));
 setImageLoadError(prev => ({ ...prev, [imageKey]: false }));
 showToast('Imagem removida', 'success');
 };

 const handleImageLoadError = (imageKey: keyof ProductFormData) => {
 setImageLoadError(prev => ({ ...prev, [imageKey]: true }));
 };

 const handleSubmit = () => {
 if (!formData.name?.trim()) {
 showToast('Nome do produto é obrigatório', 'error');
 return;
 }
 onSave(formData);
 };

 const defaultCategory = categories.length > 0 ? categories[0].name : '';
 const defaultUnit = units.length > 0 ? units[0].abbreviation : 'un';

 const renderImageUploader = (imageKey: keyof ProductFormData, label: string) => {
 const isUploading = uploadingImage[imageKey];
 const hasError = imageLoadError[imageKey];
 const imageUrl = formData[imageKey] as string;

 return (
 <div className="flex flex-col items-center">
 <label className="block text-xs font-medium text-content-secondary mb-1 w-full text-center">
 {label}
 </label>
 {imageUrl ? (
 <div className="relative inline-block">
 {hasError ? (
 <div className="w-24 h-24 bg-surface-base rounded-lg border-2 border-dashed border-border-default flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 transition-colors">
 <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
 <input
 type="file"
 accept="image/*"
 onChange={(e) => handleImageUpload(e, imageKey)}
 className="hidden"
 disabled={isUploading}
 />
 <ImageOff className="w-6 h-6 text-content-muted mb-1" />
 <p className="text-[10px] text-content-muted">Inválida</p>
 </label>
 </div>
 ) : (
 <img
 src={uploadService.getPublicUrl(imageUrl)}
 alt="Preview"
 onError={() => handleImageLoadError(imageKey)}
 className="w-24 h-24 object-cover rounded-lg border-2 border-border-default"
 />
 )}
 <button
 type="button"
 onClick={() => handleRemoveImage(imageKey)}
 className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-lg transition-colors"
 title="Remover imagem"
 >
 <X className="w-3 h-3" />
 </button>
 {!hasError && (
 <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
 {/* Galeria */}
 <label className="bg-brand-600 hover:bg-brand-700 text-white rounded-full p-1 cursor-pointer shadow-lg transition-colors" title="Trocar — Galeria">
 <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, imageKey)} className="hidden" disabled={isUploading} />
 <Upload className="w-3 h-3" />
 </label>
 {/* Câmera */}
 <label className="bg-green-600 hover:bg-green-700 text-white rounded-full p-1 cursor-pointer shadow-lg transition-colors" title="Trocar — Câmera">
 <input type="file" accept="image/*" capture="environment" onChange={(e) => handleImageUpload(e, imageKey)} className="hidden" disabled={isUploading} />
 <Camera className="w-3 h-3" />
 </label>
 </div>
 )}
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-border-default rounded-lg">
 {isUploading ? (
 <div className="flex flex-col items-center">
 <Loader2 className="w-5 h-5 text-brand-600 animate-spin mb-1" />
 <p className="text-[10px] text-content-muted">Enviando...</p>
 </div>
 ) : (
 <div className="flex gap-2">
 {/* Galeria */}
 <label className="flex flex-col items-center cursor-pointer group" title="Galeria de fotos">
 <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, imageKey)} className="hidden" disabled={isUploading} />
 <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-base group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 transition-colors">
 <Upload className="w-4 h-4 text-content-muted group-hover:text-brand-600 transition-colors" />
 </div>
 <p className="text-[9px] text-content-muted mt-0.5">Galeria</p>
 </label>
 {/* Câmera */}
 <label className="flex flex-col items-center cursor-pointer group" title="Tirar foto">
 <input type="file" accept="image/*" capture="environment" onChange={(e) => handleImageUpload(e, imageKey)} className="hidden" disabled={isUploading} />
 <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-base group-hover:bg-green-50 dark:group-hover:bg-green-900/30 transition-colors">
 <Camera className="w-4 h-4 text-content-muted group-hover:text-green-600 transition-colors" />
 </div>
 <p className="text-[9px] text-content-muted mt-0.5">Câmera</p>
 </label>
 </div>
 )}
 </div>
 )}
 </div>
 );
 };

 return (
 <>
 {showScanner && (
 <BarcodeScanner
 onScan={(code) => {
 setFormData((prev) => ({ ...prev, barcode: code }));
 setShowScanner(false);
 showToast(`Código lido: ${code}`, 'success');
 }}
 onClose={() => setShowScanner(false)}
 />
 )}
 <Modal
 open={open}
 onClose={onClose}
 title={product ? 'Editar Produto' : 'Novo Produto'}
 maxWidth="4xl"
 footer={
 <>
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg font-medium text-sm transition-colors"
 >
 Cancelar
 </button>
 <button
 type="button"
 onClick={handleSubmit}
 disabled={!formData.name?.trim()}
 className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {product ? 'Salvar Alterações' : 'Criar Produto'}
 </button>
 </>
 }
 >
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-content-primary">Informações do Produto</h3>

 <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 md:gap-8 items-start">
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Nome do Produto *</label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 placeholder="Ex: Amendoim Pilado"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Código de Barras / QR
 </label>
 <div className="flex gap-1.5">
 <input
 type="text"
 value={formData.barcode}
 onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
 className="flex-1 min-w-0 px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 font-mono"
 placeholder="EAN-13 / QR"
 />
 <button
 type="button"
 onClick={() => setShowScanner(true)}
 title="Fazer scan de QR ou código de barras"
 className="flex-shrink-0 px-2.5 py-2 border border-border-default rounded-lg bg-surface-raised text-content-muted hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-400 transition-colors"
 >
 <ScanLine className="w-4 h-4" />
 </button>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Regime IVA
 </label>
 <select
 value={formData.vatRegime}
 onChange={(e) => setFormData((prev) => ({ ...prev, vatRegime: e.target.value as 'standard' | 'exempt' }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 >
 <option value="standard">IVA 16% (incluído)</option>
 <option value="exempt">Isento de IVA</option>
 </select>
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Categoria</label>
 <select
 value={formData.category || defaultCategory}
 onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 >
 {categories.map((cat) => (
 <option key={cat.id} value={cat.name}>
 {cat.name}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Unidade</label>
 <select
 value={formData.unit || defaultUnit}
 onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 >
 {units.map((unit) => (
 <option key={unit.id} value={unit.abbreviation}>
 {unit.abbreviation} - {unit.name}
 </option>
 ))}
 </select>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Preço de Custo</label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={formData.costPrice}
 onChange={(e) => setFormData((prev) => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
 className="input-number-simple w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 placeholder="0.00"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Preço de Venda</label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={formData.price}
 onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
 className="input-number-simple w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 placeholder="0.00"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Preço Promocional <span className="text-content-muted font-normal">(opcional — deixa vazio para desativar)</span>
 </label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={formData.promotionalPrice ?? ''}
 onChange={(e) => {
 const v = parseFloat(e.target.value);
 setFormData((prev) => ({ ...prev, promotionalPrice: isNaN(v) || v <= 0 ? null : v }));
 }}
 className="input-number-simple w-full px-3 py-2 border border-orange-300 dark:border-orange-600/50 rounded-lg bg-orange-50 dark:bg-orange-900/10 text-content-primary focus:ring-2 focus:ring-orange-400 placeholder-gray-400"
 placeholder="Ex: 450.00"
 />
 {formData.promotionalPrice && formData.price > 0 && formData.promotionalPrice < formData.price && (
 <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
 Desconto de {Math.round((1 - formData.promotionalPrice / formData.price) * 100)}% aplicado
 </p>
 )}
 </div>

 {/* Validade da promoção — só aparece quando há preço promocional */}
 {formData.promotionalPrice && formData.promotionalPrice > 0 && (
 <div className="flex gap-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-600/30">
 <div className="flex-1">
 <label className="block text-xs font-medium text-orange-700 dark:text-orange-400 mb-1">
 Início da promoção
 </label>
 <input
 type="date"
 value={formData.promotionalPriceStart ?? ''}
 onChange={(e) => setFormData((prev) => ({ ...prev, promotionalPriceStart: e.target.value || null }))}
 className="w-full px-3 py-2 text-sm border border-orange-300 dark:border-orange-600/50 rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-orange-400"
 />
 <p className="text-[10px] text-orange-500 mt-0.5">Vazio = começa já</p>
 </div>
 <div className="flex-1">
 <label className="block text-xs font-medium text-orange-700 dark:text-orange-400 mb-1">
 Fim da promoção
 </label>
 <input
 type="date"
 value={formData.promotionalPriceEnd ?? ''}
 onChange={(e) => setFormData((prev) => ({ ...prev, promotionalPriceEnd: e.target.value || null }))}
 min={formData.promotionalPriceStart ?? undefined}
 className="w-full px-3 py-2 text-sm border border-orange-300 dark:border-orange-600/50 rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-orange-400"
 />
 <p className="text-[10px] text-orange-500 mt-0.5">Vazio = sem expiração</p>
 </div>
 </div>
 )}

 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="showInShop"
 checked={formData.showInShop}
 onChange={(e) => setFormData((prev) => ({ ...prev, showInShop: e.target.checked }))}
 className="w-4 h-4 text-brand-600 border-border-default rounded focus:ring-brand-500"
 />
 <label htmlFor="showInShop" className="text-sm font-medium text-content-secondary">
 Mostrar na Loja Online
 </label>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Stock Atual</label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={formData.stock}
 onChange={(e) => setFormData((prev) => ({ ...prev, stock: parseFloat(e.target.value) || 0 }))}
 className="input-number-simple w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 placeholder="Ex: 20"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Stock Mínimo</label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={formData.minStock}
 onChange={(e) => setFormData((prev) => ({ ...prev, minStock: parseFloat(e.target.value) || 0 }))}
 className="input-number-simple w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 placeholder="Ex: 5"
 />
 </div>
 </div>
 </div>

 <div className="flex flex-col items-center bg-surface-base p-4 rounded-xl border border-border-default">
 <h4 className="text-sm font-medium text-content-secondary mb-4 w-full text-center">
 Imagens do Produto (Até 4)
 </h4>
 <div className="grid grid-cols-2 gap-4">
 {renderImageUploader('image', 'Principal')}
 {renderImageUploader('image2', 'Imagem 2')}
 {renderImageUploader('image3', 'Imagem 3')}
 {renderImageUploader('image4', 'Imagem 4')}
 </div>
 </div>
 </div>

 {/* Conteúdo informativo do produto */}
 <div className="border-t border-border-default pt-5 space-y-4">
 <h3 className="text-base font-semibold text-content-primary">Conteúdo da Página do Produto</h3>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Descrição Curta</label>
 <textarea
 rows={2}
 value={formData.description}
 onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 resize-none"
 placeholder="Breve descrição que aparece junto ao preço..."
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Descrição Completa</label>
 <textarea
 rows={4}
 value={formData.descriptionLong}
 onChange={(e) => setFormData((prev) => ({ ...prev, descriptionLong: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 resize-none"
 placeholder="Descrição detalhada do produto (aparece no separador Descrição Completa)..."
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Benefícios</label>
 <textarea
 rows={4}
 value={formData.benefits}
 onChange={(e) => setFormData((prev) => ({ ...prev, benefits: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 resize-none"
 placeholder="Liste os benefícios, um por linha (aparece no separador Benefícios)..."
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Como Usar</label>
 <textarea
 rows={4}
 value={formData.howToUse}
 onChange={(e) => setFormData((prev) => ({ ...prev, howToUse: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 resize-none"
 placeholder="Instruções de uso, um passo por linha (aparece no separador Como Usar)..."
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Ingredientes</label>
 <textarea
 rows={3}
 value={formData.ingredients}
 onChange={(e) => setFormData((prev) => ({ ...prev, ingredients: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 resize-none"
 placeholder="Lista de ingredientes (aparece no separador Ingredientes)..."
 />
 </div>
 </div>
 </div>
 </Modal>
 </>
 );
};
