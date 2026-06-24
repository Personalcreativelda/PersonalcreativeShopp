import { useState, useEffect } from 'react';
import { authService } from '../../auth/services/authService';
import { type User } from '../../core/types/types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Escutar mudanças na sessão do Supabase
    const checkSession = async () => {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    };

    // Verificar sessão periodicamente (a cada 30 segundos)
    const interval = setInterval(checkSession, 30000);

    return () => clearInterval(interval);
  }, []);

  return { user, loading };
};



