import React from 'react';
import { RefreshCw } from 'lucide-react';

interface UpdateBannerProps {
 onUpdate: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ onUpdate }) => {
 return (
 <div className="fixed top-0 left-0 right-0 z-[9999] bg-brand-600 text-white shadow-md animate-fade-in-up">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
 <div className="flex items-center space-x-3 flex-1">
 <div className="p-2 bg-surface-raised/20 rounded-full flex-shrink-0">
 <RefreshCw className="w-5 h-5 text-white" />
 </div>
 <p className="text-sm font-medium">
 Uma nova versão da aplicação está disponível.
 <span className="hidden sm:inline"> Atualize para receber as últimas funcionalidades e correções.</span>
 </p>
 </div>
 <button
 onClick={onUpdate}
 className="flex-shrink-0 w-full sm:w-auto px-6 py-2 bg-surface-raised text-brand-600 hover:bg-brand-50 
 text-sm font-semibold rounded-lg shadow-sm transition-colors duration-200 
 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500
 focus:ring-offset-brand-600"
 >
 Atualizar Agora
 </button>
 </div>
 </div>
 );
};
