import React, { useState, useEffect } from 'react';
import { Role, Permission } from '../../core/types/types';
import api from '../../core/services/apiClient';
import { Search, Plus, Edit, Trash2, Shield } from 'lucide-react';
import { normalizeForSearch } from '../../core/services/serviceUtils';
import { PageShell } from '../../core/components/layout/PageShell';

export const Roles: React.FC<{
 currentUser?: any;
 showToast: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void;
}> = ({ currentUser, showToast }) => {
 const [roles, setRoles] = useState<Role[]>([]);
 const [permissions, setPermissions] = useState<Permission[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [showRoleModal, setShowRoleModal] = useState(false);
 const [editingRole, setEditingRole] = useState<Role | null>(null);

 useEffect(() => { loadData(); }, []);

 const loadData = async () => {
 setLoading(true);
 try {
 await Promise.all([loadRoles(), loadPermissions()]);
 } catch (error) {
 console.error('Erro ao carregar dados:', error);
 showToast('Erro ao carregar dados', 'error');
 } finally {
 setLoading(false);
 }
 };

 const loadRoles = async () => {
 try {
 const data = await api.get<any[]>('/roles');
 const mapped = (data || []).map((role: any) => ({
 id: role.id,
 name: role.name,
 displayName: role.display_name,
 description: role.description,
 isSystemRole: role.is_system_role,
 permissions: role.role_permissions?.map((rp: any) => rp.permissions).filter(Boolean) || []
 }));
 setRoles(mapped);
 } catch (error: any) {
 console.error('Erro ao carregar roles:', error);
 showToast(error.message || 'Erro ao carregar roles', 'error');
 setRoles([]);
 }
 };

 const loadPermissions = async () => {
 try {
 const data = await api.get<Permission[]>('/roles/permissions');
 setPermissions(data || []);
 } catch (error: any) {
 console.error('Erro ao carregar permissões:', error);
 showToast(error.message || 'Erro ao carregar permissões', 'error');
 setPermissions([]);
 }
 };

 const handleCreateRole = async (roleData: {
 name: string;
 displayName: string;
 description?: string;
 permissionIds: string[];
 }) => {
 if (!roleData.name.trim()) { showToast('Nome do role é obrigatório', 'error'); return; }
 if (!roleData.displayName.trim()) { showToast('Nome de exibição é obrigatório', 'error'); return; }

 try {
 await api.post('/roles', {
 name: roleData.name,
 displayName: roleData.displayName,
 description: roleData.description,
 permissionIds: roleData.permissionIds
 });
 showToast('Role criado com sucesso', 'success');
 setShowRoleModal(false);
 window.dispatchEvent(new CustomEvent('roles-updated'));
 loadData();
 } catch (error: any) {
 console.error('Erro ao criar role:', error);
 showToast(error.message || 'Erro ao criar role', 'error');
 }
 };

 const handleUpdateRole = async (roleId: string, updates: {
 displayName?: string;
 description?: string;
 permissionIds?: string[];
 }) => {
 try {
 await api.put(`/roles/${roleId}`, updates);
 showToast('Role atualizado com sucesso', 'success');
 setShowRoleModal(false);
 setEditingRole(null);
 window.dispatchEvent(new CustomEvent('roles-updated'));
 loadData();
 } catch (error: any) {
 console.error('Erro ao atualizar role:', error);
 showToast(error.message || 'Erro ao atualizar role', 'error');
 }
 };

 const handleDeleteRole = async (roleId: string) => {
 const roleToDelete = roles.find(r => r.id === roleId);
 if (roleToDelete?.isSystemRole) {
 showToast('Roles do sistema não podem ser apagados', 'error');
 return;
 }
 if (!confirm('Tem certeza que deseja apagar este role? Esta ação não pode ser desfeita.')) return;

 try {
 await api.delete(`/roles/${roleId}`);
 showToast('Role apagado com sucesso', 'success');
 window.dispatchEvent(new CustomEvent('roles-updated'));
 loadData();
 } catch (error: any) {
 console.error('Erro ao apagar role:', error);
 showToast(error.message || 'Erro ao apagar role', 'error');
 }
 };

 const norm = normalizeForSearch(searchTerm);
 const filteredRoles = roles.filter(role =>
 normalizeForSearch(role.displayName).includes(norm) ||
 normalizeForSearch(role.name).includes(norm) ||
 (role.description && normalizeForSearch(role.description).includes(norm))
 );

 if (loading) {
 return (
 <div className="flex items-center justify-center h-64">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
 </div>
 );
 }

 return (
 <PageShell
 title="Gestão de Roles e Permissões"
 description="Gerir roles do sistema e suas permissões"
 compactHeaderMobile
 actions={
 <button
 onClick={() => { setEditingRole(null); setShowRoleModal(true); }}
 className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
 >
 <Plus className="h-4 w-4" />
 <span>Novo Role</span>
 </button>
 }
 >
 <div className="bg-surface-raised rounded-xl border border-border-default shadow-sm">
 <div className="p-4 border-b border-border-default">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-muted h-5 w-5" />
 <input
 type="text"
 placeholder="Pesquisar roles..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-border-default bg-surface-base text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 />
 </div>
 </div>

 {filteredRoles.length === 0 ? (
 <div className="p-12 text-center">
 <div className="flex flex-col items-center justify-center">
 <Shield className="h-12 w-12 text-content-muted mb-3" />
 <p className="text-content-muted text-sm mb-4">
 {searchTerm ? 'Nenhum role encontrado com essa pesquisa' : 'Nenhum role cadastrado no sistema'}
 </p>
 {!searchTerm && (
 <button
 onClick={() => { setEditingRole(null); setShowRoleModal(true); }}
 className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
 >
 <Plus className="h-4 w-4" />
 <span>Criar Primeiro Role</span>
 </button>
 )}
 </div>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
 {filteredRoles.map((role) => (
 <div key={role.id} className="bg-surface-base rounded-lg border border-border-default p-4 hover:shadow-sm transition-shadow">
 <div className="flex items-center justify-between mb-2">
 <h3 className="font-semibold text-content-primary">{role.displayName}</h3>
 <div className="flex items-center space-x-2">
 {role.isSystemRole && (
 <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">Sistema</span>
 )}
 {!role.isSystemRole && (
 <>
 <button
 onClick={() => { setEditingRole(role); setShowRoleModal(true); }}
 className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
 title="Editar role"
 >
 <Edit className="h-4 w-4" />
 </button>
 <button
 onClick={() => handleDeleteRole(role.id)}
 className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
 title="Apagar role"
 >
 <Trash2 className="h-4 w-4" />
 </button>
 </>
 )}
 </div>
 </div>
 <p className="text-sm text-content-secondary mb-3">{role.description || 'Sem descrição'}</p>
 <div className="space-y-1">
 <p className="text-xs font-medium text-content-muted">Permissões ({role.permissions?.length || 0}):</p>
 <div className="flex flex-wrap gap-1">
 {role.permissions && role.permissions.length > 0 ? (
 <>
 {role.permissions.slice(0, 5).map((perm) => (
 <span key={perm.id} className="text-xs bg-surface-overlay border border-border-default text-content-secondary px-2 py-0.5 rounded">
 {perm.name}
 </span>
 ))}
 {role.permissions.length > 5 && (
 <span className="text-xs text-content-muted">+{role.permissions.length - 5} mais</span>
 )}
 </>
 ) : (
 <span className="text-xs text-content-muted">Nenhuma permissão atribuída</span>
 )}
 </div>
 </div>
 {!role.isSystemRole && (
 <button
 onClick={() => { setEditingRole(role); setShowRoleModal(true); }}
 className="mt-3 w-full text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium"
 >
 Gerir Permissões
 </button>
 )}
 </div>
 ))}
 </div>
 )}
 </div>

 {showRoleModal && (
 <RoleModal
 role={editingRole}
 permissions={permissions}
 onSave={editingRole ? handleUpdateRole : handleCreateRole}
 onClose={() => { setShowRoleModal(false); setEditingRole(null); }}
 />
 )}
 </PageShell>
 );
};

const RoleModal: React.FC<{
 role: Role | null;
 permissions: Permission[];
 onSave: (roleId: string, data: any) => void | ((data: any) => void);
 onClose: () => void;
}> = ({ role, permissions, onSave, onClose }) => {
 const [formData, setFormData] = useState({
 name: role?.name || '',
 displayName: role?.displayName || '',
 description: role?.description || '',
 permissionIds: role?.permissions?.map(p => p.id) || []
 });

 const permissionsByCategory = permissions.reduce((acc, perm) => {
 const category = perm.category || 'Outros';
 if (!acc[category]) acc[category] = [];
 acc[category].push(perm);
 return acc;
 }, {} as Record<string, Permission[]>);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (role) {
 (onSave as (roleId: string, data: any) => void)(role.id, formData);
 } else {
 (onSave as (data: any) => void)(formData);
 }
 };

 const togglePermission = (permissionId: string) => {
 setFormData(prev => ({
 ...prev,
 permissionIds: prev.permissionIds.includes(permissionId)
 ? prev.permissionIds.filter(id => id !== permissionId)
 : [...prev.permissionIds, permissionId]
 }));
 };

 const selectAllInCategory = (category: string) => {
 const categoryIds = (permissionsByCategory[category] || []).map(p => p.id);
 const allSelected = categoryIds.every(id => formData.permissionIds.includes(id));
 setFormData(prev => ({
 ...prev,
 permissionIds: allSelected
 ? prev.permissionIds.filter(id => !categoryIds.includes(id))
 : [...new Set([...prev.permissionIds, ...categoryIds])]
 }));
 };

 return (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-50">
 <div className="bg-surface-raised rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl border border-border-default">
 <h2 className="text-xl font-bold mb-4 text-content-primary">{role ? 'Editar Role' : 'Novo Role'}</h2>
 <form onSubmit={handleSubmit} className="space-y-4">
 {!role && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Nome do Role *</label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 placeholder="Ex: GESTOR_FINANCEIRO"
 className="w-full px-3 py-2 border border-border-default bg-surface-base text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 required
 />
 <p className="text-xs text-content-muted mt-1">Será convertido para maiúsculas automaticamente</p>
 </div>
 )}
 {role && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Nome do Role</label>
 <input
 type="text"
 value={formData.name}
 disabled
 className="w-full px-3 py-2 border border-border-default bg-surface-base text-content-muted rounded-lg opacity-60"
 />
 <p className="text-xs text-content-muted mt-1">Nome do role não pode ser alterado</p>
 </div>
 )}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Nome de Exibição *</label>
 <input
 type="text"
 value={formData.displayName}
 onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
 placeholder="Ex: Gestor Financeiro"
 className="w-full px-3 py-2 border border-border-default bg-surface-base text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 required
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Descrição</label>
 <textarea
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 placeholder="Descreva o propósito deste role..."
 rows={3}
 className="w-full px-3 py-2 border border-border-default bg-surface-base text-content-primary rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">Permissões</label>
 <div className="border border-border-default rounded-lg p-4 max-h-96 overflow-y-auto space-y-4 bg-surface-base">
 {Object.entries(permissionsByCategory).map(([category, perms]) => (
 <div key={category} className="border-b border-border-default pb-3 last:border-b-0 last:pb-0">
 <div className="flex items-center justify-between mb-2">
 <h4 className="font-semibold text-content-secondary text-sm">{category}</h4>
 <button
 type="button"
 onClick={() => selectAllInCategory(category)}
 className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700"
 >
 {(perms as Permission[]).every(p => formData.permissionIds.includes(p.id)) ? 'Desmarcar Todas' : 'Selecionar Todas'}
 </button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
 {(perms as Permission[]).map((perm) => (
 <label key={perm.id} className="flex items-center space-x-2 cursor-pointer hover:bg-surface-overlay p-2 rounded">
 <input
 type="checkbox"
 checked={formData.permissionIds.includes(perm.id)}
 onChange={() => togglePermission(perm.id)}
 className="rounded"
 />
 <div className="flex-1">
 <span className="text-sm text-content-primary">{perm.name}</span>
 {perm.description && (
 <p className="text-xs text-content-muted">{perm.description}</p>
 )}
 </div>
 </label>
 ))}
 </div>
 </div>
 ))}
 {permissions.length === 0 && (
 <p className="text-sm text-content-muted text-center py-4">Nenhuma permissão disponível</p>
 )}
 </div>
 <p className="text-xs text-content-muted mt-2">
 {formData.permissionIds.length} permissão(ões) selecionada(s)
 </p>
 </div>
 <div className="flex gap-3 pt-4">
 <button
 type="submit"
 className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg font-medium transition-colors"
 >
 {role ? 'Atualizar' : 'Criar'}
 </button>
 <button
 type="button"
 onClick={onClose}
 className="flex-1 bg-surface-base border border-border-default text-content-secondary py-2 rounded-lg font-medium hover:bg-surface-overlay transition-colors"
 >
 Cancelar
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};
