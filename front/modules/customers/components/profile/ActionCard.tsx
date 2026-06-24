import React, { useState } from 'react';
import { customerProfileService } from '../../services/customerProfileService';
import { CheckCircle, Circle, Gift, Loader2 } from 'lucide-react';
import { CustomerActionType } from '../../../core/types/types';
import { Toast } from '../ui/Toast';

interface ActionCardProps {
 action: {
 id: string;
 type: string;
 title: string;
 description: string;
 points: number;
 completed: boolean;
 };
 customerId?: string;
 onComplete?: () => void;
 showToast?: (message: string, type: Toast['type'], duration?: number) => void;
 onCompleteProfile?: () => void;
 onShareProduct?: () => void;
 onReviewProduct?: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
 action,
 customerId,
 onComplete,
 showToast,
 onCompleteProfile,
 onShareProduct,
 onReviewProduct
}) => {
 const [isLoading, setIsLoading] = useState(false);

 const handleComplete = async () => {
 if (!customerId || action.completed || isLoading) return;

 setIsLoading(true);
 try {
 // Lé³gica especé­fica baseada no tipo
 if (action.type === 'completar_perfil' && onCompleteProfile) {
 onCompleteProfile();
 setIsLoading(false);
 return;
 } else if (action.type === 'partilhar_produto' && onShareProduct) {
 onShareProduct();
 setIsLoading(false);
 return;
 } else if (action.type === 'avaliar_produto' && onReviewProduct) {
 onReviewProduct();
 setIsLoading(false);
 return;
 }

 // Açéo gené©rica
 const result = await customerProfileService.recordAction(
 customerId,
 action.type as CustomerActionType,
 action.points
 );

 if (result) {
 showToast?.(`Açéo completada! Ganhou ${action.points} pontos.`, 'success');
 onComplete?.();
 } else {
 showToast?.('Erro ao completar açéo. Tente novamente.', 'error');
 }
 } catch (error: any) {
 console.error('Erro ao completar açéo:', error);
 const errorMessage = error?.message || 'Erro ao completar açéo. Tente novamente.';
 showToast?.(errorMessage, 'error');
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <div
 className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 overflow-hidden ${action.completed
 ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-400 shadow-lg'
 : 'bg-surface-raised border-border-default hover:border-green-500 hover:shadow-xl hover:scale-105'
 }`}
 >
 {/* Gradient overlay on hover */}
 {!action.completed && (
 <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
 )}

 <div className="relative z-10">
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1">
 <div className="flex items-center space-x-3 mb-2">
 <div className={`p-2 rounded-lg ${action.completed
 ? 'bg-green-500 text-white'
 : 'bg-surface-base text-content-muted group-hover:bg-green-100 group-hover:text-green-600 dark:group-hover:bg-green-900/30 dark:group-hover:text-green-400 transition-colors'
 }`}>
 {action.completed ? (
 <CheckCircle className="w-5 h-5" />
 ) : (
 <Circle className="w-5 h-5" />
 )}
 </div>
 <h3 className="font-bold text-lg text-content-primary">
 {action.title}
 </h3>
 </div>
 <p className="text-sm text-content-secondary ml-11">
 {action.description}
 </p>
 </div>
 </div>
 <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-default">
 <div className="flex items-center space-x-2">
 <div className="p-1.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
 <Gift className="w-4 h-4 text-white" />
 </div>
 <span className="font-bold text-green-600 dark:text-green-400">{action.points} pontos</span>
 </div>
 {!action.completed && (
 <button
 onClick={handleComplete}
 disabled={isLoading}
 className="px-5 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl text-sm font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center space-x-2"
 >
 {isLoading ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 <span>Processando...</span>
 </>
 ) : (
 <span>Completar</span>
 )}
 </button>
 )}
 </div>
 </div>
 </div>
 );
};



