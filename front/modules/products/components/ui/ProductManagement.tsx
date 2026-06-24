import React, { useState, useEffect } from 'react';
import { ProductCategory, ProductUnit, VariantTemplate } from '../../../core/types/types';
import { useProducts } from '../../../core/hooks/useProducts';
import { Plus, Edit2, Trash2, Save, X, Tag, Ruler, Layers, CheckCircle, Upload } from 'lucide-react';
import { Toast } from '../../../core/components/ui/Toast';
import { ConfirmDialog } from '../../../core/components/ui/ConfirmDialog';

type ProductManagementTabType = 'categories' | 'units' | 'templates';

interface ProductManagementProps {
 showToast: (message: string, type?: Toast['type'], duration?: number) => void;
 onDataChanged?: () => void; // Callback para notificar mudanças
 defaultTab?: ProductManagementTabType;
}

export const ProductManagement: React.FC<ProductManagementProps> = ({ showToast, onDataChanged, defaultTab = 'categories' }) => {
 const [activeTab, setActiveTab] = useState<ProductManagementTabType>(defaultTab);

 // Hook do mé³dulo produtos
 const {
 categories,
 units,
 templates,
 getCategories,
 getUnits,
 getVariantTemplates,
 addCategory,
 updateCategory,
 deleteCategory,
 addUnit,
 updateUnit,
 deleteUnit,
 addVariantTemplate,
 updateVariantTemplate,
 deleteVariantTemplate,
 loading
 } = useProducts();

 // Editing states
 const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
 const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#3B82F6', icon: '', imageUrl: '' });
 const [pendingImageData, setPendingImageData] = useState<string | null>(null);

 const [editingUnit, setEditingUnit] = useState<ProductUnit | null>(null);
 const [unitForm, setUnitForm] = useState({ name: '', abbreviation: '', description: '' });

 const [editingTemplate, setEditingTemplate] = useState<VariantTemplate | null>(null);
 const [templateForm, setTemplateForm] = useState({ name: '', description: '', values: [''] });

 // Confirmation Dialog
 const [confirmDialog, setConfirmDialog] = useState<{
 isOpen: boolean;
 message: string;
 onConfirm: () => void;
 variant?: 'danger' | 'warning' | 'info';
 }>({
 isOpen: false,
 message: '',
 onConfirm: () => { },
 variant: 'warning'
 });

 useEffect(() => {
 loadData();
 }, [activeTab, getCategories, getUnits, getVariantTemplates]);

 const loadData = async () => {
 try {
 if (activeTab === 'categories') {
 await getCategories();
 } else if (activeTab === 'units') {
 await getUnits();
 } else if (activeTab === 'templates') {
 await getVariantTemplates();
 }
 } catch (error) {
 showToast('Erro ao carregar dados', 'error');
 }
 };

 // Categories
 const handleSaveCategory = async () => {
 if (!categoryForm.name.trim()) {
 showToast('Nome da categoria é© obrigaté³rio', 'error');
 return;
 }

 try {
 if (editingCategory) {
 const payload: any = {
 name: categoryForm.name,
 description: categoryForm.description,
 color: categoryForm.color,
 icon: categoryForm.icon,
 isActive: editingCategory.isActive
 };
 if (pendingImageData) payload.imageData = pendingImageData;
 const success = await updateCategory(editingCategory.id, payload);
 if (success) {
 showToast('Categoria atualizada com sucesso', 'success');
 setEditingCategory(null);
 setCategoryForm({ name: '', description: '', color: '#3B82F6', icon: '', imageUrl: '' });
 setPendingImageData(null);
 onDataChanged?.();
 } else {
 showToast('Erro ao atualizar categoria', 'error');
 }
 } else {
 const payload: any = {
 name: categoryForm.name,
 description: categoryForm.description,
 color: categoryForm.color,
 icon: categoryForm.icon,
 isActive: true
 };
 if (pendingImageData) payload.imageData = pendingImageData;
 const newCategory = await addCategory(payload);
 if (newCategory) {
 showToast('Categoria criada com sucesso', 'success');
 setCategoryForm({ name: '', description: '', color: '#3B82F6', icon: '', imageUrl: '' });
 setPendingImageData(null);
 onDataChanged?.();
 } else {
 showToast('Erro ao criar categoria', 'error');
 }
 }
 } catch (error) {
 showToast('Erro ao salvar categoria', 'error');
 }
 };

 const handleDeleteCategory = (id: string) => {
 setConfirmDialog({
 isOpen: true,
 message: 'Tem certeza que deseja apagar esta categoria?',
 variant: 'danger',
 onConfirm: async () => {
 try {
 const success = await deleteCategory(id);
 if (success) {
 showToast('Categoria apagada com sucesso', 'success');
 onDataChanged?.();
 } else {
 showToast('Erro ao apagar categoria', 'error');
 }
 } catch (error) {
 showToast('Erro ao apagar categoria', 'error');
 }
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };

 // Units
 const handleSaveUnit = async () => {
 if (!unitForm.name.trim() || !unitForm.abbreviation.trim()) {
 showToast('Nome e abreviaçéo são obrigaté³rios', 'error');
 return;
 }

 try {
 if (editingUnit) {
 const success = await updateUnit(editingUnit.id, {
 name: unitForm.name,
 abbreviation: unitForm.abbreviation,
 description: unitForm.description,
 isActive: editingUnit.isActive
 });
 if (success) {
 showToast('Unidade atualizada com sucesso', 'success');
 setEditingUnit(null);
 setUnitForm({ name: '', abbreviation: '', description: '' });
 onDataChanged?.();
 } else {
 showToast('Erro ao atualizar unidade', 'error');
 }
 } else {
 const newUnit = await addUnit({
 name: unitForm.name,
 abbreviation: unitForm.abbreviation,
 description: unitForm.description,
 isActive: true
 });
 if (newUnit) {
 showToast('Unidade criada com sucesso', 'success');
 setUnitForm({ name: '', abbreviation: '', description: '' });
 onDataChanged?.();
 } else {
 showToast('Erro ao criar unidade', 'error');
 }
 }
 } catch (error) {
 showToast('Erro ao salvar unidade', 'error');
 }
 };

 const handleDeleteUnit = (id: string) => {
 setConfirmDialog({
 isOpen: true,
 message: 'Tem certeza que deseja apagar esta unidade?',
 variant: 'danger',
 onConfirm: async () => {
 try {
 const success = await deleteUnit(id);
 if (success) {
 showToast('Unidade apagada com sucesso', 'success');
 onDataChanged?.();
 } else {
 showToast('Erro ao apagar unidade', 'error');
 }
 } catch (error) {
 showToast('Erro ao apagar unidade', 'error');
 }
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };

 // Templates
 const handleSaveTemplate = async () => {
 if (!templateForm.name.trim()) {
 showToast('Nome do template é© obrigaté³rio', 'error');
 return;
 }

 const values = templateForm.values.filter(v => v.trim() !== '');
 if (values.length === 0) {
 showToast('Adicione pelo menos um valor', 'error');
 return;
 }

 try {
 if (editingTemplate) {
 const success = await updateVariantTemplate(editingTemplate.id, {
 name: templateForm.name,
 description: templateForm.description,
 values,
 isActive: editingTemplate.isActive
 });
 if (success) {
 showToast('Template atualizado com sucesso', 'success');
 setEditingTemplate(null);
 setTemplateForm({ name: '', description: '', values: [''] });
 onDataChanged?.();
 } else {
 showToast('Erro ao atualizar template', 'error');
 }
 } else {
 const newTemplate = await addVariantTemplate({
 name: templateForm.name,
 description: templateForm.description,
 values,
 isActive: true
 });
 if (newTemplate) {
 showToast('Template criado com sucesso', 'success');
 setTemplateForm({ name: '', description: '', values: [''] });
 onDataChanged?.();
 } else {
 showToast('Erro ao criar template', 'error');
 }
 }
 } catch (error) {
 showToast('Erro ao salvar template', 'error');
 }
 };

 const handleDeleteTemplate = (id: string) => {
 setConfirmDialog({
 isOpen: true,
 message: 'Tem certeza que deseja apagar este template?',
 variant: 'danger',
 onConfirm: async () => {
 try {
 const success = await deleteVariantTemplate(id);
 if (success) {
 showToast('Template apagado com sucesso', 'success');
 onDataChanged?.();
 } else {
 showToast('Erro ao apagar template', 'error');
 }
 } catch (error) {
 showToast('Erro ao apagar template', 'error');
 }
 setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } });
 }
 });
 };

 const addTemplateValue = () => {
 setTemplateForm({ ...templateForm, values: [...templateForm.values, ''] });
 };

 const removeTemplateValue = (index: number) => {
 setTemplateForm({
 ...templateForm,
 values: templateForm.values.filter((_, i) => i !== index)
 });
 };

 const updateTemplateValue = (index: number, value: string) => {
 const newValues = [...templateForm.values];
 newValues[index] = value;
 setTemplateForm({ ...templateForm, values: newValues });
 };

 return (
 <div className="space-y-6">
 {/* Tabs removidas - navegação agora é pelo sidebar com submenus */}

 {/* Categories Tab */}
 {activeTab === 'categories' && (
 <div className="space-y-4">
 {/* Form */}
 <div className="bg-surface-raised rounded-lg p-4 border border-border-default">
 <h3 className="font-semibold text-content-primary mb-4">
 {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Nome *
 </label>
 <input
 type="text"
 value={categoryForm.name}
 onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg "
 placeholder="Ex: Carnes, Polpas, é“leos"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Cor
 </label>
 <div className="flex gap-2">
 <input
 type="color"
 value={categoryForm.color}
 onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
 className="w-12 h-10 rounded border border-border-default"
 />
 <input
 type="text"
 value={categoryForm.color}
 onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
 className="flex-1 px-3 py-2 border border-border-default rounded-lg "
 placeholder="#3B82F6"
 />
 </div>
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Descriçéo
 </label>
 <textarea
 value={categoryForm.description}
 onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg "
 rows={2}
 placeholder="Descriçéo opcional da categoria"
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Imagem da Categoria
 </label>
 <div className="flex items-center gap-4">
 {(pendingImageData || categoryForm.imageUrl) && (
 <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: categoryForm.color || '#3B82F6' }}>
 <img src={pendingImageData || categoryForm.imageUrl} alt="" className="w-full h-full object-cover" />
 <button
 type="button"
 onClick={() => { setPendingImageData(null); setCategoryForm(f => ({ ...f, imageUrl: '' })); }}
 className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
 >
 <X className="w-4 h-4 text-white" />
 </button>
 </div>
 )}
 <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border-default rounded-lg cursor-pointer hover:border-brand-500 transition-colors text-sm text-content-muted">
 <Upload className="w-4 h-4" />
 {pendingImageData || categoryForm.imageUrl ? 'Trocar imagem' : 'Adicionar imagem'}
 <input
 type="file"
 accept="image/*"
 className="hidden"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 const reader = new FileReader();
 reader.onload = (ev) => setPendingImageData(ev.target?.result as string);
 reader.readAsDataURL(file);
 e.target.value = '';
 }}
 />
 </label>
 <span className="text-xs text-content-muted">A imagem aparece no card da loja</span>
 </div>
 </div>
 </div>
 <div className="flex justify-end gap-2 mt-4">
 {editingCategory && (
 <button
 onClick={() => {
 setEditingCategory(null);
 setCategoryForm({ name: '', description: '', color: '#3B82F6', icon: '', imageUrl: '' }); setPendingImageData(null);
 }}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg"
 >
 <X className="w-4 h-4 inline mr-1" /> Cancelar
 </button>
 )}
 <button
 onClick={handleSaveCategory}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2"
 >
 <Save className="w-4 h-4" /> {editingCategory ? 'Atualizar' : 'Criar'}
 </button>
 </div>
 </div>

 {/* List */}
 <div className="bg-surface-raised rounded-lg border border-border-default overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Nome</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Cor</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Descriçéo</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Status</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-content-secondary">Ações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
 {categories.map(category => (
 <tr key={category.id} className="hover:bg-surface-base/50">
 <td className="px-4 py-3 text-sm font-medium text-content-primary">{category.name}</td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <div
 className="w-6 h-6 rounded border border-border-default flex-shrink-0"
 style={{ backgroundColor: category.color || '#3B82F6' }}
 />
 {(category as any).imageUrl && (
 <img src={(category as any).imageUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-border-default" />
 )}
 </div>
 </td>
 <td className="px-4 py-3 text-sm text-content-muted">{category.description || '-'}</td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 rounded text-xs ${category.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-surface-base text-content-primary '}`}>
 {category.isActive ? 'Ativa' : 'Inativa'}
 </span>
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex justify-end gap-2">
 <button
 onClick={() => {
 setEditingCategory(category);
 setPendingImageData(null);
 setCategoryForm({
 name: category.name,
 description: category.description || '',
 color: category.color || '#3B82F6',
 icon: category.icon || '',
 imageUrl: (category as any).imageUrl || ''
 });
 }}
 className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleDeleteCategory(category.id)}
 className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {/* Units Tab */}
 {activeTab === 'units' && (
 <div className="space-y-4">
 {/* Form */}
 <div className="bg-surface-raised rounded-lg p-4 border border-border-default">
 <h3 className="font-semibold text-content-primary mb-4">
 {editingUnit ? 'Editar Unidade' : 'Nova Unidade'}
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Nome *
 </label>
 <input
 type="text"
 value={unitForm.name}
 onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg "
 placeholder="Ex: Quilograma, Grama, Litro"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Abreviaçéo *
 </label>
 <input
 type="text"
 value={unitForm.abbreviation}
 onChange={(e) => setUnitForm({ ...unitForm, abbreviation: e.target.value.toUpperCase() })}
 className="w-full px-3 py-2 border border-border-default rounded-lg "
 placeholder="Ex: kg, g, ml, l, un"
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Descriçéo
 </label>
 <textarea
 value={unitForm.description}
 onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg "
 rows={2}
 placeholder="Descriçéo opcional da unidade"
 />
 </div>
 </div>
 <div className="flex justify-end gap-2 mt-4">
 {editingUnit && (
 <button
 onClick={() => {
 setEditingUnit(null);
 setUnitForm({ name: '', abbreviation: '', description: '' });
 }}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg"
 >
 <X className="w-4 h-4 inline mr-1" /> Cancelar
 </button>
 )}
 <button
 onClick={handleSaveUnit}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2"
 >
 <Save className="w-4 h-4" /> {editingUnit ? 'Atualizar' : 'Criar'}
 </button>
 </div>
 </div>

 {/* List */}
 <div className="bg-surface-raised rounded-lg border border-border-default overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Nome</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Abreviaçéo</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Descriçéo</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Status</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-content-secondary">Ações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
 {units.map(unit => (
 <tr key={unit.id} className="hover:bg-surface-base/50">
 <td className="px-4 py-3 text-sm font-medium text-content-primary">{unit.name}</td>
 <td className="px-4 py-3 text-sm text-content-primary font-mono">{unit.abbreviation}</td>
 <td className="px-4 py-3 text-sm text-content-muted">{unit.description || '-'}</td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 rounded text-xs ${unit.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-surface-base text-content-primary '}`}>
 {unit.isActive ? 'Ativa' : 'Inativa'}
 </span>
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex justify-end gap-2">
 <button
 onClick={() => {
 setEditingUnit(unit);
 setUnitForm({
 name: unit.name,
 abbreviation: unit.abbreviation,
 description: unit.description || ''
 });
 }}
 className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleDeleteUnit(unit.id)}
 className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {/* Templates Tab */}
 {activeTab === 'templates' && (
 <div className="space-y-4">
 {/* Form */}
 <div className="bg-surface-raised rounded-lg p-4 border border-border-default">
 <h3 className="font-semibold text-content-primary mb-4">
 {editingTemplate ? 'Editar Template' : 'Novo Template'}
 </h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Nome *
 </label>
 <input
 type="text"
 value={templateForm.name}
 onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg "
 placeholder="Ex: Peso, Tamanho, Volume"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Descriçéo
 </label>
 <textarea
 value={templateForm.description}
 onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg "
 rows={2}
 placeholder="Descriçéo opcional do template"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Valores *
 </label>
 <div className="space-y-2">
 {templateForm.values.map((value, index) => (
 <div key={index} className="flex gap-2">
 <input
 type="text"
 value={value}
 onChange={(e) => updateTemplateValue(index, e.target.value)}
 className="flex-1 px-3 py-2 border border-border-default rounded-lg "
 placeholder="Ex: 500g, 1kg, 2kg"
 />
 {templateForm.values.length > 1 && (
 <button
 onClick={() => removeTemplateValue(index)}
 className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
 >
 <X className="w-4 h-4" />
 </button>
 )}
 </div>
 ))}
 <button
 onClick={addTemplateValue}
 className="w-full px-4 py-2 border-2 border-dashed border-border-default rounded-lg text-content-secondary hover:border-brand-500 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
 >
 <Plus className="w-4 h-4 inline mr-1" /> Adicionar Valor
 </button>
 </div>
 </div>
 </div>
 <div className="flex justify-end gap-2 mt-4">
 {editingTemplate && (
 <button
 onClick={() => {
 setEditingTemplate(null);
 setTemplateForm({ name: '', description: '', values: [''] });
 }}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg"
 >
 <X className="w-4 h-4 inline mr-1" /> Cancelar
 </button>
 )}
 <button
 onClick={handleSaveTemplate}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2"
 >
 <Save className="w-4 h-4" /> {editingTemplate ? 'Atualizar' : 'Criar'}
 </button>
 </div>
 </div>

 {/* List */}
 <div className="bg-surface-raised rounded-lg border border-border-default overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Nome</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Valores</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-secondary">Status</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-content-secondary">Ações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
 {templates.map(template => (
 <tr key={template.id} className="hover:bg-surface-base/50">
 <td className="px-4 py-3">
 <div className="text-sm font-medium text-content-primary">{template.name}</div>
 {template.description && (
 <div className="text-xs text-content-muted">{template.description}</div>
 )}
 </td>
 <td className="px-4 py-3">
 <div className="flex flex-wrap gap-1">
 {template.values.map((value, idx) => (
 <span
 key={idx}
 className="px-2 py-1 bg-surface-base text-content-secondary rounded text-xs"
 >
 {value}
 </span>
 ))}
 </div>
 </td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 rounded text-xs ${template.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-surface-base text-content-primary '}`}>
 {template.isActive ? 'Ativo' : 'Inativo'}
 </span>
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex justify-end gap-2">
 <button
 onClick={() => {
 setEditingTemplate(template);
 setTemplateForm({
 name: template.name,
 description: template.description || '',
 values: template.values.length > 0 ? template.values : ['']
 });
 }}
 className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleDeleteTemplate(template.id)}
 className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {/* Confirmation Dialog */}
 <ConfirmDialog
 isOpen={confirmDialog.isOpen}
 message={confirmDialog.message}
 onConfirm={confirmDialog.onConfirm}
 onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: () => { } })}
 variant={confirmDialog.variant}
 title="Confirmar Açéo"
 confirmText="Confirmar"
 cancelText="Cancelar"
 />
 </div>
 );
};


