import api from '../../core/services/apiClient';
import { DeliveryZone } from '../../core/types/types';

export const deliveryService = {
  async getDeliveryZones(): Promise<DeliveryZone[]> {
    try {
      const zones = await api.get('/delivery-zones');
      return (zones || []) as DeliveryZone[];
    } catch (e: any) {
      console.error('Erro ao buscar zonas de entrega:', e);
      return [];
    }
  },

  async getAllDeliveryZones(): Promise<DeliveryZone[]> {
    try {
      const zones = await api.get('/delivery-zones/all');
      return (zones || []) as DeliveryZone[];
    } catch (e: any) {
      console.error('Erro ao buscar todas as zonas:', e);
      return [];
    }
  },

  async getDeliveryZoneByName(name: string): Promise<DeliveryZone | null> {
    try {
      const zones = await this.getDeliveryZones();
      return zones.find(z => z.name.toLowerCase() === name.toLowerCase()) || null;
    } catch {
      return null;
    }
  },

  async getDeliveryZoneById(id: string): Promise<DeliveryZone | null> {
    try {
      const zones = await this.getDeliveryZones();
      return zones.find(z => z.id === id) || null;
    } catch {
      return null;
    }
  },

  async createDeliveryZone(data: { name: string; price: number; isActive?: boolean; displayOrder?: number }): Promise<DeliveryZone | null> {
    try {
      return await api.post('/delivery-zones', data);
    } catch {
      return null;
    }
  },

  async updateDeliveryZone(id: string, data: Partial<DeliveryZone>): Promise<DeliveryZone | null> {
    try {
      return await api.put(`/delivery-zones/${id}`, data);
    } catch {
      return null;
    }
  },

  async deleteDeliveryZone(id: string): Promise<boolean> {
    try {
      await api.delete(`/delivery-zones/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  async calculateDeliveryFee(zoneName: string): Promise<number> {
    const zone = await this.getDeliveryZoneByName(zoneName);
    return zone ? zone.price : 0;
  },

  async calculateDeliveryFeeById(zoneId: string): Promise<number> {
    const zone = await this.getDeliveryZoneById(zoneId);
    return zone ? zone.price : 0;
  }
};
