'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PFC } from '@/lib/types';

interface GoalEditFormProps {
    initialGoals: PFC;
    onSave: (goals: PFC) => void;
    trigger: React.ReactNode;
}

export function GoalEditForm({ initialGoals, onSave, trigger }: GoalEditFormProps) {
    const [goals, setGoals] = useState<PFC>(initialGoals);
    const [isOpen, setIsOpen] = useState(false);

    const handleChange = (key: keyof PFC, value: string) => {
        const numValue = parseInt(value, 10) || 0;
        setGoals((prev) => ({ ...prev, [key]: numValue }));
    };

    const handleSave = () => {
        onSave(goals);
        setIsOpen(false);
    };

    return (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>目標を編集</DrawerTitle>
                        <DrawerDescription>一日の目標摂取量を設定してください。</DrawerDescription>
                    </DrawerHeader>
                    <div className="grid gap-4 p-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="calories" className="text-right text-sm">
                                カロリー
                            </Label>
                            <Input
                                id="calories"
                                type="number"
                                value={goals.calories}
                                onChange={(e) => handleChange('calories', e.target.value)}
                                className="col-span-3 text-sm"
                                inputMode="numeric"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="protein" className="text-right text-sm">
                                タンパク質
                            </Label>
                            <Input
                                id="protein"
                                type="number"
                                value={goals.protein}
                                onChange={(e) => handleChange('protein', e.target.value)}
                                className="col-span-3 text-sm"
                                inputMode="numeric"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="fat" className="text-right text-sm">
                                脂質
                            </Label>
                            <Input
                                id="fat"
                                type="number"
                                value={goals.fat}
                                onChange={(e) => handleChange('fat', e.target.value)}
                                className="col-span-3 text-sm"
                                inputMode="numeric"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="carbs" className="text-right text-sm">
                                炭水化物
                            </Label>
                            <Input
                                id="carbs"
                                type="number"
                                value={goals.carbs}
                                onChange={(e) => handleChange('carbs', e.target.value)}
                                className="col-span-3 text-sm"
                                inputMode="numeric"
                            />
                        </div>
                    </div>
                    <DrawerFooter>
                        <Button onClick={handleSave}>保存</Button>
                        <DrawerClose asChild>
                            <Button variant="outline">キャンセル</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
