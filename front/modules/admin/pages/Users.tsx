import React, { useState, useEffect, useMemo, useRef } from 'react';
import { type User, Role, Permission } from '../../core/types/types';
import { userService } from '../../core/services/userService';
import { authService } from '../../auth/services/authService';
import { Plus, Edit, Trash2, Shield, User as UserIcon, Phone, Check, X, Users as UsersIcon, ShoppingBag, Lock } from 'lucide-react';
import { Avatar } from '../../core/components/ui/Avatar';
import { isClientUser, isStaffUser, canManageUsers } from '../../core/hooks/useUserPermissions';
import { normalizeForSearch } from '../../core/services/serviceUtils';
import { PageShell } from '../../core/components/layout/PageShell';
import { FilterBar, SearchInput, ViewModeToggle, SelectFilter, ItemsPerPageSelect, Pagination } from '../../core/components/filters';
import { useMobile } from '../../core/hooks/useMobile';
import { ConfirmDialog } from '../../core/components/ui/ConfirmDialog';
import { SetPasswordModal } from '../components/SetPasswordModal';

type UserFilterType = 'all' | 'staff' | 'clients';
type UserFilterStatus = 'all' | 'active' | 'inactive';

export const Users: React.FC<{
 currentUser: User | null;
 showToast: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void;
}> = ({ currentUser, showToast }) => {
 const isMobile = useMobile(768);
 const [users, setUsers] = useState<User[]>([]);
 const [roles, setRoles] = useState<Role[]>([]);
 const [permissions, setPermissions] = useState<Permission[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [showUserModal, setShowUserModal] = useState(false);
 const [editingUser, setEditingUser] = useState<User | null>(null);
 const [tablesMissing, setTablesMissing] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [filterType, setFilterType] = useState<UserFilterType>('all');
 const [filterRole, setFilterRole] = useState<string>('all');
 const [filterStatus, setFilterStatus] = useState<UserFilterStatus>('all');
 const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'grid' : 'list');
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(50);
 const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
 const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; message: string; onConfirm: () => void; variant?: 'danger' | 'warning' }>({
 isOpen: false,
 message: '',
 onConfirm: () => {},
 variant: 'danger'
 });
 const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 if (currentUser) {
 loadData();
 } else {
 setLoading(false);
 showToast('Usuário não autenticado', 'error');
 }
 }, [currentUser]);

 const loadData = async () => {
 setLoading(true);
 try {
 await Promise.all([loadUsers(), loadRoles(), loadPermissions()]);
 } catch (error) {
 console.error('Erro ao carregar dados:', error);
 showToast('Erro ao carregar dados', 'error');
 } finally {
 setLoading(false);
 }
 };


 const loadUsers = async () => {
 try {
 let appUsers = await userService.getUsers();
 if (currentUser?.id) {
 appUsers = appUsers.map((u) =>
 u.id === currentUser.id && currentUser.email && !u.email
 ? { ...u, email: currentUser.email }
 : u
 );
 }
 setUsers(appUsers);
 } catch (error: any) {
 console.error('Erro ao carregar usuários:', error);
 showToast(
 error.message ||
 'Erro ao carregar usuários. Verifique se a Edge Function admin-auth-users está deployada.',
 'error',
 10000
 );
 setUsers([]);
 }
 };

 const loadRoles = async () => {
 try {
 const data = await userService.getRoles();

 const rolesWithPermissions = (data || []).map((role: any) => ({
 id: role.id,
 name: role.name,
 displayName: role.display_name,
 description: role.description,
 isSystemRole: role.is_system_role,
 permissions: role.role_permissions?.map((rp: any) => rp.permissions).filter(Boolean) || []
 }));

 setRoles(rolesWithPermissions);
 setTablesMissing(false); // Resetar quando carregar com sucesso
 } catch (error: any) {
 console.error('Erro ao carregar roles:', error);
 if (error.code === '42P01' || error.message?.includes('does not exist')) {
 setTablesMissing(true);
 } else {
 showToast(error.message || 'Erro ao carregar roles', 'error');
 }
 setRoles([]);
 }
 };

 const loadPermissions = async () => {
 try {
 const data = await userService.getPermissions();

 const permissionsList = (data || []).map((p: any) => ({
 id: p.id,
 name: p.name,
 description: p.description,
 category: p.category
 }));

 setPermissions(permissionsList);
 setTablesMissing(false); // Resetar quando carregar com sucesso
 } catch (error: any) {
 console.error('Erro ao carregar permissões:', error);
 if (error.code === '42P01' || error.message?.includes('does not exist')) {
 // Néo mostrar toast aqui para evitar duplicação
 setPermissions([]);
 } else {
 showToast(error.message || 'Erro ao carregar permissões', 'error');
 setPermissions([]);
 }
 }
 };

 const handleCreateUser = async (userData: {
 name: string;
 email: string;
 phone?: string;
 password: string;
 roleIds: string[];
 isActive?: boolean;
 isSuperAdmin?: boolean;
 }) => {
 // Validações
 if (!userData.name.trim()) {
 showToast('Nome é obrigatãorio', 'error');
 return;
 }

 if (!userData.email.trim()) {
 showToast('Email é obrigatãorio', 'error');
 return;
 }

 if (!userData.password || userData.password.length < 6) {
 showToast('Senha deve ter pelo menos 6 caracteres', 'error');
 return;
 }

 if (userData.roleIds.length === 0) {
 showToast('Selecione pelo menos um role', 'error');
 return;
 }

 setIsSubmitting(true);
 try {
 let finalPhone: string | undefined;
 if (userData.phone !== undefined && userData.phone !== null) {
 const phoneStr = String(userData.phone).trim();
 if (phoneStr.length > 0) finalPhone = phoneStr;
 }

 const authUser = await userService.createUser({
 email: userData.email.trim(),
 password: userData.password,
 name: userData.name.trim(),
 phone: finalPhone,
 role_ids: userData.roleIds,
 isActive: userData.isActive !== false,
 isSuperAdmin: userData.isSuperAdmin === true
 });

 showToast('Usuário criado com sucesso', 'success');
 setShowUserModal(false);

 if (authUser?.id) {
 window.dispatchEvent(new CustomEvent('roles-updated', { detail: { userId: authUser.id } }));
 }

 loadData();
 } catch (error: any) {
 console.error('Erro ao criar usuário:', error);
 const errorMessage = error.message || 'Erro ao criar usuário';
 showToast(errorMessage, 'error');
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleUpdateUser = async (userId: string, updates: {
 name?: string;
 email?: string;
 phone?: string;
 password?: string;
 roleIds?: string[];
 isActive?: boolean;
 isSuperAdmin?: boolean;
 }) => {
 // Validações
 if (updates.name !== undefined && !updates.name.trim()) {
 showToast('Nome não pode estar vazio', 'error');
 return;
 }

 if (updates.roleIds !== undefined && updates.roleIds.length === 0) {
 showToast('Selecione pelo menos um role', 'error');
 return;
 }

 // Validaçéo de email
 if (updates.email !== undefined) {
 const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 if (!updates.email.trim()) {
 showToast('Email não pode estar vazio', 'error');
 return;
 }
 if (!emailRegex.test(updates.email.trim())) {
 showToast('Email inválido', 'error');
 return;
 }
 }

 setIsSubmitting(true);
 try {
 await userService.updateUser(userId, {
 name: updates.name,
 email: updates.email,
 phone: updates.phone !== undefined ? (updates.phone?.trim() || null) : undefined,
 password: updates.password && updates.password.length >= 6 ? updates.password : undefined,
 role_ids: updates.roleIds,
 isActive: updates.isActive,
 isSuperAdmin: updates.isSuperAdmin
 });

 showToast('Usuário atualizado com sucesso', 'success');
 setShowUserModal(false);
 setEditingUser(null);

 // Limpar cache de permissões e renovar token se for o próprio utilizador
 window.dispatchEvent(new CustomEvent('roles-updated', { detail: { userId } }));
 if (userId === currentUser?.id) {
 authService.refreshToken().catch(() => {});
 }

 loadData();
 } catch (error: any) {
 console.error('Erro ao atualizar usuário:', error);
 showToast(error.message || 'Erro ao atualizar usuário', 'error');
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleDeleteUser = (userId: string) => {
 if (userId === currentUser?.id) {
 showToast('Não pode apagar o seu próprio utilizador', 'error');
 return;
 }
 setConfirmDialog({
 isOpen: true,
 message: 'Tem certeza que deseja apagar este utilizador? Esta ação não pode ser desfeita.',
 variant: 'danger',
 onConfirm: async () => {
 setConfirmDialog(prev => ({ ...prev, isOpen: false }));
 setIsSubmitting(true);
 try {
 await userService.deleteUser(userId);
 showToast('Utilizador apagado com sucesso', 'success');
 loadData();
 } catch (error: any) {
 console.error('Erro ao apagar utilizador:', error);
 showToast(error.message || 'Erro ao apagar utilizador', 'error');
 } finally {
 setIsSubmitting(false);
 }
 }
 });
 };

 // Usar helpers importados
 const isUserClient = (user: User) => isClientUser(user);
 const isUserStaff = (user: User) => isStaffUser(user);

 // Filtrar usuários por tipo, role, status e busca
 const filteredUsers = useMemo(() => {
 let filtered = users;

 if (filterType === 'staff') {
 filtered = filtered.filter(isUserStaff);
 } else if (filterType === 'clients') {
 filtered = filtered.filter(isUserClient);
 }

 if (filterRole !== 'all') {
 filtered = filtered.filter(user =>
 (user.roles || [user.role]).includes(filterRole)
 );
 }

 if (filterStatus === 'active') {
 filtered = filtered.filter(u => u.isActive !== false);
 } else if (filterStatus === 'inactive') {
 filtered = filtered.filter(u => u.isActive === false);
 }

 if (searchTerm) {
 const norm = normalizeForSearch(searchTerm);
 filtered = filtered.filter(user =>
 normalizeForSearch(user.name || '').includes(norm) ||
 normalizeForSearch(user.email || '').includes(norm) ||
 (user.phone && normalizeForSearch(user.phone).includes(norm))
 );
 }

 return filtered;
 }, [users, filterType, filterRole, filterStatus, searchTerm]);

 const paginatedUsers = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return filteredUsers.slice(start, start + itemsPerPage);
 }, [filteredUsers, currentPage, itemsPerPage]);

 const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;

 const hasActiveFilters = filterType !== 'all' || filterRole !== 'all' || filterStatus !== 'all' || !!searchTerm;

 const clearFilters = () => {
 setFilterType('all');
 setFilterRole('all');
 setFilterStatus('all');
 setSearchTerm('');
 setCurrentPage(1);
 };

 const toggleSelectAll = () => {
 if (selectedIds.size === paginatedUsers.length) {
 setSelectedIds(new Set());
 selectAllCheckboxRef.current && (selectAllCheckboxRef.current.checked = false);
 } else {
 setSelectedIds(new Set(paginatedUsers.map(u => u.id)));
 selectAllCheckboxRef.current && (selectAllCheckboxRef.current.checked = true);
 }
 };

 const toggleSelectUser = (id: string) => {
 setSelectedIds(prev => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };

 const handleBulkDelete = async () => {
 const ids = Array.from(selectedIds) as string[];
 const excludeSelf = ids.filter(id => id !== currentUser?.id);
 if (excludeSelf.length === 0) {
 showToast('Não pode apagar seu próprio usuário', 'error');
 return;
 }
 setConfirmDialog({
 isOpen: true,
 message: `Tem certeza que deseja apagar ${excludeSelf.length} usuário(s)? Esta ação não pode ser desfeita.`,
 variant: 'danger',
 onConfirm: async () => {
 setConfirmDialog(prev => ({ ...prev, isOpen: false }));
 setIsSubmitting(true);
 let ok = 0;
 for (const id of excludeSelf) {
 try {
 await userService.deleteUser(id);
 ok++;
 } catch (e) {
 console.warn('Erro ao apagar usuário', id, e);
 }
 }
 showToast(`${ok} usuário(s) apagado(s)`, ok > 0 ? 'success' : 'error');
 setSelectedIds(new Set());
 loadData();
 setIsSubmitting(false);
 }
 });
 };

 const handleBulkSetPassword = async (password: string) => {
 const ids = Array.from(selectedIds) as string[];
 let ok = 0;
 for (const id of ids) {
 try {
 await userService.updateUser(id, { password });
 ok++;
 } catch (e) {
 console.warn('Erro ao definir senha', id, e);
 }
 }
 showToast(`${ok} senha(s) definida(s)`, ok > 0 ? 'success' : 'error');
 setSelectedIds(new Set());
 setShowSetPasswordModal(false);
 };

 const handleSetPasswordForUser = (user: User) => {
 setSelectedIds(new Set([user.id]));
 setShowSetPasswordModal(true);
 };

 const roleOptions = useMemo(() => [
 { value: 'all', label: 'Role' },
 ...roles.map(r => ({ value: r.name, label: r.displayName || r.name }))
 ], [roles]);

 // Verificar se o usuário tem permissão para acessar esta página
 const canAccessUsersPage = canManageUsers(currentUser) || isStaffUser(currentUser);

 if (loading) {
 return (
 <div className="flex items-center justify-center h-64">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
 </div>
 );
 }

 // Se o usuário é cliente, não pode acessar a página de gestéo de usuários
 if (currentUser && isClientUser(currentUser)) {
 return (
 <div className="flex flex-col items-center justify-center h-64 space-y-4 p-8">
 <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded w-full max-w-md">
 <div className="flex">
 <div className="flex-shrink-0">
 <Shield className="h-5 w-5 text-yellow-400 dark:text-yellow-500" />
 </div>
 <div className="ml-3">
 <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
 Acesso Restrito
 </h3>
 <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
 <p>Clientes não podem acessar a gestão de usuários do sistema.</p>
 <p className="mt-2">Esta página é apenas para usuários do sistema (staff/administradores).</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
 }

 const TAB_OPTIONS: { value: UserFilterType; label: string; count: number }[] = [
 { value: 'all', label: 'Todos', count: users.length },
 { value: 'staff', label: 'Funcionários', count: users.filter(isUserStaff).length },
 { value: 'clients', label: 'Clientes', count: users.filter(isUserClient).length },
 ];

 return (
 <PageShell
 title="Gestão de Usuários"
 actions={
 <div className="flex items-center gap-2 flex-wrap">
 {selectedIds.size > 0 && canManageUsers(currentUser) && (
 <>
 <button
 onClick={() => setShowSetPasswordModal(true)}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center gap-2"
 >
 <Lock className="w-4 h-4" />
 <span className="hidden sm:inline">Definir Senha ({selectedIds.size})</span>
 </button>
 <button
 onClick={handleBulkDelete}
 disabled={isSubmitting}
 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
 >
 <Trash2 className="w-4 h-4" />
 <span className="hidden sm:inline">Apagar ({selectedIds.size})</span>
 </button>
 </>
 )}
 {canManageUsers(currentUser) && (
 <button
 onClick={() => { setEditingUser(null); setShowUserModal(true); }}
 className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
 >
 <Plus className="w-4 h-4" />
 <span className="hidden sm:inline">Novo Usuário</span>
 </button>
 )}
 </div>
 }
 >
 {tablesMissing && (
 <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
 <div className="flex">
 <Shield className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
 <div className="ml-3 flex-1">
 <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
 Tabelas de Permissões Não Encontradas
 </h3>
 <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
 Execute sql/migrations/CREATE_PERMISSIONS_SYSTEM.sql no Supabase e recarregue a página.
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Tabs Funcionários / Clientes */}
 <div className="flex gap-1 mb-4 bg-surface-base rounded-xl p-1 w-fit">
 {TAB_OPTIONS.map(tab => (
 <button
 key={tab.value}
 onClick={() => { setFilterType(tab.value); setCurrentPage(1); }}
 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
 filterType === tab.value
 ? 'bg-surface-raised text-content-primary shadow-sm'
 : 'text-content-muted hover:text-content-secondary dark:hover:text-content-muted'
 }`}
 >
 {tab.label}
 <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
 filterType === tab.value
 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
 : 'bg-surface-base text-content-muted'
 }`}>{tab.count}</span>
 </button>
 ))}
 </div>

 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 <ViewModeToggle
 value={viewMode === 'grid' ? 'cards' : 'table'}
 onChange={(m) => setViewMode(m === 'cards' ? 'grid' : 'list')}
 size="compact"
 />
 <div className="h-4 w-px bg-surface-base flex-shrink-0" />
 <SearchInput
 value={searchTerm}
 onChange={setSearchTerm}
 placeholder="Pesquisar usuários..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px]"
 />
 <div className="hidden sm:block">
 <SelectFilter
 value={filterRole}
 onChange={(v) => { setFilterRole(v); setCurrentPage(1); }}
 options={roleOptions}
 placeholder="Role"
 className="flex-shrink-0"
 size="compact"
 />
 </div>
 <div className="hidden sm:block">
 <SelectFilter
 value={filterStatus}
 onChange={(v) => { setFilterStatus(v as UserFilterStatus); setCurrentPage(1); }}
 options={[
 { value: 'all', label: 'Status' },
 { value: 'active', label: 'Ativo' },
 { value: 'inactive', label: 'Inativo' }
 ]}
 placeholder="Status"
 className="flex-shrink-0"
 size="compact"
 />
 </div>
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
 options={[25, 50, 100, 200]}
 label=""
 size="compact"
 className="flex-shrink-0"
 />
 {hasActiveFilters && (
 <button
 onClick={clearFilters}
 className="px-1.5 py-0.5 text-xs border border-border-default rounded text-content-secondary hover:bg-surface-base"
 title="Limpar filtros"
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </FilterBar>

 <div className="bg-surface-raised rounded-lg shadow border border-border-default overflow-hidden">
 {selectedIds.size > 0 && (
 <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border-b border-border-default">
 <span className="text-sm font-medium text-content-secondary">
 {selectedIds.size} selecionado(s)
 </span>
 </div>
 )}
 {filteredUsers.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12">
 <UserIcon className="h-12 w-12 text-content-muted mb-3" />
 <p className="text-content-muted text-sm">
 {hasActiveFilters ? 'Nenhum usuário encontrado com os filtros aplicados' : 'Nenhum usuário cadastrado no sistema'}
 </p>
 {canManageUsers(currentUser) && !hasActiveFilters && (
 <button
 onClick={() => { setEditingUser(null); setShowUserModal(true); }}
 className="mt-4 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
 >
 <Plus className="h-5 w-5" />
 Criar Primeiro Usuário
 </button>
 )}
 {hasActiveFilters && (
 <button onClick={clearFilters} className="mt-4 text-sm text-green-600 hover:underline">Limpar filtros</button>
 )}
 </div>
 ) : viewMode === 'list' ? (
 <>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-surface-base ">
 <tr>
 <th className="px-2 py-2 w-10 text-center">
 {canManageUsers(currentUser) && (
 <input
 ref={selectAllCheckboxRef}
 type="checkbox"
 checked={paginatedUsers.length > 0 && selectedIds.size === paginatedUsers.length}
 onChange={toggleSelectAll}
 className="rounded"
 />
 )}
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase">Usuário</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase">Contacto</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase">Roles</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase">Status</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase">Ações</th>
 </tr>
 </thead>
 <tbody className="bg-surface-raised divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedUsers.map((user) => {
 const isClient = isUserClient(user);
 const isStaff = isUserStaff(user);
 return (
 <tr
 key={user.id}
 className={`hover:bg-surface-base ${isClient ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
 >
 <td className="px-2 py-4 text-center">
 {canManageUsers(currentUser) && (
 <input
 type="checkbox"
 checked={selectedIds.has(user.id)}
 onChange={() => toggleSelectUser(user.id)}
 className="rounded"
 />
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center">
 <div className="relative">
 <Avatar
 src={user.avatar}
 alt={user.name}
 name={user.name}
 size="md"
 className="h-10 w-10"
 />
 {isClient && (
 <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
 <ShoppingBag className="h-3 w-3 text-white" />
 </div>
 )}
 {isStaff && !user.isSuperAdmin && (
 <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
 <UsersIcon className="h-3 w-3 text-white" />
 </div>
 )}
 {user.isSuperAdmin && (
 <div className="absolute -bottom-1 -right-1 bg-purple-500 rounded-full p-1">
 <Shield className="h-3 w-3 text-white" />
 </div>
 )}
 </div>
 <div className="ml-4">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-content-primary">{user.name}</span>
 {isClient && (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
 Cliente
 </span>
 )}
 {user.isSuperAdmin && (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
 <Shield className="h-3 w-3 mr-1" />
 Super Admin
 </span>
 )}
 </div>
 <div className="text-sm text-content-muted">{user.email || 'Sem email'}</div>
 </div>
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm text-content-primary">
 {user.phone && (
 <div className="flex items-center space-x-1">
 <Phone className="h-4 w-4 text-content-muted" />
 <span>{user.phone}</span>
 </div>
 )}
 </div>
 </td>
 <td className="px-6 py-4">
 <div className="flex flex-wrap gap-1">
 {(user.roles || [user.role]).length > 0 ? (
 (user.roles || [user.role]).map((role, idx) => {
 const roleData = roles.find(r => r.name === role);
 const isClientRole = role === 'CLIENTE';
 return (
 <span
 key={idx}
 className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isClientRole
 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
 : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
 }`}
 >
 {isClientRole && <ShoppingBag className="h-3 w-3 mr-1" />}
 {!isClientRole && <UsersIcon className="h-3 w-3 mr-1" />}
 {roleData?.displayName || role}
 </span>
 );
 })
 ) : (
 <span className="text-xs text-content-muted">Sem roles</span>
 )}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 {user.isActive !== false ? (
 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
 <Check className="h-3 w-3 mr-1" />
 Ativo
 </span>
 ) : (
 <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
 <X className="h-3 w-3 mr-1" />
 Inativo
 </span>
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
 {canManageUsers(currentUser) ? (
 <div className="flex items-center gap-1">
 <button
 onClick={() => { setEditingUser(user); setShowUserModal(true); }}
 className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
 title="Editar"
 >
 <Edit className="h-4 w-4" />
 </button>
 <button
 onClick={() => handleSetPasswordForUser(user)}
 className="p-1.5 text-content-secondary hover:bg-surface-base rounded"
 title="Definir senha"
 >
 <Lock className="h-4 w-4" />
 </button>
 {user.id !== currentUser?.id && (
 <button
 onClick={() => handleDeleteUser(user.id)}
 disabled={isSubmitting}
 className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
 title="Apagar"
 >
 <Trash2 className="h-4 w-4" />
 </button>
 )}
 </div>
 ) : (
 <span className="text-xs text-content-muted">Sem permissão</span>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 {totalPages > 1 && (
 <div className="border-t border-border-default px-4 py-2">
 <Pagination
 currentPage={currentPage}
 totalItems={filteredUsers.length}
 itemsPerPage={itemsPerPage}
 onPageChange={setCurrentPage}
 />
 </div>
 )}
 </>
 ) : (
 <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {paginatedUsers.map((user) => {
 const isClient = isUserClient(user);
 const isStaff = isUserStaff(user);
 return (
 <div
 key={user.id}
 className={`rounded-lg border p-4 ${isClient ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-surface-raised'}`}
 >
 <div className="flex items-start gap-3">
 {canManageUsers(currentUser) && (
 <input
 type="checkbox"
 checked={selectedIds.has(user.id)}
 onChange={() => toggleSelectUser(user.id)}
 className="rounded mt-1"
 />
 )}
 <div className="relative flex-shrink-0">
 <Avatar src={user.avatar} alt={user.name} name={user.name} size="md" className="h-12 w-12" />
 {(isClient || isStaff || user.isSuperAdmin) && (
 <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
 {isClient ? <ShoppingBag className="h-3 w-3 text-white" /> : user.isSuperAdmin ? <Shield className="h-3 w-3 text-white" /> : <UsersIcon className="h-3 w-3 text-white" />}
 </div>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-content-primary truncate">{user.name}</div>
 <div className="text-sm text-content-muted truncate">{user.email || 'Sem email'}</div>
 {user.phone && <div className="text-xs text-content-secondary flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{user.phone}</div>}
 <div className="flex flex-wrap gap-1 mt-2">
 {(user.roles || [user.role]).slice(0, 2).map((r, i) => (
 <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
 {roles.find(ro => ro.name === r)?.displayName || r}
 </span>
 ))}
 </div>
 <div className="flex items-center gap-2 mt-2">
 {user.isActive !== false ? (
 <span className="text-xs text-green-600 dark:text-green-400">Ativo</span>
 ) : (
 <span className="text-xs text-red-600 dark:text-red-400">Inativo</span>
 )}
 {canManageUsers(currentUser) && (
 <div className="flex gap-1 ml-auto">
 <button onClick={() => { setEditingUser(user); setShowUserModal(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit className="h-4 w-4" /></button>
 <button onClick={() => handleSetPasswordForUser(user)} className="p-1 text-content-secondary hover:bg-surface-base rounded" title="Definir senha"><Lock className="h-4 w-4" /></button>
 {user.id !== currentUser?.id && <button onClick={() => handleDeleteUser(user.id)} disabled={isSubmitting} className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50" title="Apagar"><Trash2 className="h-4 w-4" /></button>}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 {viewMode === 'grid' && totalPages > 1 && (
 <div className="border-t border-border-default px-4 py-2">
 <Pagination
 currentPage={currentPage}
 totalItems={filteredUsers.length}
 itemsPerPage={itemsPerPage}
 onPageChange={setCurrentPage}
 />
 </div>
 )}
 </div>

 {confirmDialog.isOpen && (
 <ConfirmDialog
 isOpen={confirmDialog.isOpen}
 message={confirmDialog.message}
 onConfirm={confirmDialog.onConfirm}
 onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
 variant={confirmDialog.variant || 'danger'}
 />
 )}

 {showSetPasswordModal && (
 <SetPasswordModal
 isOpen={showSetPasswordModal}
 userIds={Array.from(selectedIds)}
 onConfirm={handleBulkSetPassword}
 onClose={() => { setShowSetPasswordModal(false); }}
 />
 )}

 {showUserModal && (
 <UserModal
 user={editingUser}
 roles={roles}
 isSubmitting={isSubmitting}
 onSave={editingUser ? handleUpdateUser : handleCreateUser}
 onClose={() => {
 if (!isSubmitting) {
 setShowUserModal(false);
 setEditingUser(null);
 }
 }}
 />
 )}
 </PageShell>
 );
};

// Modal de Usuário
const UserModal: React.FC<{
 user: User | null;
 roles: Role[];
 isSubmitting?: boolean;
 onSave: (userId: string, data: any) => void | ((data: any) => void);
 onClose: () => void;
}> = ({ user, roles, isSubmitting = false, onSave, onClose }) => {
 const [formData, setFormData] = useState({
 name: user?.name || '',
 email: user?.email || '',
 phone: user?.phone || '',
 password: '',
 roleIds: user?.roles?.map(r => {
 const role = roles.find(ro => ro.name === r);
 return role?.id || '';
 }).filter(Boolean) || [],
 isActive: user?.isActive !== false
 });

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (user) {
 const updateData: any = {
 name: formData.name,
 phone: formData.phone?.trim() || null,
 roleIds: formData.roleIds,
 isActive: formData.isActive
 };
 if (formData.email !== user.email) updateData.email = formData.email;
 if (formData.password && formData.password.length >= 6) updateData.password = formData.password;

 (onSave as (userId: string, data: any) => void)(user.id, updateData);
 } else {
 // Ao criar, garantir que o telefone seja tratado corretamente
 // Se o telefone foi preenchido, passar o valor; senão passar string vazia (será convertido para null)
 const phoneValue = formData.phone?.trim() || '';

 console.log('=== DADOS DO FORMULéRIO ===');
 console.log('formData completo:', formData);
 console.log('Telefone do formulário:', {
 original: formData.phone,
 trimmed: phoneValue,
 length: phoneValue.length,
 willPass: phoneValue.length > 0 ? phoneValue : ''
 });

 const createData = {
 name: formData.name,
 email: formData.email,
 phone: phoneValue.length > 0 ? phoneValue : '', // Passar string vazia se não preenchido (será convertido para null)
 password: formData.password,
 roleIds: formData.roleIds,
 isActive: formData.isActive
 };

 console.log('Dados que serão enviados para handleCreateUser:', createData);
 (onSave as (data: any) => void)(createData);
 }
 };

 return (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-50">
 <div className="bg-surface-raised rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
 <h2 className="text-xl font-bold mb-4 text-content-primary">{user ? 'Editar Usuário' : 'Novo Usuário'}</h2>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Nome *</label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
 required
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Email *</label>
 <input
 type="email"
 value={formData.email}
 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
 required
 disabled={isSubmitting}
 />
 {user && (
 <p className="text-xs text-content-muted mt-1">
 O email será atualizado no sistema de autenticaçéo. O usuário precisará usar o novo email para fazer login.
 </p>
 )}
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Telefone</label>
 <input
 type="tel"
 value={formData.phone}
 onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
 />
 </div>
 {!user ? (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Senha *</label>
 <input
 type="password"
 value={formData.password}
 onChange={(e) => setFormData({ ...formData, password: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
 required
 minLength={6}
 />
 </div>
 ) : (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Redefinir senha</label>
 <input
 type="password"
 value={formData.password}
 onChange={(e) => setFormData({ ...formData, password: e.target.value })}
 className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
 placeholder="Deixe em branco para manter a atual"
 minLength={6}
 />
 </div>
 )}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Roles *</label>
 {roles.length === 0 ? (
 <div className="border border-border-default rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
 <p className="text-sm text-yellow-800 dark:text-yellow-200">
 Nenhum role disponível. Crie roles na página de Roles e Permissões primeiro.
 </p>
 </div>
 ) : (
 <div className="space-y-2 max-h-40 overflow-y-auto border border-border-default rounded-lg p-2 bg-surface-base">
 {roles.map((role) => (
 <label key={role.id} className="flex items-center space-x-2 hover:bg-surface-base p-2 rounded cursor-pointer">
 <input
 type="checkbox"
 checked={formData.roleIds.includes(role.id)}
 onChange={(e) => {
 if (e.target.checked) {
 setFormData({ ...formData, roleIds: [...formData.roleIds, role.id] });
 } else {
 setFormData({ ...formData, roleIds: formData.roleIds.filter(id => id !== role.id) });
 }
 }}
 className="rounded text-green-600 focus:ring-green-500"
 />
 <div className="flex-1">
 <span className="text-sm font-medium text-content-primary">{role.displayName}</span>
 {role.description && (
 <p className="text-xs text-content-muted">{role.description}</p>
 )}
 </div>
 </label>
 ))}
 </div>
 )}
 {formData.roleIds.length > 0 && (
 <p className="text-xs text-content-muted mt-1">
 {formData.roleIds.length} role(s) selecionado(s)
 </p>
 )}
 </div>

 {/* Seção de Locais Comerciais Removida */}

 <div>
 <label className="flex items-center space-x-2">
 <input
 type="checkbox"
 checked={formData.isActive}
 onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
 className="rounded"
 />
 <span className="text-sm font-medium text-content-secondary">Usuário ativo</span>
 </label>
 </div>
 <div className="flex space-x-3 pt-4">
 <button
 type="submit"
 disabled={isSubmitting}
 className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
 >
 {isSubmitting ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
 {user ? 'Atualizando...' : 'Criando...'}
 </>
 ) : (
 user ? 'Atualizar' : 'Criar'
 )}
 </button>
 <button
 type="button"
 onClick={onClose}
 disabled={isSubmitting}
 className="flex-1 bg-surface-base text-content-secondary py-2 rounded-lg font-medium hover:bg-surface-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Cancelar
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};



