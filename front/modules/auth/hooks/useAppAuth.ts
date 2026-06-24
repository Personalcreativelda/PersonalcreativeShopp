import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { User, UserRole } from '../../core/types/types';
const BASE_PATH = '/';

interface UseAppAuthReturn {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  isAuthLoading: boolean;
  isShopMode: boolean;
  activePage: string;
  handleLogin: (user: User) => void;
  handleLogout: () => void;
  setActivePage: (page: string) => void;
  setIsShopMode: (mode: boolean) => void;
}

export const useAppAuth = (): UseAppAuthReturn => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isShopMode, setIsShopMode] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');

  const handleLogin = useCallback((user: User) => {
    setCurrentUser(user);

    // Verificar se estamos em modo loja (via URL ou estado)
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminMode = urlParams.has('admin');
    const isShopModeParam = urlParams.has('shop') || !isAdminMode;

    // Redirecionar baseado no role do usuário E modo atual
    const isClientOnly = user.role === UserRole.CLIENTE ||
      (user.roles && user.roles.length === 1 && user.roles[0] === 'CLIENTE');

    if (import.meta.env.DEV) {
      console.log('🔍 handleLogin called:', {
        email: user.email,
        role: user.role,
        roles: user.roles,
        isClientOnly,
        isAdminMode,
        isShopModeParam
      });
    }

    // Se está em modo loja OU é cliente, permanecer na loja
    if (isShopModeParam || isClientOnly) {
      if (import.meta.env.DEV) console.log('✅ Permanece na loja');
      setIsShopMode(true);
      setActivePage('shop');

      // Remover parâmetro admin da URL se existir
      try {
        const newUrl = `${window.location.origin}${BASE_PATH}`;
        window.history.replaceState({}, '', newUrl);
        if (import.meta.env.DEV) console.log('📍 URL atualizada para loja:', newUrl);
      } catch (e) {
        if (import.meta.env.DEV) console.warn('Could not update URL:', e);
      }
    } else if (isAdminMode) {
      // Admin/Staff em modo admin: ir para painel admin
      if (import.meta.env.DEV) console.log('✅ Admin/Staff em modo admin - redirecionando para painel');
      setIsShopMode(false);
      setActivePage('dashboard');
      // Atualizar URL para modo admin (usar replaceState para evitar adicionar ao histórico)
      try {
        const newUrl = `${window.location.origin}${BASE_PATH}?admin`;
        window.history.replaceState({}, '', newUrl);
        if (import.meta.env.DEV) console.log('📍 URL atualizada para admin:', newUrl);
      } catch (e) {
        // Fallback se replaceState falhar
        if (import.meta.env.DEV) console.warn('Could not update URL:', e);
      }
    } else {
      // Padrão: se é cliente vai para loja, senão para admin
      if (isClientOnly) {
        setIsShopMode(true);
        setActivePage('shop');
      } else {
        setIsShopMode(false);
        setActivePage('dashboard');
      }
    }
  }, []);

  const handleLogout = useCallback(() => {
    if (import.meta.env.DEV) console.log('🚪 Iniciando logout...');

    setCurrentUser(null);
    setIsShopMode(true);
    setActivePage('shop');

    // 1. signOut no cliente (scope: 'local' = sem chamada ao servidor)
    authService.signOut();

    // 3. Redirecionar
    const newUrl = `${window.location.origin}${BASE_PATH}`;
    window.location.href = newUrl;
  }, []);

  // Check for active session on load
  useEffect(() => {
    const checkSession = async () => {
      setIsAuthLoading(true);

      // Verificar callback OAuth do Google (pode estar em hash ou query params)
      const urlParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const hasOAuthCallback = hash.includes('access_token') || hash.includes('code') || urlParams.get('code');

      if (hasOAuthCallback) {
        if (import.meta.env.DEV) console.log('OAuth callback detected, processing...');

        // Aguardar mais tempo para o Supabase processar completamente o hash fragment
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Processar callback OAuth
        const { user, error } = await authService.handleOAuthCallback();

        if (user) {
          if (import.meta.env.DEV) {
            console.log('OAuth login successful:', user.email);
            console.log('User role:', user.role);
            console.log('User roles:', user.roles);
          }

          // Verificar se é cliente antes de fazer login
          const isClientOnly = user.role === UserRole.CLIENTE ||
            (user.roles && user.roles.length === 1 && user.roles[0] === 'CLIENTE');

          if (import.meta.env.DEV) console.log('Is client only?', isClientOnly);

          // Verificar modo atual da URL
          const isAdminModeParam = urlParams.has('admin');
          const isShopModeParam = urlParams.has('shop') || !isAdminModeParam;

          // Se for cliente OU estiver em modo loja, ir para loja
          if (isClientOnly || isShopModeParam) {
            setIsShopMode(true);
            setActivePage('shop');
          }

          handleLogin(user);

          // Limpar URL dos parâmetros OAuth
          try {
            if (isClientOnly || isShopModeParam) {
              // Cliente ou modo loja: navegar para loja
              navigate('/');
            } else {
              // Admin/Staff em modo admin: navegar para admin
              navigate('/admin');
            }
          } catch (e) {
            if (import.meta.env.DEV) console.warn('Could not clean OAuth URL:', e);
          }
        } else if (error) {
          console.error('OAuth error:', error);
          // Navegar baseado no modo
          if (urlParams.has('admin')) {
            navigate('/admin');
          } else {
            navigate('/');
          }
        } else {
          // Ainda processando, tentar novamente após um delay
          if (import.meta.env.DEV) console.log('OAuth still processing, retrying...');
          setTimeout(async () => {
            const { user: retryUser, error: retryError } = await authService.handleOAuthCallback();
            if (retryUser) {
              handleLogin(retryUser);
            } else if (retryError) {
              // Error handling would need toast here, but we'll leave it for now
            }
          }, 2000);
        }
        setIsAuthLoading(false);
        return;
      }

      // Verificar se está em modo admin (via hash ou query param)
      const adminMode = hash === '#admin' || urlParams.has('admin');

      // Verificar se há usuário logado primeiro
      const user = await authService.getCurrentUser();

      if (user) {
        // Se há usuário logado, verificar se é cliente
        const isClientOnly = user.role === UserRole.CLIENTE ||
          (user.roles && user.roles.length === 1 && user.roles[0] === 'CLIENTE');

        // Verificar se há parâmetro shop na URL (força modo loja)
        const shopModeParam = urlParams.has('shop');

        if (isClientOnly) {
          // Cliente: sempre mostrar loja, mesmo se URL tiver ?admin
          if (import.meta.env.DEV) console.log('👤 Cliente logado - forçando modo loja');
          setIsShopMode(true);
          setCurrentUser(user);

          // Remover parâmetro admin se existir
          if (adminMode) {
            try {
              const newUrl = `${window.location.origin}${window.location.pathname}`;
              window.history.replaceState({}, '', newUrl);
            } catch (e) {
              if (import.meta.env.DEV) console.warn('Could not remove admin param:', e);
            }
          }
        } else if (shopModeParam || !adminMode) {
          // Admin/Staff em modo loja OU sem parâmetro admin: mostrar loja
          setIsShopMode(true);
          setActivePage('shop');
          setCurrentUser(user);

          // Remover parâmetro admin se existir
          if (adminMode) {
            try {
              const newUrl = `${window.location.origin}${window.location.pathname}`;
              window.history.replaceState({}, '', newUrl);
            } catch (e) {
              if (import.meta.env.DEV) console.warn('Could not remove admin param:', e);
            }
          }
        } else {
          // Admin/Staff em modo admin: ir para painel admin
          setIsShopMode(false);
          setActivePage('dashboard');
          setCurrentUser(user);

          // Garantir que URL tem parâmetro admin
          if (!adminMode) {
            try {
              const newUrl = `${window.location.origin}${window.location.pathname}?admin`;
              window.history.replaceState({}, '', newUrl);
            } catch (e) {
              if (import.meta.env.DEV) console.warn('Could not add admin param:', e);
            }
          }
        }
      } else {
        // Sem usuário logado: SEMPRE mostrar loja, independente do modo admin
        if (import.meta.env.DEV) console.log('👤 Nenhum usuário logado - forçando modo loja');
        setIsShopMode(true);
        setActivePage('shop');

        // Remover qualquer parâmetro admin da URL
        if (adminMode) {
          try {
            const newUrl = `${window.location.origin}${window.location.pathname}`;
            window.history.replaceState({}, '', newUrl);
            if (import.meta.env.DEV) console.log('✅ Parâmetro admin removido da URL após logout');
          } catch (e) {
            if (import.meta.env.DEV) console.warn('Could not remove admin param:', e);
          }
        }
      }

      setIsAuthLoading(false);
    };
    checkSession();
  }, [handleLogin, navigate]);

  // Sessão infinita: não há timeout por inatividade nem logout periódico.
  // A sessão só termina com logout manual ou quando o Supabase invalidar (ex.: refresh token expirado no servidor).
  // O cliente Supabase já usa autoRefreshToken: true para renovar o JWT automaticamente.

  return {
    currentUser,
    setCurrentUser,
    isAuthLoading,
    isShopMode,
    activePage,
    handleLogin,
    handleLogout,
    setActivePage,
    setIsShopMode
  };
};
