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
import { Card } from '@/components/ui/card';

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
    const [calorieAdjustment, setCalorieAdjustment] = useState(-500);


    const calculateGoals = (p: UserProfile, adjustment: number) => {
        const { gender, age, height, weight, activityLevel } = p;
        const h = height || 170;
        const w = weight || 70;
        const a = age || 30;

        let bmr = 0;
        if (gender === 'male') {
            bmr = 10 * w + 6.25 * h - 5 * a + 5;
        } else {
            bmr = 10 * w + 6.25 * h - 5 * a - 161;
        }
        bmr = Math.round(bmr);
        const tdee = Math.round(bmr * activityLevel);

        const caloriesBeforeAdjustment = tdee + adjustment;
        const minimumCalories = gender === 'male' ? 1500 : 1200;
        const targetCalories = Math.max(caloriesBeforeAdjustment, minimumCalories);

        return {
            protein: Math.round((targetCalories * 0.25) / 4) || 0,
            fat: Math.round((targetCalories * 0.25) / 9) || 0,
            carbs: Math.round((targetCalories * 0.50) / 4) || 0,
            calories: Math.round(targetCalories) || 0,
            caloriesBeforeAdjustment: Math.round(caloriesBeforeAdjustment),
            minimumCalories,
            bmr,
            tdee,
        };
    };

    const heightInMeters = (profile.height || 170) / 100;
    const bmi = (profile.weight || 70) / (heightInMeters * heightInMeters);

    useEffect(() => {
        // 同期的なsetStateの警告を避けるため microtask で処理
        queueMicrotask(() => {
            const goals = calculateGoals(profile, calorieAdjustment);
            onCalculate({
                protein: goals.protein,
                fat: goals.fat,
                carbs: goals.carbs,
                calories: goals.calories,
            }, profile);
        });
    }, [profile, onCalculate, calorieAdjustment]);

    const calculatedGoals = calculateGoals(profile, calorieAdjustment);
    const genderText = profile.gender === 'male' ? '男性' : '女性';
    const bmrFormula = profile.gender === 'male'
        ? `10 * ${profile.weight}kg + 6.25 * ${profile.height}cm - 5 * ${profile.age}歳 + 5`
        : `10 * ${profile.weight}kg + 6.25 * ${profile.height}cm - 5 * ${profile.age}歳 - 161`;

    const activityLevelText = {
        '1.2': 'ほぼ運動しない',
        '1.375': '軽い運動（週1-3回）',
        '1.55': '中程度の運動（週3-5回）',
        '1.725': '激しい運動（週6-7回）',
        '1.9': '非常に激しい運動',
    }[profile.activityLevel.toString()] || '';

    const targetStatus = calorieAdjustment < 0 ? '減量' : calorieAdjustment > 0 ? '増量' : '維持';
    const targetFormula = `${calculatedGoals.tdee}kcal ${calorieAdjustment >= 0 ? '+' : ''} ${calorieAdjustment}kcal`;


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

            <div className="space-y-2 pt-4">
                <Label htmlFor="calorieAdjustment">カロリー調整 (kcal/日)</Label>
                <Input
                    id="calorieAdjustment"
                    type="number"
                    step="50"
                    value={calorieAdjustment}
                    onChange={(e) => setCalorieAdjustment(parseInt(e.target.value) || 0)}
                />
                <p className="text-[10px] text-muted-foreground">
                    減量の場合はマイナス値 (例: -500)、増量の場合はプラス値を入力してください。
                </p>
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
                            <Card className="p-2">
                                <div className="text-muted-foreground">タンパク質</div>
                                <div className="font-semibold">{calculatedGoals.protein}g</div>
                            </Card>
                            <Card className="p-2">
                                <div className="text-muted-foreground">脂質</div>
                                <div className="font-semibold">{calculatedGoals.fat}g</div>
                            </Card>
                            <Card className="p-2">
                                <div className="text-muted-foreground">炭水化物</div>
                                <div className="font-semibold">{calculatedGoals.carbs}g</div>
                            </Card>
                        </div>
                    </div>
                )}
                <div className="pt-2">
                    <div className="text-xs text-muted-foreground mt-2 space-y-3 p-3 bg-background/50 rounded-md">
                        <p className="text-[11px] font-bold text-foreground/80">ミフリン-セントジョー方程式を用いて計算しています。</p>
                        <div className="space-y-1">
                            <p className="font-semibold">1. 基礎代謝量 (BMR)</p>
                            <p className="text-[10px]">{genderText}の場合: <br /> <code className="text-[11px]">{bmrFormula}</code></p>
                            <p className="text-right font-bold text-sm">= {calculatedGoals.bmr} kcal</p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-semibold">2. 維持カロリー (TDEE)</p>
                            <p className="text-[10px]">BMR × 活動レベル({activityLevelText}): <br /> <code className="text-[11px]">{calculatedGoals.bmr} * {profile.activityLevel}</code></p>
                            <p className="text-right font-bold text-sm">= {calculatedGoals.tdee} kcal</p>
                        </div>
                         <div className="space-y-1">
                            <p className="font-semibold">3. 目標カロリー ({targetStatus})</p>
                            <p className="text-[10px]">TDEEを元に調整: <br /> <code className="text-[11px]">{targetFormula}</code></p>
                            <p className="text-right font-bold text-sm">= {calculatedGoals.caloriesBeforeAdjustment} kcal</p>
                        </div>
                        {calculatedGoals.calories !== calculatedGoals.caloriesBeforeAdjustment && (
                            <div className="space-y-1">
                                <p className="font-semibold">4. 安全のための制限</p>
                                <p className="text-[10px]">健康維持のため、最低カロリー（{calculatedGoals.minimumCalories}kcal）を下回らないよう調整しました。</p>
                                <p className="text-right font-bold text-sm">= {calculatedGoals.calories} kcal</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
                ※プロフィールを変更すると自動で目標値が更新されます。
            </p>
        </div>
    );
}
