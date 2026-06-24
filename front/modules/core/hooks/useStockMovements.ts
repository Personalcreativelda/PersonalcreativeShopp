import { useState, useCallback } from 'react';
import { StockMovement } from '../../core/types/types';
import { dataService } from '../../core/services/dataService';

export const useStockMovements = () => {
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [loading, setLoading] = useState(false);

    const getStockMovements = useCallback(async () => {
        setLoading(true);
        try {
            const data = await dataService.getStockMovements();
            setMovements(data);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        movements,
        getStockMovements,
        loading
    };
};

