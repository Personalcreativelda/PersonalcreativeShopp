import { useState, useEffect, useCallback } from 'react';

// Frequência de verificação em milissegundos (ex: 15 minutos)
const CHECK_INTERVAL = 15 * 60 * 1000;

export const useVersionCheck = () => {
  const [hasUpdate, setHasUpdate] = useState(false);

  const checkForUpdate = useCallback(async () => {
    // Não executa a verificação no ambiente de desenvolvimento (vite injecta __APP_VERSION__ como string)
    if (import.meta.env.DEV) return;

    try {
      // Adiciona um timestamp na query string para contornar cache do browser
      const response = await fetch(`/version.json?t=${Date.now()}`);
      
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const serverVersion = data.version;

      // Compara a versão do servidor com a versão que foi injetada no build
      if (serverVersion && typeof __APP_VERSION__ !== 'undefined') {
        if (serverVersion !== __APP_VERSION__) {
          setHasUpdate(true);
        }
      }
    } catch (error) {
      console.warn('Erro ao verificar nova versão:', error);
    }
  }, []);

  useEffect(() => {
    // Verifica log que a app monta
    checkForUpdate();

    // Verifica a cada intervalo (ex: 15 min)
    const intervalId = setInterval(checkForUpdate, CHECK_INTERVAL);

    // Verifica sempre que o browser volta a ganhar foco (user muda de tab e volta)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    const handleFocus = () => {
      checkForUpdate();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForUpdate]);

  const updateApp = () => {
    // Força o reload limpando a cache
    window.location.reload();
  };

  return { hasUpdate, updateApp };
};
