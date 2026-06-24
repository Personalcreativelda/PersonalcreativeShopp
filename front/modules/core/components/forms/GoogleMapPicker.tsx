import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, Navigation, X, Loader2 } from 'lucide-react';
import { useGoogleMaps } from '../../../core/hooks/useGoogleMaps';

interface GoogleMapPickerProps {
 onLocationSelect: (location: {
 lat: number;
 lng: number;
 address: string;
 }) => void;
 initialLat?: number;
 initialLng?: number;
 initialAddress?: string;
 height?: string;
 className?: string;
 showSearch?: boolean;
 showGeolocation?: boolean;
 zoom?: number;
}

// Coordenadas padréo de Maputo, Moçambique
const DEFAULT_CENTER = {
 lat: -25.969248,
 lng: 32.573230
};

const DEFAULT_ZOOM = 13;

const mapContainerStyle = {
 width: '100%',
 height: '400px'
};

export const GoogleMapPicker: React.FC<GoogleMapPickerProps> = ({
 onLocationSelect,
 initialLat,
 initialLng,
 initialAddress,
 height = '400px',
 className = '',
 showSearch = true,
 showGeolocation = true,
 zoom = DEFAULT_ZOOM
}) => {
 const { isLoaded, loadError, geocode, reverseGeocode } = useGoogleMaps();
 const [map, setMap] = useState<google.maps.Map | null>(null);
 const [selectedLocation, setSelectedLocation] = useState<{
 lat: number;
 lng: number;
 address: string;
 } | null>(null);
 const [searchQuery, setSearchQuery] = useState(initialAddress || '');
 const [isSearching, setIsSearching] = useState(false);
 const [isGettingLocation, setIsGettingLocation] = useState(false);
 const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
 const [infoWindowOpen, setInfoWindowOpen] = useState(false);
 const mapRef = useRef<google.maps.Map | null>(null);
 const markerRef = useRef<google.maps.Marker | null>(null);
 const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
 const mapContainerRef = useRef<HTMLDivElement>(null);

 // Inicializar com Localização inicial se fornecida
 useEffect(() => {
 if (initialLat && initialLng) {
 const location = {
 lat: initialLat,
 lng: initialLng,
 address: initialAddress || ''
 };
 setSelectedLocation(location);
 setMarkerPosition({ lat: initialLat, lng: initialLng });
 
 // Buscar endereço se néo foi fornecido
 if (!initialAddress && isLoaded) {
 reverseGeocode(initialLat, initialLng).then(address => {
 if (address) {
 setSelectedLocation({ lat: initialLat, lng: initialLng, address });
 setSearchQuery(address);
 }
 });
 }
 }
 }, [initialLat, initialLng, initialAddress, isLoaded, reverseGeocode]);

 // Inicializar mapa quando Google Maps estiver carregado
 useEffect(() => {
 if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

 const center = initialLat && initialLng 
 ? { lat: initialLat, lng: initialLng } 
 : DEFAULT_CENTER;

 const mapInstance = new google.maps.Map(mapContainerRef.current, {
 center,
 zoom: zoom,
 streetViewControl: false,
 mapTypeControl: false,
 fullscreenControl: true,
 zoomControl: true,
 gestureHandling: 'cooperative'
 });

 mapRef.current = mapInstance;
 setMap(mapInstance);

 // Event listener para clique no mapa
 mapInstance.addListener('click', (event: google.maps.MapMouseEvent) => {
 if (event.latLng) {
 onMapClick({ latLng: event.latLng } as any);
 }
 });

 // Criar marcador se tiver posiçéo inicial
 if (initialLat && initialLng) {
 const marker = new google.maps.Marker({
 position: { lat: initialLat, lng: initialLng },
 map: mapInstance,
 draggable: true,
 icon: {
 url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
 scaledSize: new google.maps.Size(40, 40)
 }
 });

 markerRef.current = marker;

 marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
 if (event.latLng) {
 onMapClick({ latLng: event.latLng } as any);
 }
 });
 }
 }, [isLoaded, initialLat, initialLng, zoom]);

 const onMapClick = useCallback(async (event: { latLng: google.maps.LatLng }) => {
 if (!event.latLng || !mapRef.current) return;
 
 const lat = event.latLng.lat();
 const lng = event.latLng.lng();
 
 setMarkerPosition({ lat, lng });
 setInfoWindowOpen(true);
 setIsGettingLocation(true);
 
 // Atualizar ou criar marcador
 if (markerRef.current) {
 markerRef.current.setPosition({ lat, lng });
 } else if (mapRef.current) {
 const marker = new google.maps.Marker({
 position: { lat, lng },
 map: mapRef.current,
 draggable: true,
 icon: {
 url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
 scaledSize: new google.maps.Size(40, 40)
 }
 });

 marker.addListener('dragend', (dragEvent: google.maps.MapMouseEvent) => {
 if (dragEvent.latLng) {
 onMapClick({ latLng: dragEvent.latLng });
 }
 });

 markerRef.current = marker;
 }
 
 try {
 const address = await reverseGeocode(lat, lng);
 const location = {
 lat,
 lng,
 address: address || `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`
 };
 
 setSelectedLocation(location);
 setSearchQuery(location.address);
 onLocationSelect(location);

 // Mostrar InfoWindow
 if (markerRef.current && !infoWindowRef.current) {
 infoWindowRef.current = new google.maps.InfoWindow();
 }

 if (infoWindowRef.current && markerRef.current) {
 infoWindowRef.current.setContent(`
 <div class="p-2 max-w-xs">
 <p class="font-semibold text-sm mb-1">
 <strong>Localização selecionada</strong>
 </p>
 <p class="text-xs text-content-secondary mb-1">${location.address}</p>
 <p class="text-xs text-content-muted">${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
 </div>
 `);
 infoWindowRef.current.open(mapRef.current, markerRef.current);
 }
 } catch (error) {
 console.error('Erro ao obter endereço:', error);
 } finally {
 setIsGettingLocation(false);
 }
 }, [reverseGeocode, onLocationSelect]);

 const handleSearch = async () => {
 if (!searchQuery.trim() || !isLoaded) return;
 
 setIsSearching(true);
 try {
 const result = await geocode(searchQuery);
 
 if (result && mapRef.current) {
 const location = {
 lat: result.lat,
 lng: result.lng,
 address: result.formatted
 };
 
 setSelectedLocation(location);
 setMarkerPosition({ lat: result.lat, lng: result.lng });
 setSearchQuery(result.formatted);
 setInfoWindowOpen(true);
 
 // Centralizar mapa no local encontrado
 mapRef.current.setCenter({ lat: result.lat, lng: result.lng });
 mapRef.current.setZoom(15);
 
 // Atualizar ou criar marcador
 if (markerRef.current) {
 markerRef.current.setPosition({ lat: result.lat, lng: result.lng });
 } else {
 const marker = new google.maps.Marker({
 position: { lat: result.lat, lng: result.lng },
 map: mapRef.current,
 draggable: true,
 icon: {
 url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
 scaledSize: new google.maps.Size(40, 40)
 }
 });

 marker.addListener('dragend', (dragEvent: google.maps.MapMouseEvent) => {
 if (dragEvent.latLng) {
 onMapClick({ latLng: dragEvent.latLng });
 }
 });

 markerRef.current = marker;
 }

 // Mostrar InfoWindow
 if (!infoWindowRef.current) {
 infoWindowRef.current = new google.maps.InfoWindow();
 }

 if (infoWindowRef.current && markerRef.current) {
 infoWindowRef.current.setContent(`
 <div class="p-2 max-w-xs">
 <p class="font-semibold text-sm mb-1">
 <strong>Localização selecionada</strong>
 </p>
 <p class="text-xs text-content-secondary mb-1">${location.address}</p>
 <p class="text-xs text-content-muted">${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}</p>
 </div>
 `);
 infoWindowRef.current.open(mapRef.current, markerRef.current);
 }
 
 onLocationSelect(location);
 } else {
 alert('Localização néo encontrada. Tente novamente com um endereço mais especé­fico.');
 }
 } catch (error) {
 console.error('Erro na busca:', error);
 alert('Erro ao buscar Localização. Tente novamente.');
 } finally {
 setIsSearching(false);
 }
 };

 const handleGetCurrentLocation = () => {
 if (!navigator.geolocation) {
 alert('GeoLocalização néo é© suportada pelo seu navegador.');
 return;
 }
 
 setIsGettingLocation(true);
 navigator.geolocation.getCurrentPosition(
 async (position) => {
 const lat = position.coords.latitude;
 const lng = position.coords.longitude;
 
 setMarkerPosition({ lat, lng });
 setInfoWindowOpen(true);
 
 try {
 const address = await reverseGeocode(lat, lng);
 const location = {
 lat,
 lng,
 address: address || `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`
 };
 
 setSelectedLocation(location);
 setSearchQuery(location.address);
 
 if (mapRef.current) {
 mapRef.current.setCenter({ lat, lng });
 mapRef.current.setZoom(15);
 }
 
 onLocationSelect(location);
 } catch (error) {
 console.error('Erro ao obter endereço:', error);
 } finally {
 setIsGettingLocation(false);
 }
 },
 (error) => {
 console.error('Erro na geoLocalização:', error);
 alert('Néo foi possé­vel obter sua Localização. Verifique as permisséµes do navegador.');
 setIsGettingLocation(false);
 },
 {
 enableHighAccuracy: true,
 timeout: 10000,
 maximumAge: 0
 }
 );
 };

 const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

 if (!apiKey) {
 return (
 <div className={`bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 ${className}`}>
 <p className="text-yellow-800 dark:text-yellow-200 text-sm">
 âš ï¸ Chave da API do Google Maps néo configurada. Configure a varié¡vel VITE_GOOGLE_MAPS_API_KEY no arquivo .env
 </p>
 </div>
 );
 }

 if (loadError) {
 return (
 <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}>
 <p className="text-red-800 dark:text-red-200 text-sm">
 âŒ Erro ao carregar Google Maps: {loadError.message}
 </p>
 </div>
 );
 }

 if (!isLoaded) {
 return (
 <div className={`bg-surface-base rounded-lg p-8 flex items-center justify-center ${className}`} style={{ height }}>
 <div className="text-center">
 <Loader2 className="h-8 w-8 animate-spin text-green-600 dark:text-green-400 mx-auto mb-2" />
 <p className="text-content-secondary">Carregando mapa...</p>
 </div>
 </div>
 );
 }

 const mapStyle = {
 ...mapContainerStyle,
 height
 };

 const center = markerPosition || (initialLat && initialLng ? { lat: initialLat, lng: initialLng } : DEFAULT_CENTER);

 return (
 <div className={`space-y-3 ${className}`}>
 {/* Barra de pesquisa */}
 {showSearch && (
 <div className="flex gap-2">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-content-muted" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 onKeyPress={(e) => {
 if (e.key === 'Enter') {
 handleSearch();
 }
 }}
 placeholder="Buscar endereço ou Localização..."
 className="w-full pl-10 pr-4 py-2 border-2 border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-green-500 dark:focus:border-green-400"
 />
 {searchQuery && (
 <button
 onClick={() => {
 setSearchQuery('');
 setSelectedLocation(null);
 setMarkerPosition(null);
 setInfoWindowOpen(false);
 }}
 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-content-muted hover:text-content-secondary "
 >
 <X className="h-4 w-4" />
 </button>
 )}
 </div>
 <button
 onClick={handleSearch}
 disabled={isSearching || !searchQuery.trim()}
 className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
 >
 {isSearching ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <Search className="h-4 w-4" />
 )}
 Buscar
 </button>
 {showGeolocation && (
 <button
 onClick={handleGetCurrentLocation}
 disabled={isGettingLocation}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
 title="Usar minha Localização atual"
 >
 {isGettingLocation ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <Navigation className="h-4 w-4" />
 )}
 </button>
 )}
 </div>
 )}

 {/* Mapa */}
 <div 
 id="map-container"
 className="border-2 border-border-default rounded-lg overflow-hidden"
 ref={mapContainerRef}
 style={mapStyle}
 />

 {/* Informaçéo da Localização selecionada */}
 {selectedLocation && (
 <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
 <div className="flex items-start gap-2">
 <MapPin className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-green-900 dark:text-green-100">
 Localização selecionada:
 </p>
 <p className="text-sm text-green-800 dark:text-green-200 mt-1 break-words">
 {selectedLocation.address}
 </p>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};


