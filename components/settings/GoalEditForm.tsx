'use client';

import { useState, useCallback } from 'react';
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
import { PFC, UserProfile } from '@/lib/types';
import { ProfileCalculator } from './ProfileCalculator';

interface GoalEditFormProps {
    initialGoals: PFC;
    initialProfile?: UserProfile;
    onSave: (goals: PFC, profile?: UserProfile) => void;
    trigger: React.ReactNode;
}

export function GoalEditForm({ initialGoals, initialProfile, onSave, trigger }: GoalEditFormProps) {
    const [goals, setGoals] = useState<PFC>(initialGoals);
    const [profile, setProfile] = useState<UserProfile | undefined>(initialProfile);
    const [isOpen, setIsOpen] = useState(false);

    const handleChange = (key: keyof PFC, value: string) => {
        const numValue = parseInt(value, 10) || 0;
        setGoals((prev) => ({ ...prev, [key]: numValue }));
    };

    const handleCalculate = useCallback((newGoals: PFC, newProfile: UserProfile) => {
        setGoals(newGoals);
        setProfile(newProfile);
    }, []);

    const handleSave = () => {
        onSave(goals, profile);
        setIsOpen(false);
    };

    return (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>目標を編集</DrawerTitle>
                        <DrawerDescription>プロフィールを入力して目標を自動計算します。</DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 overflow-y-auto max-h-[70vh]">
                        <ProfileCalculator
                            initialProfile={profile}
                            onCalculate={handleCalculate}
                        />
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
