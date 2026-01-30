import { useState, useEffect, useCallback } from 'react';
import { FoodItem } from '@/lib/types';
import { getFoodDictionary, getUniqueStores } from '@/lib/storage';

export function useFoodDictionary() {
    const [foods, setFoods] = useState<FoodItem[]>([]);
    const [uniqueStores, setUniqueStores] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(() => {
        queueMicrotask(() => {
            setFoods(getFoodDictionary());
            setUniqueStores(getUniqueStores());
            setIsLoading(false);
        });
    }, []);

    useEffect(() => {
        refresh(); // Initial load

        const handleUpdate = () => refresh();
        window.addEventListener('pfc-update', handleUpdate);
        return () => window.removeEventListener('pfc-update', handleUpdate);
    }, [refresh]);

    return { foods, uniqueStores, isLoading, refresh };
}
