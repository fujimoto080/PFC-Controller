'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getSettings, saveSettings } from '@/lib/storage';
import { UserSettings, PFC } from '@/lib/types';
import { GoalEditForm } from '@/components/settings/GoalEditForm';
import { toast } from 'sonner';

export default function SettingsPage() {
    const [settings, setSettings] = useState<UserSettings | null>(null);

    useEffect(() => {
        setSettings(getSettings());
    }, []);

    const handleSaveGoals = (newGoals: PFC, newProfile?: UserProfile) => {
        const newSettings = { ...settings, targetPFC: newGoals, profile: newProfile };
        saveSettings(newSettings);
        setSettings(newSettings);
        toast.success('目標を更新しました');
    };

    if (!settings) return null;

    return (
        <div className="space-y-6">
            <header className="py-2">
                <h1 className="text-2xl font-bold tracking-tight">設定</h1>
            </header>

            <div className="flex flex-col gap-4">
                <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
                    <h2 className="mb-2 font-semibold">目標設定</h2>
                    <p className="text-muted-foreground mb-4 text-sm">
                        現在の目標: {settings.targetPFC.calories} kcal (P:{settings.targetPFC.protein} F:{settings.targetPFC.fat} C:{settings.targetPFC.carbs})
                    </p>
                    <GoalEditForm
                        initialGoals={settings.targetPFC}
                        initialProfile={settings.profile}
                        onSave={handleSaveGoals}
                        trigger={
                            <Button variant="outline" className="w-full">
                                目標を編集
                            </Button>
                        }
                    />
                </div>

                <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
                    <h2 className="mb-2 font-semibold">データ管理</h2>
                    <div className="space-y-2">
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <a href="/manage-foods">食品データの管理</a>
                        </Button>
                        <Button variant="destructive" className="w-full" onClick={() => {
                            if (confirm('すべてのデータを消去しますか？この操作は取り消せません。')) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }}>
                            全データを消去
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
