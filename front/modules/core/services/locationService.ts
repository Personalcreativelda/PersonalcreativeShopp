/**
 * @deprecated Sistema single-tenant (uma única loja). Mantido para compatibilidade com chamadas existentes.
 * Retorna listas vazias; não há CRUD de locais.
 */
export interface SimpleLocation {
    id: string;
    name: string;
    code?: string;
    type?: string;
    address?: string;
    isActive?: boolean;
    isDefault?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export const locationService = {
    async getLocations(_includeInactive: boolean = false): Promise<SimpleLocation[]> {
        return [];
    },
    async getLocationByCode(_code: string): Promise<SimpleLocation | null> {
        return null;
    },
    async createLocation(_location: any): Promise<SimpleLocation | null> {
        return null;
    },
    async updateLocation(_id: string, _location: any): Promise<boolean> {
        return false;
    },
    async deleteLocation(_id: string): Promise<boolean> {
        return false;
    },
    async getLocationEnabledModules(_locationId: string): Promise<string[]> {
        return [];
    },
    async getEnabledModulesFromMultipleLocations(_locationIds: string[]): Promise<Set<string>> {
        return new Set();
    },
    async getAvailableModules(): Promise<string[]> {
        return [
            'dashboard', 'orders', 'sales', 'customers', 'loyalty', 'products',
            'purchases', 'stock-management', 'users', 'roles', 'admin-tracking', 'media'
        ];
    },
    async updateLocationModules(_locationId: string, _moduleIds: string[]): Promise<boolean> {
        return false;
    }
};
