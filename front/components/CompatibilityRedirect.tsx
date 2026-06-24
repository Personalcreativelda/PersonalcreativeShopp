import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Componente para redirecionar query params antigos para novas rotas
 * Mantém compatibilidade com URLs antigas
 */
export const CompatibilityRedirect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    
    // Redirecionar ?sobre-nos para /loja
    if (params.has('sobre-nos')) {
      navigate('/loja', { replace: true });
      return;
    }

    // Redirecionar ?admin para /admin
    if (params.has('admin')) {
      navigate('/admin', { replace: true });
      return;
    }

    // Redirecionar ?shop para /loja
    if (params.has('shop')) {
      navigate('/loja', { replace: true });
      return;
    }

    // Redirecionar ?series para /loja
    if (params.has('series')) {
      navigate('/loja', { replace: true });
      return;
    }
  }, [location.search, navigate]);

  return null;
};
