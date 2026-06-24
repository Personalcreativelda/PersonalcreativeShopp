import { useState, useCallback } from 'react';
import { Order } from '../../core/types/types';
import { orderService } from '../../../sales/services/orderService';

export const useOrders = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);

    const getOrders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await orderService.getOrders();
            setOrders(data);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        orders,
        getOrders,
        loading
    };
};

