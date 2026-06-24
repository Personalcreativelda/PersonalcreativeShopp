import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
 Activity, Eye, Download, X, ChevronLeft, ChevronRight,
 Monitor, Smartphone, Tablet, User, Clock, ArrowUp, ArrowDown,
 Edit, Trash, Plus, Upload, LogIn, LogOut
} from 'lucide-react';
import { trackingService } from '../../core/services/trackingService';
import { PageShell } from '../../core/components/layout/PageShell';
import { 
 FilterBar, 
 SearchInput, 
 SelectFilter, 
 ItemsPerPageSelect
} from '../../core/components/filters';
import { PeriodFilter, PeriodOption } from '../../core/components/forms/PeriodFilter';
import { getTodayDateString, toDateStringInTimezone, getDateRangeFromPeriod } from '../../core/utils/dateUtils';
import { useMobile } from '../../core/hooks/useMobile';
import { formatDateTime } from '../../core/utils/dateUtils';
import { normalizeForSearch } from '../../core/services/serviceUtils';

// Tipo unificado para atividades
interface UnifiedActivity {
 id: string;
 activityType: 'admin' | 'shop';
 createdAt: string;
 pagePath: string;
 pageTitle?: string;
 // Campos comuns
 userName?: string;
 userEmail?: string;
 userId?: string;
 visitorId?: string;
 customerName?: string;
 customerId?: string;
 deviceType?: string;
 browser?: string;
 browserVersion?: string;
 os?: string;
 osVersion?: string;
 ipAddress?: string;
 sessionId?: string;
 duration?: number;
 // Campos específicos admin
 actionType?: string;
 actionDetails?: any;
 // Campos específicos shop
 actions?: Array<any>;
 productsViewed?: string[];
 visitDuration?: number;
 referrer?: string;
 metadata?: any;
}

export const Statistics: React.FC = () => {
 const isMobile = useMobile(768);
 const [loading, setLoading] = useState(true);
 const [activities, setActivities] = useState<UnifiedActivity[]>([]);
 
 // Filtros
 const [searchTerm, setSearchTerm] = useState('');
 const [filterActivityType, setFilterActivityType] = useState<'all' | 'admin' | 'shop'>('all');
 const [filterActionType, setFilterActionType] = useState<string>('all');
 const [filterPagePath, setFilterPagePath] = useState('all');
 const [filterDevice, setFilterDevice] = useState<string>('all');
 const [filterPeriod, setFilterPeriod] = useState<PeriodOption>('thisMonth');
 const [filterDateFrom, setFilterDateFrom] = useState('');
 const [filterDateTo, setFilterDateTo] = useState('');
 
 // Ordenação
 type SortField = 'createdAt' | 'activityType' | 'userName' | 'pagePath' | 'actionType' | 'deviceType' | 'duration';
 const [sortField, setSortField] = useState<SortField>('createdAt');
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
 
 // Paginação
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(isMobile ? 12 : 24);
 
 // Modal de detalhes
 const [selectedActivity, setSelectedActivity] = useState<UnifiedActivity | null>(null);
 
 const loadingRef = useRef(false);

 // Buscar e mesclar dados
 useEffect(() => {
 if (loadingRef.current) return;
 
 const loadData = async () => {
 loadingRef.current = true;
 setLoading(true);
 try {
 // Calcular range de datas usando utilitário centralizado que respeita Maputo
 const { start, end } = getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo);
 
 // Buscar dados em paralelo usando ISO strings para incluir componentes de tempo
 const [adminActivities, shopVisits] = await Promise.all([
 trackingService.getAdminActivities({
 startDate: start.toISOString(),
 endDate: end.toISOString(),
 pagePath: filterPagePath !== 'all' ? filterPagePath : undefined,
 actionType: filterActionType !== 'all' ? filterActionType : undefined,
 limit: 5000
 }),
 trackingService.getShopVisits({
 startDate: start.toISOString(),
 endDate: end.toISOString(),
 pagePath: filterPagePath !== 'all' ? filterPagePath : undefined,
 limit: 5000
 })
 ]);

 // Mesclar e normalizar dados
 const unified: UnifiedActivity[] = [
 // Admin activities
 ...adminActivities.map((activity: any) => ({
 id: activity.id,
 activityType: 'admin' as const,
 createdAt: activity.createdAt,
 pagePath: activity.pagePath,
 pageTitle: activity.pageTitle,
 userName: activity.userName,
 userId: activity.userId,
 deviceType: activity.deviceType,
 browser: activity.browser,
 browserVersion: activity.browserVersion,
 os: activity.os,
 osVersion: activity.osVersion,
 ipAddress: activity.ipAddress,
 sessionId: activity.sessionId,
 duration: activity.duration,
 actionType: activity.actionType,
 actionDetails: activity.actionDetails,
 metadata: activity.metadata
 })),
 // Shop visits
 ...shopVisits.map((visit: any) => ({
 id: visit.id,
 activityType: 'shop' as const,
 createdAt: visit.createdAt,
 pagePath: visit.pagePath,
 pageTitle: visit.pageTitle,
 userName: visit.userName,
 customerName: visit.customerName,
 customerId: visit.customerId,
 userId: visit.userId,
 visitorId: visit.visitorId,
 deviceType: visit.deviceType,
 browser: visit.browser,
 browserVersion: visit.browserVersion,
 os: visit.os,
 osVersion: visit.osVersion,
 ipAddress: visit.ipAddress,
 sessionId: visit.sessionId,
 duration: visit.visitDuration,
 actions: visit.actions,
 productsViewed: visit.productsViewed,
 referrer: visit.referrer,
 metadata: visit.metadata
 }))
 ];

 // Ordenar por data (mais recente primeiro)
 unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

 setActivities(unified);
 } catch (error) {
 console.error('Erro ao carregar dados de tracking:', error);
 setActivities([]);
 } finally {
 setLoading(false);
 loadingRef.current = false;
 }
 };

 loadData();
 }, [filterPeriod, filterDateFrom, filterDateTo, filterPagePath, filterActionType]);

 // O cálculo de datas agora é feito via getDateRangeFromPeriod(filterPeriod, filterDateFrom, filterDateTo)
 // que garante consistência com o resto do sistema e precisão de milisegundos.

 // Filtrar e ordenar atividades
 const filteredAndSortedActivities = useMemo(() => {
 let filtered = [...activities];

 // Filtro de tipo de atividade
 if (filterActivityType !== 'all') {
 filtered = filtered.filter(a => a.activityType === filterActivityType);
 }

 // Filtro de tipo de ação
 if (filterActionType !== 'all') {
 if (filterActivityType === 'admin') {
 filtered = filtered.filter(a => a.actionType === filterActionType);
 } else if (filterActivityType === 'shop') {
 filtered = filtered.filter(a => {
 if (!a.actions || a.actions.length === 0) return filterActionType === 'visit';
 return a.actions.some((action: any) => action.type === filterActionType);
 });
 }
 }

 // Filtro de página
 if (filterPagePath !== 'all' && filterPagePath) {
 filtered = filtered.filter(a => a.pagePath === filterPagePath);
 }

 // Filtro de dispositivo
 if (filterDevice !== 'all') {
 filtered = filtered.filter(a => a.deviceType === filterDevice);
 }

 // Busca
 if (searchTerm) {
 const term = normalizeForSearch(searchTerm);
 filtered = filtered.filter(a => 
 (a.pagePath && normalizeForSearch(a.pagePath).includes(term)) ||
 (a.pageTitle && normalizeForSearch(a.pageTitle).includes(term)) ||
 (a.userName && normalizeForSearch(a.userName).includes(term)) ||
 (a.customerName && normalizeForSearch(a.customerName).includes(term)) ||
 (a.visitorId && normalizeForSearch(a.visitorId).includes(term)) ||
 (a.actionType && normalizeForSearch(a.actionType).includes(term)) ||
 (a.browser && normalizeForSearch(a.browser).includes(term)) ||
 (a.os && normalizeForSearch(a.os).includes(term))
 );
 }

 // Ordenação
 filtered.sort((a, b) => {
 let comparison = 0;

 switch (sortField) {
 case 'createdAt':
 comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
 break;
 case 'activityType':
 comparison = a.activityType.localeCompare(b.activityType);
 break;
 case 'userName':
 const aUser = a.userName || a.customerName || a.visitorId || '';
 const bUser = b.userName || b.customerName || b.visitorId || '';
 comparison = aUser.localeCompare(bUser);
 break;
 case 'pagePath':
 comparison = (a.pagePath || '').localeCompare(b.pagePath || '');
 break;
 case 'actionType':
 comparison = (a.actionType || '').localeCompare(b.actionType || '');
 break;
 case 'deviceType':
 comparison = (a.deviceType || '').localeCompare(b.deviceType || '');
 break;
 case 'duration':
 comparison = (a.duration || 0) - (b.duration || 0);
 break;
 default:
 return 0;
 }

 return sortDirection === 'asc' ? comparison : -comparison;
 });

 return filtered;
 }, [activities, filterActivityType, filterActionType, filterPagePath, filterDevice, searchTerm, sortField, sortDirection]);

 // Paginação
 const totalPages = Math.ceil(filteredAndSortedActivities.length / itemsPerPage);
 const paginatedActivities = useMemo(() => {
 const start = (currentPage - 1) * itemsPerPage;
 return filteredAndSortedActivities.slice(start, start + itemsPerPage);
 }, [filteredAndSortedActivities, currentPage, itemsPerPage]);

 // Reset paginação quando filtros mudam
 useEffect(() => {
 setCurrentPage(1);
 }, [searchTerm, filterActivityType, filterActionType, filterPeriod, filterDateFrom, filterDateTo, filterPagePath, filterDevice, sortField, sortDirection]);

 // Obter valores únicos para filtros
 const uniquePages = useMemo(() => {
 const pages = new Set<string>();
 activities.forEach(a => {
 if (a.pagePath) pages.add(a.pagePath);
 });
 return Array.from(pages).sort();
 }, [activities]);

 const uniqueActions = useMemo(() => {
 const actions = new Set<string>();
 activities.forEach(a => {
 if (a.activityType === 'admin' && a.actionType) {
 actions.add(a.actionType);
 } else if (a.activityType === 'shop' && a.actions) {
 a.actions.forEach((action: any) => {
 if (action.type) actions.add(action.type);
 });
 }
 });
 return Array.from(actions).sort();
 }, [activities]);

 const handleSort = (field: SortField) => {
 if (sortField === field) {
 setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
 } else {
 setSortField(field);
 setSortDirection('asc');
 }
 setCurrentPage(1);
 };

 const SortIcon = ({ field }: { field: SortField }) => {
 if (sortField !== field) return null;
 return sortDirection === 'asc' ? (
 <ArrowUp className="w-3 h-3" />
 ) : (
 <ArrowDown className="w-3 h-3" />
 );
 };

 const formatDate = (dateString: string) => formatDateTime(dateString);

 const formatDuration = (seconds?: number) => {
 if (!seconds) return 'N/A';
 if (seconds < 60) return `${seconds}s`;
 const mins = Math.floor(seconds / 60);
 const secs = seconds % 60;
 return `${mins}m ${secs}s`;
 };

 const SHOP_ACTION_LABELS: Record<string, string> = {
 page_view: 'Visitou página',
 product_view: 'Visualizou produto',
 add_to_cart: 'Adicionou ao carrinho',
 checkout_start: 'Iniciou checkout',
 order_complete: 'Completou pedido',
 search: 'Buscou'
 };

 const formatShopActions = (actions?: Array<{ type: string }>) => {
 if (!actions || actions.length === 0) return 'Visita';
 const uniqueTypes = [...new Set(actions.map(a => a.type).filter(Boolean))];
 const labels = uniqueTypes
 .map(t => SHOP_ACTION_LABELS[t] || t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
 .slice(0, 3);
 return labels.join(', ') + (uniqueTypes.length > 3 ? '...' : '');
 };

 const getDeviceIcon = (deviceType?: string) => {
 switch (deviceType) {
 case 'mobile':
 return Smartphone;
 case 'tablet':
 return Tablet;
 default:
 return Monitor;
 }
 };

 const getActionIcon = (actionType?: string) => {
 switch (actionType?.toLowerCase()) {
 case 'view':
 return Eye;
 case 'create':
 return Plus;
 case 'update':
 case 'edit':
 return Edit;
 case 'delete':
 return Trash;
 case 'export':
 case 'download':
 return Download;
 case 'upload':
 return Upload;
 case 'login':
 return LogIn;
 case 'logout':
 return LogOut;
 default:
 return Activity;
 }
 };

 const getActionColor = (activityType: 'admin' | 'shop') => {
 return activityType === 'admin' 
 ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
 : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
 };

 const exportData = () => {
 const csv = [
 ['Tipo', 'Data', 'Usuário/Visitante', 'Página', 'Título', 'Ação', 'Dispositivo', 'Navegador', 'OS', 'Duração', 'IP', 'Sessão'].join(','),
 ...filteredAndSortedActivities.map(a => [
 a.activityType === 'admin' ? 'Admin' : 'Loja',
 formatDate(a.createdAt),
 a.userName || a.customerName || a.visitorId || 'Anônimo',
 a.pagePath || '',
 a.pageTitle || '',
 a.actionType || (a.actions && a.actions.length > 0 ? formatShopActions(a.actions) : 'N/A'),
 a.deviceType || '',
 `${a.browser} ${a.browserVersion || ''}`.trim(),
 `${a.os} ${a.osVersion || ''}`.trim(),
 formatDuration(a.duration),
 a.ipAddress || '',
 a.sessionId || ''
 ].join(','))
 ].join('\n');

 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `estatisticas-${getTodayDateString()}.csv`;
 link.click();
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-screen">
 <div className="text-center">
 <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
 <p className="text-content-secondary">Carregando estatísticas...</p>
 </div>
 </div>
 );
 }

 const pageActions = (
 <button
 onClick={exportData}
 className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
 >
 <Download className="w-5 h-5" />
 <span>Exportar CSV</span>
 </button>
 );

 return (
 <PageShell
 title="Estatísticas"
 description="Rastreamento unificado de atividades administrativas e visitas da loja"
 actions={pageActions}
 >
 {/* FilterBar */}
 <FilterBar isStickyOnMobile={isMobile} stickyTopClassName="top-0">
 <SearchInput
 value={searchTerm}
 onChange={(val) => setSearchTerm(val)}
 placeholder="Buscar atividades..."
 size="compact"
 className="flex-1 min-w-[120px] max-w-[300px] flex-shrink-0"
 />

 {/* Filtros - Ocultos no Mobile */}
 <div className="hidden sm:block">
 <SelectFilter
 value={filterActivityType}
 onChange={(val) => {
 setFilterActivityType(val as 'all' | 'admin' | 'shop');
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Todos' },
 { value: 'admin', label: 'Admin' },
 { value: 'shop', label: 'Loja' }
 ]}
 className="flex-shrink-0"
 size="compact"
 ariaLabel="Filtrar por tipo"
 />
 </div>

 <div className="hidden sm:block">
 <SelectFilter
 value={filterPagePath}
 onChange={(val) => {
 setFilterPagePath(val);
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Todas páginas' },
 ...uniquePages.map(p => ({ value: p, label: p }))
 ]}
 className="flex-shrink-0"
 size="compact"
 ariaLabel="Filtrar por página"
 />
 </div>

 <div className="hidden sm:block">
 <SelectFilter
 value={filterActionType}
 onChange={(val) => {
 setFilterActionType(val);
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Todas ações' },
 ...uniqueActions.map(a => ({ value: a, label: a.charAt(0).toUpperCase() + a.slice(1).replace(/_/g, ' ') }))
 ]}
 className="flex-shrink-0"
 size="compact"
 ariaLabel="Filtrar por ação"
 />
 </div>

 <div className="hidden sm:block">
 <SelectFilter
 value={filterDevice}
 onChange={(val) => {
 setFilterDevice(val);
 setCurrentPage(1);
 }}
 options={[
 { value: 'all', label: 'Todos dispositivos' },
 { value: 'desktop', label: 'Desktop' },
 { value: 'mobile', label: 'Mobile' },
 { value: 'tablet', label: 'Tablet' }
 ]}
 className="flex-shrink-0"
 size="compact"
 ariaLabel="Filtrar por dispositivo"
 />
 </div>

 <div className="hidden sm:block">
 <ItemsPerPageSelect
 value={itemsPerPage}
 onChange={(val) => {
 setItemsPerPage(val);
 setCurrentPage(1);
 }}
 options={[12, 24, 48, 96, 500]}
 label=""
 size="compact"
 className="flex-shrink-0"
 />
 </div>

 <div className="hidden sm:block flex-shrink-0 relative" style={{ zIndex: 50 }}>
 <PeriodFilter
 selectedPeriod={filterPeriod}
 onPeriodChange={(period) => {
 setFilterPeriod(period);
 if (period !== 'custom') {
 setFilterDateFrom('');
 setFilterDateTo('');
 }
 setCurrentPage(1);
 }}
 customStartDate={filterDateFrom}
 customEndDate={filterDateTo}
 onCustomDatesChange={(start, end) => {
 setFilterDateFrom(start);
 setFilterDateTo(end);
 setCurrentPage(1);
 }}
 />
 </div>

 {/* Botão Limpar Filtros */}
 {(searchTerm || filterActivityType !== 'all' || filterActionType !== 'all' || filterPagePath !== 'all' || filterDevice !== 'all' || filterPeriod !== 'thisMonth' || filterDateFrom || filterDateTo) && (
 <button
 onClick={() => {
 setSearchTerm('');
 setFilterActivityType('all');
 setFilterActionType('all');
 setFilterPagePath('all');
 setFilterDevice('all');
 setFilterPeriod('thisMonth');
 setFilterDateFrom('');
 setFilterDateTo('');
 setCurrentPage(1);
 }}
 className="hidden sm:flex px-1.5 py-0.5 text-[10px] sm:text-xs border border-border-default rounded text-content-secondary hover:bg-surface-base transition-colors items-center gap-0.5 flex-shrink-0"
 title="Limpar filtros"
 >
 <X className="w-3 h-3" />
 </button>
 )}
 </FilterBar>

 {/* Lista de Atividades */}
 <div className="bg-surface-raised rounded-2xl shadow-lg overflow-hidden">
 <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
 <table className="w-full">
 <thead className="bg-surface-base sticky top-0 z-10">
 <tr>
 <th 
 className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('createdAt')}
 >
 <div className="flex items-center gap-1">
 Data/Hora
 <SortIcon field="createdAt" />
 </div>
 </th>
 <th 
 className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('activityType')}
 >
 <div className="flex items-center gap-1">
 Tipo
 <SortIcon field="activityType" />
 </div>
 </th>
 <th 
 className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('userName')}
 >
 <div className="flex items-center gap-1">
 Usuário/Visitante
 <SortIcon field="userName" />
 </div>
 </th>
 <th 
 className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('pagePath')}
 >
 <div className="flex items-center gap-1">
 Página
 <SortIcon field="pagePath" />
 </div>
 </th>
 <th 
 className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('actionType')}
 >
 <div className="flex items-center gap-1">
 Ação
 <SortIcon field="actionType" />
 </div>
 </th>
 <th 
 className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('deviceType')}
 >
 <div className="flex items-center gap-1">
 Dispositivo
 <SortIcon field="deviceType" />
 </div>
 </th>
 <th 
 className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider cursor-pointer hover:bg-surface-base transition-colors"
 onClick={() => handleSort('duration')}
 >
 <div className="flex items-center gap-1">
 Duração
 <SortIcon field="duration" />
 </div>
 </th>
 </tr>
 </thead>
 <tbody className="bg-surface-raised divide-y divide-gray-200 dark:divide-gray-700">
 {paginatedActivities.length === 0 ? (
 <tr>
 <td colSpan={7} className="px-6 py-8 text-center text-content-muted">
 Nenhuma atividade encontrada
 </td>
 </tr>
 ) : (
 paginatedActivities.map((activity) => {
 const DeviceIcon = getDeviceIcon(activity.deviceType);
 const ActionIcon = activity.activityType === 'admin' 
 ? getActionIcon(activity.actionType)
 : Activity;
 
 return (
 <tr
 key={activity.id}
 className="hover:bg-surface-base cursor-pointer"
 onClick={() => setSelectedActivity(activity)}
 >
 <td className="px-6 py-4 whitespace-nowrap text-sm text-content-primary">
 {formatDate(activity.createdAt)}
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getActionColor(activity.activityType)}`}>
 {activity.activityType === 'admin' ? 'Admin' : 'Loja'}
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-content-primary">
 <div>
 {activity.userName || activity.customerName || activity.visitorId || 'Anônimo'}
 </div>
 {activity.customerName && (
 <div className="text-xs text-content-muted">
 Cliente
 </div>
 )}
 </td>
 <td className="px-6 py-4 text-sm text-content-primary">
 <div className="max-w-xs truncate" title={activity.pagePath}>
 {activity.pagePath}
 </div>
 {activity.pageTitle && (
 <div className="text-xs text-content-muted truncate">
 {activity.pageTitle}
 </div>
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 {activity.activityType === 'admin' ? (
 <span className="inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium bg-surface-base text-content-primary">
 <ActionIcon className="w-3 h-3" />
 <span className="capitalize">{activity.actionType || 'view'}</span>
 </span>
 ) : (
 <span className="text-xs text-content-secondary" title={activity.actions?.length ? `${activity.actions.length} ação(ões)` : undefined}>
 {formatShopActions(activity.actions)}
 </span>
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center space-x-2">
 <DeviceIcon className="w-5 h-5 text-content-muted" />
 <span className="text-sm text-content-primary capitalize">
 {activity.deviceType || 'desktop'}
 </span>
 </div>
 {activity.os && (
 <div className="text-xs text-content-muted">
 {activity.os} {activity.osVersion || ''}
 </div>
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-content-primary">
 {formatDuration(activity.duration)}
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>

 {/* Paginação */}
 {totalPages > 1 && (
 <div className="px-6 py-4 border-t border-border-default flex items-center justify-center gap-2">
 <button
 onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
 disabled={currentPage === 1}
 className="p-2 border border-border-default rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span className="px-4 py-2 text-sm text-content-secondary">
 Página {currentPage} de {totalPages}
 </span>
 <button
 onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
 disabled={currentPage === totalPages}
 className="p-2 border border-border-default rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-base"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 )}
 </div>

 {/* Modal de Detalhes */}
 {selectedActivity && (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay flex items-center justify-center z-50 p-4">
 <div className="bg-surface-raised rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b border-border-default flex items-center justify-between">
 <h2 className="text-2xl font-bold text-content-primary">
 Detalhes da Atividade
 </h2>
 <button
 onClick={() => setSelectedActivity(null)}
 className="text-content-muted hover:text-content-secondary dark:text-content-muted "
 >
 ✕
 </button>
 </div>
 <div className="p-6 space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-sm font-medium text-content-muted">Tipo</label>
 <p className="text-content-primary">
 <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getActionColor(selectedActivity.activityType)}`}>
 {selectedActivity.activityType === 'admin' ? 'Admin' : 'Loja'}
 </span>
 </p>
 </div>
 <div>
 <label className="text-sm font-medium text-content-muted">Data/Hora</label>
 <p className="text-content-primary">{formatDate(selectedActivity.createdAt)}</p>
 </div>
 <div>
 <label className="text-sm font-medium text-content-muted">Página</label>
 <p className="text-content-primary">{selectedActivity.pagePath}</p>
 </div>
 <div>
 <label className="text-sm font-medium text-content-muted">Título</label>
 <p className="text-content-primary">{selectedActivity.pageTitle || 'N/A'}</p>
 </div>
 {selectedActivity.userName && (
 <div>
 <label className="text-sm font-medium text-content-muted">Usuário</label>
 <p className="text-content-primary">{selectedActivity.userName}</p>
 </div>
 )}
 {selectedActivity.customerName && (
 <div>
 <label className="text-sm font-medium text-content-muted">Cliente</label>
 <p className="text-content-primary">{selectedActivity.customerName}</p>
 </div>
 )}
 {selectedActivity.visitorId && (
 <div>
 <label className="text-sm font-medium text-content-muted">Visitante ID</label>
 <p className="text-content-primary font-mono text-xs">{selectedActivity.visitorId}</p>
 </div>
 )}
 {selectedActivity.activityType === 'admin' && selectedActivity.actionType && (
 <div>
 <label className="text-sm font-medium text-content-muted">Tipo de Ação</label>
 <p className="text-content-primary capitalize">{selectedActivity.actionType}</p>
 </div>
 )}
 <div>
 <label className="text-sm font-medium text-content-muted">Dispositivo</label>
 <p className="text-content-primary capitalize">{selectedActivity.deviceType || 'desktop'}</p>
 </div>
 <div>
 <label className="text-sm font-medium text-content-muted">Navegador</label>
 <p className="text-content-primary">{selectedActivity.browser} {selectedActivity.browserVersion || ''}</p>
 </div>
 <div>
 <label className="text-sm font-medium text-content-muted">Sistema Operacional</label>
 <p className="text-content-primary">{selectedActivity.os} {selectedActivity.osVersion || ''}</p>
 </div>
 <div>
 <label className="text-sm font-medium text-content-muted">Sessão ID</label>
 <p className="text-content-primary font-mono text-xs">{selectedActivity.sessionId || 'N/A'}</p>
 </div>
 <div>
 <label className="text-sm font-medium text-content-muted">IP Address</label>
 <p className="text-content-primary font-mono text-xs">{selectedActivity.ipAddress || 'N/A'}</p>
 </div>
 <div>
 <label className="text-sm font-medium text-content-muted">Duração</label>
 <p className="text-content-primary">{formatDuration(selectedActivity.duration)}</p>
 </div>
 </div>

 {selectedActivity.activityType === 'admin' && selectedActivity.actionDetails && Object.keys(selectedActivity.actionDetails).length > 0 && (
 <div>
 <label className="text-sm font-medium text-content-muted block mb-2">
 Detalhes da Ação
 </label>
 <div className="bg-surface-base p-4 rounded-lg space-y-2">
 {selectedActivity.actionDetails.entity && (
 <div>
 <span className="text-xs font-medium text-content-muted">Entidade: </span>
 <span className="text-sm text-content-primary">{selectedActivity.actionDetails.entity}</span>
 </div>
 )}
 {selectedActivity.actionDetails.entityId && (
 <div>
 <span className="text-xs font-medium text-content-muted">ID da Entidade: </span>
 <span className="text-sm text-content-primary font-mono">{selectedActivity.actionDetails.entityId}</span>
 </div>
 )}
 {selectedActivity.actionDetails.changes && (
 <div>
 <span className="text-xs font-medium text-content-muted block mb-1">Alterações:</span>
 <pre className="text-xs text-content-secondary bg-surface-raised p-2 rounded overflow-x-auto">
 {JSON.stringify(selectedActivity.actionDetails.changes, null, 2)}
 </pre>
 </div>
 )}
 </div>
 </div>
 )}

 {selectedActivity.activityType === 'shop' && selectedActivity.actions && selectedActivity.actions.length > 0 && (
 <div>
 <label className="text-sm font-medium text-content-muted block mb-2">
 Ações Realizadas ({selectedActivity.actions.length})
 </label>
 <div className="space-y-2 max-h-64 overflow-y-auto">
 {selectedActivity.actions.map((action: any, idx: number) => (
 <div key={idx} className="p-3 bg-surface-base rounded border-l-4 border-green-500">
 <div className="flex items-center justify-between mb-1">
 <span className="font-medium text-content-primary capitalize">
 {action.type?.replace(/_/g, ' ')}
 </span>
 <span className="text-xs text-content-muted">
 {formatDateTime(action.timestamp)}
 </span>
 </div>
 {action.data && Object.keys(action.data).length > 0 && (
 <pre className="text-xs text-content-secondary overflow-x-auto mt-2">
 {JSON.stringify(action.data, null, 2)}
 </pre>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {selectedActivity.activityType === 'shop' && selectedActivity.productsViewed && selectedActivity.productsViewed.length > 0 && (
 <div>
 <label className="text-sm font-medium text-content-muted block mb-2">
 Produtos Visualizados ({selectedActivity.productsViewed.length})
 </label>
 <div className="flex flex-wrap gap-2">
 {selectedActivity.productsViewed.map((productId, idx) => (
 <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
 {productId}
 </span>
 ))}
 </div>
 </div>
 )}

 {selectedActivity.metadata && Object.keys(selectedActivity.metadata).length > 0 && (
 <div>
 <label className="text-sm font-medium text-content-muted block mb-2">
 Metadados
 </label>
 <pre className="text-xs text-content-secondary bg-surface-base p-3 rounded overflow-x-auto">
 {JSON.stringify(selectedActivity.metadata, null, 2)}
 </pre>
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </PageShell>
 );
};
