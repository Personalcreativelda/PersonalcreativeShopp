import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
 id: string;
 message: string;
 type: ToastType;
 duration?: number;
}

interface ToastProps {
 toast: Toast;
 onClose: (id: string) => void;
}

export const ToastComponent: React.FC<ToastProps> = ({ toast, onClose }) => {
 const [progress, setProgress] = useState(100);
 const duration = toast.duration || 5000;

 useEffect(() => {
 const timer = setTimeout(() => {
 onClose(toast.id);
 }, duration);

 // Animaçéo de progresso
 const interval = setInterval(() => {
 setProgress((prev) => {
 const newProgress = prev - (100 / (duration / 100));
 return newProgress <= 0 ? 0 : newProgress;
 });
 }, 100);

 return () => {
 clearTimeout(timer);
 clearInterval(interval);
 };
 }, [toast.id, duration, onClose]);

 const icons = {
 success: <CheckCircle className="w-5 h-5" />,
 error: <XCircle className="w-5 h-5" />,
 warning: <AlertCircle className="w-5 h-5" />,
 info: <Info className="w-5 h-5" />
 };

 const iconColors = {
 success: 'text-green-600 dark:text-green-400',
 error: 'text-red-600 dark:text-red-400',
 warning: 'text-yellow-600 dark:text-yellow-400',
 info: 'text-blue-600 dark:text-blue-400'
 };

 const colors = {
 success: 'bg-surface-raised border-l-green-500 dark:border-l-green-400 text-content-primary',
 error: 'bg-surface-raised border-l-red-500 dark:border-l-red-400 text-content-primary',
 warning: 'bg-surface-raised border-l-yellow-500 dark:border-l-yellow-400 text-content-primary',
 info: 'bg-surface-raised border-l-blue-500 dark:border-l-blue-400 text-content-primary'
 };

 const progressColors = {
 success: 'bg-green-500',
 error: 'bg-red-500',
 warning: 'bg-yellow-500',
 info: 'bg-blue-500'
 };

 return (
 <div 
 className={`${colors[toast.type]} border-l-4 rounded-xl p-4 shadow-2xl flex flex-col min-w-[320px] max-w-md mb-3 transform transition-all duration-300 ease-out relative overflow-hidden`}
 style={{
 animation: 'slideInUp 0.3s ease-out',
 }}
 >
 <style dangerouslySetInnerHTML={{__html: `
 @keyframes slideInUp {
 from {
 transform: translateY(100%);
 opacity: 0;
 }
 to {
 transform: translateY(0);
 opacity: 1;
 }
 }
 `}} />
 
 {/* Barra de progresso */}
 <div className="absolute top-0 left-0 right-0 h-1 bg-surface-base">
 <div 
 className={`h-full ${progressColors[toast.type]} transition-all duration-100 ease-linear`}
 style={{ width: `${progress}%` }}
 />
 </div>

 <div className="flex items-start gap-3 pt-1">
 <div className={`flex-shrink-0 mt-0.5 ${iconColors[toast.type]}`}>
 {icons[toast.type]}
 </div>
 <div className="flex-1 text-sm font-medium leading-relaxed">
 {toast.message}
 </div>
 <button
 onClick={() => onClose(toast.id)}
 className="flex-shrink-0 text-content-muted hover:text-content-secondary transition-colors p-1 rounded-lg hover:bg-surface-base"
 aria-label="Fechar notificaçéo"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 );
};

interface ToastContainerProps {
 toasts: Toast[];
 onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
 if (toasts.length === 0) return null;

 return (
 <div className="fixed bottom-4 right-4 z-[9999] space-y-2 pointer-events-none">
 {toasts.map(toast => (
 <div key={toast.id} className="pointer-events-auto">
 <ToastComponent toast={toast} onClose={onClose} />
 </div>
 ))}
 </div>
 );
};


