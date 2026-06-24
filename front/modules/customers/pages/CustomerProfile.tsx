import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole, LoyaltyTier } from '../../core/types/types';
import { customerProfileService } from '../services/customerProfileService';
import { dataService } from '../../core/services/dataService';
import { supabase, isSupabaseConfigured } from '../../core/services/supabaseClient';
import { useMobile } from '../../core/hooks/useMobile';
import { Toast } from '../../core/components/ui/Toast';
import {
 User as UserIcon,
 Award,
 TrendingUp,
 Target,
 Share2,
 Star,
 Gift,
 BarChart3,
 Copy,
 Check,
 Download,
 ExternalLink,
 ArrowLeft,
 Package,
 Search,
 Moon,
 Sun,
 Settings,
 LogOut
} from 'lucide-react';
import { Logo } from '../../core/components/ui/Logo';
import { Avatar } from '../../core/components/ui/Avatar';
import { StatsCard } from '../components/profile/StatsCard';
import { LoadingSkeleton } from '../components/profile/LoadingSkeleton';
import { ToastContainer } from '../../core/components/ui/Toast';

interface CustomerProfileProps {
 user: User;
 onBack?: () => void;
 onLogout?: () => void;
 showToast?: (message: string, type: Toast['type'], duration?: number) => void;
}

const BASE_PATH = '/';

export const CustomerProfile: React.FC<CustomerProfileProps> = ({
 user,
 onBack,
 onLogout,
 showToast
}) => {
 const navigate = useNavigate();
 const isMobile = useMobile(768);
 const [customer, setCustomer] = useState<any>(null);
 const [toasts, setToasts] = useState<Toast[]>([]);
 const [loading, setLoading] = useState(true);

 // Função local de toast se não for fornecida
 const localShowToast = useCallback((message: string, type: Toast['type'] = 'info', duration?: number) => {
 if (showToast) {
 showToast(message, type, duration);
 } else {
 const id = `toast-${Date.now()}-${Math.random()}`;
 setToasts(prev => [...prev, { id, message, type, duration }]);
 }
 }, [showToast]);

 const removeToast = (id: string) => {
 setToasts(prev => prev.filter(toast => toast.id !== id));
 };

 useEffect(() => {
 loadProfileData();
 }, [user]);

 const loadProfileData = async () => {
 setLoading(true);
 try {
 // Buscar dados do cliente
 const customers = await dataService.getCustomers();
 let foundCustomer = customers.find(
 c => c.id === user.customerId ||
 c.phone === user.phone ||
 (user.email && c.email === user.email)
 );

 // Se não encontrou cliente, tentar criar um baseado nos dados do usuário
 if (!foundCustomer && (user.phone || user.email)) {
 try {
 // Criar cliente automaticamente
 console.log('Criando cliente automaticamente para o usuário...');

 const newCustomer = await dataService.addCustomer({
 name: user.name,
 phone: user.phone || '',
 email: user.email,
 address: '',
 notes: `Cliente criado automaticamente a partir do perfil do usuário (${user.email || user.phone})`
 });

 if (newCustomer) {
 foundCustomer = newCustomer;

 // Vincular cliente ao perfil do usué¡rio
 if (supabase && isSupabaseConfigured()) {
 const { error: updateError } = await supabase
 .from('profiles')
 .update({ customer_id: newCustomer.id })
 .eq('id', user.id);

 if (updateError) {
 console.warn('Erro ao vincular cliente ao perfil:', updateError);
 } else {
 console.log('âœ… Cliente criado e vinculado ao perfil com sucesso!');
 // Atualizar o user.customerId localmente
 user.customerId = newCustomer.id;
 }
 }
 }
 } catch (error) {
 console.warn('Erro ao criar cliente automaticamente:', error);
 // Continuar sem cliente - seré¡ mostrada mensagem apropriada
 }
 }

 if (foundCustomer) {
 setCustomer(foundCustomer);
 }
 } catch (error) {
 console.error('Erro ao carregar perfil:', error);
 } finally {
 setLoading(false);
 }
 };

 const availableActions: any[] = []; // Disabled for now

 if (loading) {
 return (
 <div className="min-h-screen bg-surface-base">
 <div className={`max-w-7xl mx-auto ${isMobile ? 'px-2 py-4' : 'px-4 sm:px-6 lg:px-8 py-8'}`}>
 <LoadingSkeleton type="stats" count={4} />
 <div className={isMobile ? 'mt-4' : 'mt-8'}>
 <LoadingSkeleton type="card" count={3} />
 </div>
 </div>
 </div>
 );
 }

 // Se não encontrou cliente vinculado, mostrar mensagem
 if (!customer && !loading) {
 return (
 <div className="min-h-screen bg-surface-base">
 {/* Header */}
 <div className="bg-surface-raised shadow-sm">
 <div className={`max-w-7xl mx-auto ${isMobile ? 'px-2 py-4' : 'px-4 sm:px-6 lg:px-8 py-6'}`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-4">
 {onBack && (
 <button
 onClick={onBack}
 className={`${isMobile ? 'p-1.5' : 'p-2'} rounded-lg hover:bg-surface-base`}
 >
 <ArrowLeft className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
 </button>
 )}
 <div className={`flex items-center ${isMobile ? 'space-x-2' : 'space-x-4'}`}>
 <Avatar
 src={user.avatar}
 alt={user.name}
 name={user.name}
 size={isMobile ? 'md' : 'lg'}
 className="bg-gradient-to-br from-green-500 via-green-600 to-green-700"
 />
 <div>
 <h1 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-content-primary`}>{user.name}</h1>
 <p className={`${isMobile ? 'text-xs' : 'text-base'} text-content-secondary`}>{user.email || user.phone}</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Content */}
 <div className={`max-w-7xl mx-auto ${isMobile ? 'px-2 py-4' : 'px-4 sm:px-6 lg:px-8 py-8'}`}>
 <div className={`bg-surface-raised rounded-lg shadow ${isMobile ? 'p-4' : 'p-8'} text-center`}>
 <UserIcon className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} text-content-muted mx-auto ${isMobile ? 'mb-3' : 'mb-4'}`} />
 <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-content-primary ${isMobile ? 'mb-2' : 'mb-2'}`}>
 Perfil néo vinculado a um cliente
 </h2>
 <p className={`${isMobile ? 'text-sm' : 'text-base'} text-content-secondary ${isMobile ? 'mb-4' : 'mb-6'}`}>
 Para acessar todas as funcionalidades do perfil (pontos, conquistas, afiliados), é necessário vincular sua conta a um cliente no sistema.
 </p>
 <div className={isMobile ? 'space-y-3' : 'space-y-4'}>
 <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-content-muted`}>
 Entre em contato com o administrador para vincular sua conta ou criar um cliente.
 </p>
 <div className={`flex items-center justify-center ${isMobile ? 'flex-col space-y-2' : 'space-x-4'}`}>
 {onBack && (
 <button
 onClick={onBack}
 className={`${isMobile ? 'w-full px-4 py-2 text-sm' : 'px-6 py-2'} bg-surface-base text-content-secondary rounded-lg hover:bg-surface-base transition-colors`}
 >
 Voltar para Loja
 </button>
 )}
 {user.role !== UserRole.CLIENTE && (
 <button
 onClick={() => navigate('/admin')}
 className={`${isMobile ? 'w-full px-4 py-2 text-sm' : 'px-6 py-2'} bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors`}
 >
 Ir para Painel Admin
 </button>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 );
 }

 // Removed tier logic
 const progressToNextTier = 0;

 return (
 <>
 {/* Toast Container - apenas se néo tiver showToast externo */}
 {!showToast && <ToastContainer toasts={toasts} onClose={removeToast} />}

 {/* Content - O header e footer são fornecidos pelo Shop */}
 <div className="w-full">
 {/* Header Premium com Glassmorphism */}
 <div className="relative bg-surface-raised/80 backdrop-blur-lg shadow-xl border-b border-border-default/50 rounded-lg mb-6">
 <div className={`${isMobile ? 'px-2 py-4' : 'px-4 sm:px-6 lg:px-8 py-8'}`}>
 {isMobile ? (
 /* Layout Mobile - Compacto e Vertical */
 <div className="space-y-4">
 <div className="flex items-center space-x-3">
 {onBack && (
 <button
 onClick={onBack}
 className={`${isMobile ? 'p-2' : 'p-3'} rounded-lg hover:bg-surface-base transition-all`}
 >
 <ArrowLeft className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-content-secondary`} />
 </button>
 )}
 {/* Avatar Compacto */}
 <div className="relative">
 <div className="shadow-lg ring-2 ring-white dark:ring-gray-800">
 <Avatar
 src={user.avatar}
 alt={user.name}
 name={user.name}
 size="lg"
 className={`${isMobile ? 'w-16 h-16 text-xl rounded-xl' : 'w-24 h-24 text-3xl rounded-2xl'} bg-gradient-to-br from-green-500 via-green-600 to-green-700`}
 />
 </div>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center space-x-2 mb-1">
 <h1 className={`${isMobile ? 'text-lg' : 'text-3xl'} font-bold text-content-primary truncate`}>{user.name}</h1>
 </div>
 <p className={`${isMobile ? 'text-xs' : 'text-base'} text-content-secondary truncate`}>{user.email || user.phone}</p>
 </div>
 </div>
 {/* Botéo de Logout - Mobile */}
 {onLogout && (
 <button
 onClick={onLogout}
 className="flex items-center space-x-2 px-3 py-2 rounded-lg text-content-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
 title="Sair"
 >
 <LogOut className="w-4 h-4" />
 <span className="text-xs font-medium">Sair</span>
 </button>
 )}
 </div>
 ) : (
 /* Layout Desktop - Original */
 <div className="flex items-center justify-between flex-wrap gap-6">
 <div className="flex items-center space-x-6">
 {onBack && (
 <button
 onClick={onBack}
 className="p-3 rounded-xl hover:bg-surface-base transition-all hover:scale-105"
 >
 <ArrowLeft className="w-5 h-5 text-content-secondary" />
 </button>
 )}
 {/* Avatar Grande com Gradiente */}
 <div className="relative">
 <div className="shadow-lg ring-4 ring-white dark:ring-gray-800">
 <Avatar
 src={user.avatar}
 alt={user.name}
 name={user.name}
 size="lg"
 className="w-24 h-24 text-3xl rounded-2xl bg-gradient-to-br from-green-500 via-green-600 to-green-700"
 />
 </div>
 </div>
 <div>
 <div className="flex items-center space-x-3 mb-2">
 <h1 className="text-3xl font-bold text-content-primary">{user.name}</h1>
 </div>
 <p className="text-content-secondary">{user.email || user.phone}</p>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Tabs Hidden since only overview is left */}

 {/* Content */}
 <div className={`${isMobile ? 'space-y-4' : 'space-y-8'}`}>
 <div className={`${isMobile ? 'space-y-4' : 'space-y-8'} animate-fadeIn`}>
 {/* Stats Cards com Gradientes - 2 colunas no mobile */}
 <div className={`grid ${isMobile ? 'grid-cols-2 gap-2' : 'grid-cols-1 md:grid-cols-2 gap-6'}`}>
 <StatsCard
 label="Total Gasto"
 value={`${customer?.totalSpent?.toFixed(2) || '0.00'} MT`}
 icon={TrendingUp}
 gradient="green"
 />
 <StatsCard
 label="Total de Pedidos"
 value={customer?.totalOrders || 0}
 icon={Package}
 gradient="blue"
 />
 </div>
 </div>
 </div>

 {/* Modals Hidden */}
 </div>
 </>
 );
};



