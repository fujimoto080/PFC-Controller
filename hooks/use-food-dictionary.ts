import { useState, useEffect, useCallback } from 'react';
import { FoodItem } from '@/lib/types';
import { getFoodDictionary, getUniqueStores } from '@/lib/storage/foods';
import { useSubscribeToPfcUpdate } from './use-pfc-update';

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
        refresh();
    }, [refresh]);

    useSubscribeToPfcUpdate(refresh);

    return { foods, uniqueStores, isLoading, refresh };
}
