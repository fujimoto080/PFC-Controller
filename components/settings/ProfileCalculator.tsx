'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PFC, UserProfile } from '@/lib/types';

interface ProfileCalculatorProps {
    onCalculate: (goals: PFC, profile: UserProfile) => void;
    initialProfile?: UserProfile;
}

export function ProfileCalculator({ onCalculate, initialProfile }: ProfileCalculatorProps) {
    const [profile, setProfile] = useState<UserProfile>(initialProfile || {
        gender: 'male',
        age: 30,
        height: 170,
        weight: 70,
        targetWeight: 65,
        activityLevel: 1.375,
    });

    const [bmi, setBmi] = useState<number>(0);

    // Sync if initialProfile changes externally
    useEffect(() => {
        if (initialProfile) {
            setProfile(initialProfile);
        }
    }, [initialProfile]);

    const calculateGoals = (p: UserProfile) => {
        const { gender, age, height, weight, targetWeight, activityLevel } = p;
        const h = height || 170;
        const w = weight || 70;
        const tw = targetWeight || w;
        const a = age || 30;

        let bmr = 0;
        if (gender === 'male') {
            bmr = 10 * w + 6.25 * h - 5 * a + 5;
        } else {
            bmr = 10 * w + 6.25 * h - 5 * a - 161;
        }
        const tdee = bmr * activityLevel;
        let targetCalories = tdee;
        if (tw < w) targetCalories = tdee - 500;
        else if (tw > w) targetCalories = tdee + 300;
        targetCalories = Math.max(targetCalories, gender === 'male' ? 1500 : 1200);

        return {
            protein: Math.round((targetCalories * 0.25) / 4) || 0,
            fat: Math.round((targetCalories * 0.25) / 9) || 0,
            carbs: Math.round((targetCalories * 0.50) / 4) || 0,
            calories: Math.round(targetCalories) || 0,
        };
    };

    useEffect(() => {
        const heightInMeters = (profile.height || 170) / 100;
        setBmi((profile.weight || 70) / (heightInMeters * heightInMeters));
        onCalculate(calculateGoals(profile), profile);
    }, [profile, onCalculate]);

    const calculatedGoals = calculateGoals(profile);

    const handleLevelChange = (value: string) => {
        setProfile(prev => ({ ...prev, activityLevel: parseFloat(value) }));
    };

    return (
        <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>性別</Label>
                    <Select
                        value={profile.gender}
                        onValueChange={(v) => setProfile(prev => ({ ...prev, gender: v as 'male' | 'female' }))}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="性別" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="male">男性</SelectItem>
                            <SelectItem value="female">女性</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="age">年齢</Label>
                    <Input
                        id="age"
                        type="number"
                        value={profile.age}
                        onChange={(e) => setProfile(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="height">身長 (cm)</Label>
                    <Input
                        id="height"
                        type="number"
                        value={profile.height}
                        onChange={(e) => setProfile(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="weight">現在の体重 (kg)</Label>
                    <Input
                        id="weight"
                        type="number"
                        value={profile.weight}
                        onChange={(e) => setProfile(prev => ({ ...prev, weight: parseInt(e.target.value) || 0 }))}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="targetWeight">目標体重 (kg)</Label>
                    <Input
                        id="targetWeight"
                        type="number"
                        value={profile.targetWeight}
                        onChange={(e) => setProfile(prev => ({ ...prev, targetWeight: parseInt(e.target.value) || 0 }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label>活動レベル</Label>
                    <Select
                        value={profile.activityLevel.toString()}
                        onValueChange={handleLevelChange}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="活動レベル" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1.2">ほぼ運動しない</SelectItem>
                            <SelectItem value="1.375">軽い運動（週1-3回）</SelectItem>
                            <SelectItem value="1.55">中程度の運動（週3-5回）</SelectItem>
                            <SelectItem value="1.725">激しい運動（週6-7回）</SelectItem>
                            <SelectItem value="1.9">非常に激しい運動</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">現在のBMI</span>
                    <span className="font-semibold">{bmi.toFixed(1)}</span>
                </div>
                {calculatedGoals && (
                    <div className="space-y-1">
                        <div className="flex justify-between items-center font-bold">
                            <span>推奨カロリー</span>
                            <span>{calculatedGoals.calories} kcal</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-center pt-2">
                            <div className="bg-card p-2 rounded border">
                                <div className="text-muted-foreground">タンパク質</div>
                                <div className="font-semibold">{calculatedGoals.protein}g</div>
                            </div>
                            <div className="bg-card p-2 rounded border">
                                <div className="text-muted-foreground">脂質</div>
                                <div className="font-semibold">{calculatedGoals.fat}g</div>
                            </div>
                            <div className="bg-card p-2 rounded border">
                                <div className="text-muted-foreground">炭水化物</div>
                                <div className="font-semibold">{calculatedGoals.carbs}g</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
                ※プロフィールを変更すると自動で目標値が更新されます。
            </p>
        </div>
    );
}
