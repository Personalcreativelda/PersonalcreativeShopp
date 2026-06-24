import { useState, useEffect, useCallback } from 'react';

interface UseGoogleMapsReturn {
  isLoaded: boolean;
  loadError: Error | null;
  geocode: (address: string) => Promise<{ lat: number; lng: number; formatted: string } | null>;
  reverseGeocode: (lat: number, lng: number) => Promise<string | null>;
  getDistance: (lat1: number, lng1: number, lat2: number, lng2: number) => number;
}

// Cache para resultados de geocodificaçéo
const geocodeCache: Map<string, { lat: number; lng: number; formatted: string; timestamp: number }> = new Map();
const reverseGeocodeCache: Map<string, { address: string; timestamp: number }> = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

export const useGoogleMaps = (): UseGoogleMapsReturn => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setLoadError(new Error('Chave da API do Google Maps néo configurada (VITE_GOOGLE_MAPS_API_KEY)'));
      return;
    }

    // Verificar se o Google Maps jé¡ esté¡ carregado
    if (window.google && window.google.maps) {
      setGeocoder(new google.maps.Geocoder());
      setIsLoaded(true);
      return;
    }

    // Carregar o script do Google Maps
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    
    if (existingScript) {
      // Script jé¡ existe, aguardar carregamento
      const checkLoaded = setInterval(() => {
        if (window.google && window.google.maps) {
          setGeocoder(new google.maps.Geocoder());
          setIsLoaded(true);
          setLoadError(null);
          clearInterval(checkLoaded);
        }
      }, 100);

      return () => clearInterval(checkLoaded);
    }

    // Criar novo script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && window.google.maps) {
        setGeocoder(new google.maps.Geocoder());
        setIsLoaded(true);
        setLoadError(null);
      } else {
        setLoadError(new Error('Falha ao carregar Google Maps'));
      }
    };

    script.onerror = () => {
      setLoadError(new Error('Erro ao carregar script do Google Maps'));
    };

    document.head.appendChild(script);

    return () => {
      // Néo remover o script ao desmontar, pode ser usado por outros componentes
    };
  }, []);

  const geocode = useCallback(async (address: string): Promise<{ lat: number; lng: number; formatted: string } | null> => {
    if (!geocoder || !isLoaded) {
      console.warn('Google Maps néo esté¡ carregado ainda');
      return null;
    }

    // Verificar cache
    const cacheKey = address.toLowerCase().trim();
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return { lat: cached.lat, lng: cached.lng, formatted: cached.formatted };
    }

    try {
      return new Promise((resolve) => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            const location = results[0].geometry.location;
            const formatted = results[0].formatted_address;
            const result = {
              lat: location.lat(),
              lng: location.lng(),
              formatted
            };
            
            // Salvar no cache
            geocodeCache.set(cacheKey, { ...result, timestamp: Date.now() });
            resolve(result);
          } else {
            console.warn('Geocodificaçéo falhou:', status, address);
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Erro na geocodificaçéo:', error);
      return null;
    }
  }, [geocoder, isLoaded]);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    if (!geocoder || !isLoaded) {
      console.warn('Google Maps néo esté¡ carregado ainda');
      return null;
    }

    // Verificar cache
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const cached = reverseGeocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.address;
    }

    try {
      return new Promise((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            const address = results[0].formatted_address;
            
            // Salvar no cache
            reverseGeocodeCache.set(cacheKey, { address, timestamp: Date.now() });
            resolve(address);
          } else {
            console.warn('Geocodificaçéo reversa falhou:', status);
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Erro na geocodificaçéo reversa:', error);
      return null;
    }
  }, [geocoder, isLoaded]);

  const getDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    if (!window.google || !window.google.maps) {
      // Fallback para cé¡lculo de disté¢ncia usando fé³rmula de Haversine
      const R = 6371; // Raio da Terra em km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const point1 = new google.maps.LatLng(lat1, lng1);
    const point2 = new google.maps.LatLng(lat2, lng2);
    return google.maps.geometry.spherical.computeDistanceBetween(point1, point2) / 1000; // Converter para km
  }, []);

  return {
    isLoaded,
    loadError,
    geocode,
    reverseGeocode,
    getDistance
  };
};

// Declaraçéo de tipos para window.google
declare global {
  interface Window {
    google: typeof google;
  }
}


