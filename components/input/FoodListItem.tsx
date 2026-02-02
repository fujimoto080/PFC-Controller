'use client';

import Image from 'next/image';
import { Plus } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { FoodItem } from '@/lib/types';

interface FoodListItemProps {
    food: FoodItem;
    onAdd: (food: FoodItem) => void;
}

export function FoodListItem({ food, onAdd }: FoodListItemProps) {
    return (
        <div
            className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
            role="button"
            onClick={() => onAdd(food)}
        >
            <div className="flex items-center gap-3">
                {food.image ? (
                    <Image
                        src={food.image}
                        alt={food.name}
                        width={10}
                        height={10}
                    />
                ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                        <span className="text-xs">No img</span>
                    </div>
                )}
                <div>
                    <div className="font-medium">{food.name}</div>
                    <div className="text-muted-foreground text-xs">
                        P:{food.protein} F:{food.fat} C:{food.carbs} |{' '}
                        {food.calories}kcal
                    </div>
                </div>
            </div>
            <IconButton>
                <Plus className="h-4 w-4" />
            </IconButton>
        </div>
    );
}
