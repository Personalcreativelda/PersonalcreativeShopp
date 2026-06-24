import React, { useState, useEffect, useCallback } from 'react';
import { Product, ProductVariant } from '../../../core/types/types';
import { Modal } from '../shared/Modal';
import { Plus, Upload, X } from 'lucide-react';
import { productService } from '../../services/productService';
import type { ProductUnitOption } from './ProductFormModal';

const defaultForm = {
 name: '',
 costPrice: 0,
 price: 0,
 unit: '',
 isDefault: false,
};

interface AddVariantModalProps {
 open: boolean;
 onClose: () => void;
 product: Product | null;
 variant: ProductVariant | null;
 units: ProductUnitOption[];
 onSuccess: () => void | Promise<void>;
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
 uploadVariantImage: (file: File, productId: string, variantId: string) => Promise<string | null>;
 validateImageFile: (file: File) => { valid: boolean; error?: string };
}

export const AddVariantModal: React.FC<AddVariantModalProps> = ({
 open,
 onClose,
 product,
 variant,
 units,
 onSuccess,
 showToast,
 uploadVariantImage,
 validateImageFile,
}) => {
 const [form, setForm] = useState(defaultForm);
 const [imageFile, setImageFile] = useState<File | null>(null);
 const [imagePreview, setImagePreview] = useState<string | null>(null);
 const [uploading, setUploading] = useState(false);
 const [saving, setSaving] = useState(false);

 const checkDuplicateName = useCallback(
 (name: string, excludeVariantId?: string | null): boolean => {
 if (!product?.variants) return false;
 const normalized = name.trim().toLowerCase();
 return product.variants.some(
 (v) => v.id !== excludeVariantId && v.name.trim().toLowerCase() === normalized
 );
 },
 [product]
 );

 useEffect(() => {
 if (!open) return;
 if (variant) {
 setForm({
 name: variant.name,
 costPrice: variant.costPrice ?? 0,
 price: variant.price,
 unit: variant.unit,
 isDefault: variant.isDefault ?? false,
 });
 setImagePreview(variant.image || null);
 setImageFile(null);
 } else {
 const defaultUnit = product?.unit || (units.length > 0 ? units[0].abbreviation : 'un');
 setForm({ ...defaultForm, unit: defaultUnit });
 setImagePreview(null);
 setImageFile(null);
 }
 }, [open, variant, product, units]);

 const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 const validation = validateImageFile(file);
 if (!validation.valid) {
 showToast(validation.error || 'Erro ao validar imagem', 'error');
 return;
 }
 const reader = new FileReader();
 reader.onloadend = () => setImagePreview(reader.result as string);
 reader.readAsDataURL(file);
 setImageFile(file);
 if (e.target) e.target.value = '';
 };

 const handleSubmit = async () => {
 if (!product) return;
 const trimmedName = form.name.trim();
 if (!trimmedName) {
 showToast('Nome da variação é obrigatório', 'error');
 return;
 }
 if (form.price <= 0) {
 showToast('Preço de venda deve ser maior que zero', 'error');
 return;
 }
 if (checkDuplicateName(trimmedName, variant?.id ?? null)) {
 showToast('Já existe uma variação com este nome para este produto.', 'error');
 return;
 }

 const defaultUnit = product.unit || (units.length > 0 ? units[0].abbreviation : 'un');
 const payload = {
 name: trimmedName,
 price: form.price,
 costPrice: form.costPrice ?? 0,
 stock: variant?.stock ?? 0,
 minStock: variant?.minStock ?? 5,
 unit: form.unit || defaultUnit,
 isDefault: form.isDefault,
 };

 setSaving(true);
 try {
 if (variant) {
 const success = await productService.updateVariant(variant.id, payload);
 if (!success) {
 showToast('Erro ao atualizar variação', 'error');
 return;
 }
 if (imageFile && product.id !== 'temp') {
 const url = await uploadVariantImage(imageFile, product.id, variant.id);
 if (url) await productService.updateVariant(variant.id, { image: url });
 }
 showToast('Variação atualizada com sucesso', 'success');
 } else {
 if (product.id === 'temp') {
 showToast('Salve o produto primeiro para adicionar variações.', 'warning');
 return;
 }
 const created = await productService.addVariant(product.id, payload);
 if (!created) {
 showToast('Erro ao criar variação', 'error');
 return;
 }
 if (imageFile) {
 setUploading(true);
 try {
 const url = await uploadVariantImage(imageFile, product.id, created.id);
 if (url) await productService.updateVariant(created.id, { image: url });
 } finally {
 setUploading(false);
 }
 }
 if (form.isDefault) {
 await productService.updateProduct(product.id, {
 price: created.price,
 costPrice: created.costPrice ?? 0,
 });
 }
 showToast('Variação criada com sucesso', 'success');
 }
 await onSuccess();
 onClose();
 } finally {
 setSaving(false);
 }
 };

 const isEditing = !!variant;
 const title = isEditing ? 'Editar Variação' : 'Adicionar Nova Variação';
 const submitLabel = isEditing ? 'Guardar' : 'Adicionar Variação';
 const disabled = saving || uploading;

 if (!open) return null;

 return (
 <Modal
 open={open}
 onClose={onClose}
 title={title}
 maxWidth="lg"
 priority="high"
 footer={
 <div className="flex items-center justify-end gap-3">
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
 disabled={disabled}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
 >
 {saving ? (
 'A guardar...'
 ) : isEditing ? (
 submitLabel
 ) : (
 <>
 <Plus className="w-4 h-4" />
 {submitLabel}
 </>
 )}
 </button>
 </div>
 }
 >
 <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 md:gap-8 items-start">
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Nome da variação *
 </label>
 <input
 type="text"
 placeholder="Ex: 500g, 1kg"
 value={form.name}
 onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary text-sm focus:ring-2 focus:ring-brand-500"
 />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Preço de Compra
 </label>
 <input
 type="number"
 step="0.01"
 placeholder="0.00"
 value={form.costPrice || ''}
 onChange={(e) =>
 setForm((p) => ({ ...p, costPrice: parseFloat(e.target.value) || 0 }))
 }
 className="input-number-simple w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary text-sm focus:ring-2 focus:ring-brand-500"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Preço de Venda *
 </label>
 <input
 type="number"
 step="0.01"
 placeholder="0.00"
 value={form.price || ''}
 onChange={(e) =>
 setForm((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))
 }
 className="input-number-simple w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary text-sm focus:ring-2 focus:ring-brand-500"
 />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Unidade
 </label>
 <select
 value={form.unit}
 onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary text-sm focus:ring-2 focus:ring-brand-500"
 >
 {units.map((u) => (
 <option key={u.abbreviation} value={u.abbreviation}>
 {u.abbreviation}
 </option>
 ))}
 </select>
 </div>
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="addVariantDefault"
 checked={form.isDefault}
 onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
 className="w-4 h-4 text-brand-600 border-border-default rounded focus:ring-brand-500"
 />
 <label htmlFor="addVariantDefault" className="text-sm text-content-secondary">
 Variação padrão
 </label>
 </div>
 </div>
 <div className="flex flex-col items-center md:items-end">
 <label className="block text-sm font-medium text-content-secondary mb-1 w-full md:text-center">
 Imagem da Variação
 </label>
 {imagePreview ? (
 <div className="relative inline-block">
 <img
 src={imagePreview}
 alt="Preview"
 className="w-32 h-32 object-cover rounded-lg border border-border-default"
 />
 <button
 type="button"
 onClick={() => {
 setImagePreview(null);
 setImageFile(null);
 }}
 className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
 >
 <X className="w-3 h-3" />
 </button>
 </div>
 ) : (
 <label className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-border-default rounded-lg cursor-pointer hover:border-brand-500 transition-colors shrink-0">
 <input
 type="file"
 accept="image/*"
 onChange={handleImageChange}
 className="hidden"
 />
 <Upload className="w-6 h-6 text-content-muted" />
 </label>
 )}
 </div>
 </div>
 </Modal>
 );
};
