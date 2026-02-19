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
import { PFC, SportDefinition, UserProfile } from '@/lib/types';
import { ProfileCalculator } from './ProfileCalculator';
import { SportSettingsForm } from './SportSettingsForm';

interface GoalEditFormProps {
    initialGoals: PFC;
    initialProfile?: UserProfile;
    initialSports?: SportDefinition[];
    onSave: (goals: PFC, profile: UserProfile | undefined, sports: SportDefinition[]) => void;
    trigger: React.ReactNode;
}

export function GoalEditForm({
    initialGoals,
    initialProfile,
    initialSports = [],
    onSave,
    trigger,
}: GoalEditFormProps) {
    const [goals, setGoals] = useState<PFC>(initialGoals);
    const [profile, setProfile] = useState<UserProfile | undefined>(initialProfile);
    const [duration, setDuration] = useState<number | undefined>(undefined);
    const [sports, setSports] = useState<SportDefinition[]>(initialSports);
    const [isOpen, setIsOpen] = useState(false);


    const handleOpenChange = (open: boolean) => {
        if (open) {
            setGoals(initialGoals);
            setProfile(initialProfile);
            setSports(initialSports);
        }
        setIsOpen(open);
    };

    const handleCalculate = useCallback((newGoals: PFC, newProfile: UserProfile) => {
        setGoals(newGoals);
        setProfile(newProfile);
    }, []);

    const handleSave = () => {
        onSave(goals, profile, sports);
        setIsOpen(false);
    };

    const handleAddSport = (sport: SportDefinition) => {
        setSports((prev) => [...prev, sport]);
    };

    const handleDeleteSport = (id: string) => {
        setSports((prev) => prev.filter((sport) => sport.id !== id));
    };

    return (
        <Drawer open={isOpen} onOpenChange={handleOpenChange}>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>目標を編集</DrawerTitle>
                        <DrawerDescription>プロフィールを入力して目標を自動計算します。</DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 overflow-y-auto max-h-[70vh] pb-24">
                        <ProfileCalculator
                            initialProfile={profile}
                            onCalculate={handleCalculate}
                            duration={duration}
                            onDurationChange={setDuration}
                        />
                        <SportSettingsForm
                            sports={sports}
                            onAddSport={handleAddSport}
                            onDeleteSport={handleDeleteSport}
                        />
                    </div>
                    <DrawerFooter className="fixed bottom-0 left-0 right-0 z-10 w-full border-t bg-background p-0">
                        <div className="mx-auto flex w-full max-w-sm items-center gap-4 p-4">
                            <DrawerClose asChild>
                                <Button variant="outline" className="flex-1">
                                    キャンセル
                                </Button>
                            </DrawerClose>
                            <Button onClick={handleSave} className="flex-1">
                                保存
                            </Button>
                        </div>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
