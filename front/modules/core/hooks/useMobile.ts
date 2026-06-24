import { useState, useEffect } from 'react';

/**
 * Hook para detectar se o dispositivo é© mobile
 * @param breakpoint - Breakpoint em pixels (padréo: 768px)
 * @returns boolean - true se for mobile
 */
export const useMobile = (breakpoint: number = 768): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
};


