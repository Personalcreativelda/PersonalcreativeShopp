import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, ChevronDown, Loader2, X } from 'lucide-react';
import { DeliveryZone } from '../../../core/types/types';
import { deliveryService } from '../../../sales/services/deliveryService';
import { normalizeForSearch } from '../../../core/services/serviceUtils';

interface DeliveryZoneSelectorProps {
 selectedZoneId?: string;
 selectedZoneName?: string;
 onZoneSelect: (zone: DeliveryZone | null) => void;
 className?: string;
 disabled?: boolean;
 showPrice?: boolean;
}

export const DeliveryZoneSelector: React.FC<DeliveryZoneSelectorProps> = ({
 selectedZoneId,
 selectedZoneName,
 onZoneSelect,
 className = '',
 disabled = false,
 showPrice = true
}) => {
 const [zones, setZones] = useState<DeliveryZone[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isOpen, setIsOpen] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');

 useEffect(() => {
 loadZones();
 }, []);

 const loadZones = async () => {
 setIsLoading(true);
 try {
 const loadedZones = await deliveryService.getDeliveryZones();
 setZones(loadedZones);
 if (loadedZones.length === 0) {
 console.warn('Nenhuma zona de entrega encontrada. Verifique se hé¡ zonas ativas no banco de dados e se as polé­ticas RLS permitem leitura.');
 }
 } catch (error) {
 console.error('Erro ao carregar zonas de entrega:', error);
 setZones([]);
 } finally {
 setIsLoading(false);
 }
 };

 const selectedZone = useMemo(() => {
 if (selectedZoneId) {
 return zones.find(z => z.id === selectedZoneId) || null;
 }
 if (selectedZoneName) {
 return zones.find(z => z.name.toLowerCase() === selectedZoneName.toLowerCase()) || null;
 }
 return null;
 }, [zones, selectedZoneId, selectedZoneName]);

 const filteredZones = useMemo(() => {
 if (!searchQuery.trim()) return zones;
 
 const query = normalizeForSearch(searchQuery);
 return zones.filter(zone => 
 normalizeForSearch(zone.name).includes(query)
 );
 }, [zones, searchQuery]);

 const handleZoneSelect = (zone: DeliveryZone) => {
 onZoneSelect(zone);
 setIsOpen(false);
 setSearchQuery('');
 };

 const handleClear = () => {
 onZoneSelect(null);
 setIsOpen(false);
 setSearchQuery('');
 };

 if (isLoading) {
 return (
 <div className={`relative ${className}`}>
 <div className="w-full px-4 py-2 border-2 border-border-default rounded-lg bg-surface-raised flex items-center justify-center">
 <Loader2 className="h-5 w-5 animate-spin text-green-600 dark:text-green-400" />
 <span className="ml-2 text-content-secondary">Carregando zonas...</span>
 </div>
 </div>
 );
 }

 return (
 <div className={`relative ${className}`}>
 {/* Botéo de seleçéo */}
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => !disabled && setIsOpen(!isOpen)}
 disabled={disabled}
 className={`
 flex-1 px-4 py-2.5 border-2 rounded-lg 
 bg-surface-raised 
 text-left flex items-center justify-between
 transition-colors
 ${disabled 
 ? 'border-border-default text-content-muted cursor-not-allowed' 
 : selectedZone
 ? 'border-green-500 dark:border-green-500 text-content-primary hover:border-green-600 dark:hover:border-green-400'
 : 'border-border-default text-content-primary hover:border-green-500 dark:hover:border-green-500'
 }
 `}
 >
 <div className="flex items-center flex-1 min-w-0">
 <MapPin className={`h-5 w-5 mr-2 flex-shrink-0 ${selectedZone ? 'text-green-600 dark:text-green-400' : 'text-content-muted'}`} />
 <span className="truncate">
 {selectedZone ? (
 <>
 <span className="font-medium">{selectedZone.name}</span>
 {showPrice && (
 <span className="ml-2 text-green-600 dark:text-green-400 font-semibold">
 ({selectedZone.price} MT)
 </span>
 )}
 </>
 ) : (
 <span className="text-content-muted">Selecione a zona de entrega</span>
 )}
 </span>
 </div>
 <ChevronDown className={`h-5 w-5 flex-shrink-0 transition-transform ${isOpen ? 'transform rotate-180' : ''} ${disabled ? 'text-content-muted' : 'text-content-muted'}`} />
 </button>
 {selectedZone && !disabled && (
 <button
 type="button"
 onClick={handleClear}
 className="p-2.5 border-2 border-border-default rounded-lg bg-surface-raised hover:bg-surface-base text-content-muted hover:text-content-secondary transition-colors"
 title="Limpar seleçéo"
 >
 <X className="h-4 w-4" />
 </button>
 )}
 </div>

 {/* Dropdown */}
 {isOpen && !disabled && (
 <>
 <div 
 className="fixed inset-0 z-10" 
 onClick={() => setIsOpen(false)}
 />
 <div className="absolute z-20 w-full mt-1 bg-surface-raised border-2 border-border-default rounded-lg shadow-lg max-h-96 overflow-hidden flex flex-col">
 {/* Campo de busca */}
 <div className="p-3 border-b border-border-default">
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Buscar zona..."
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-green-500 dark:focus:border-green-400"
 autoFocus
 />
 </div>

 {/* Lista de zonas */}
 <div className="overflow-y-auto flex-1">
 {filteredZones.length === 0 ? (
 <div className="p-4 text-center text-content-muted">
 {searchQuery ? 'Nenhuma zona encontrada' : 'Nenhuma zona disponé­vel'}
 </div>
 ) : (
 <div className="py-1">
 {filteredZones.map((zone) => (
 <button
 key={zone.id}
 type="button"
 onClick={() => handleZoneSelect(zone)}
 className={`
 w-full px-4 py-2.5 text-left hover:bg-green-50 dark:hover:bg-green-900/20
 transition-colors
 ${selectedZone?.id === zone.id 
 ? 'bg-green-100 dark:bg-green-900/30 border-l-4 border-green-600 dark:border-green-400' 
 : ''
 }
 `}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center flex-1 min-w-0">
 <MapPin className="h-4 w-4 mr-2 text-green-600 dark:text-green-400 flex-shrink-0" />
 <span className="font-medium text-content-primary truncate">
 {zone.name}
 </span>
 </div>
 {showPrice && (
 <span className="ml-2 font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
 {zone.price} MT
 </span>
 )}
 </div>
 </button>
 ))}
 </div>
 )}
 </div>
 </div>
 </>
 )}
 </div>
 );
};



