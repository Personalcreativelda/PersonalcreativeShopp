import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastContainer, Toast, ToastType } from '../components/ui/Toast';

interface ToastContextType {
 showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
 const [toasts, setToasts] = useState<Toast[]>([]);

 const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
 const id = `toast-${Date.now()}-${Math.random()}`;
 setToasts(prev => [...prev, { id, message, type, duration }]);
 }, []);

 const removeToast = useCallback((id: string) => {
 setToasts(prev => prev.filter(t => t.id !== id));
 }, []);

 return (
 <ToastContext.Provider value={{ showToast }}>
 {children}
 <ToastContainer toasts={toasts} onClose={removeToast} />
 </ToastContext.Provider>
 );
};

export const useToast = (): ToastContextType => {
 const context = useContext(ToastContext);
 if (!context) {
 throw new Error('useToast must be used within ToastProvider');
 }
 return context;
};
