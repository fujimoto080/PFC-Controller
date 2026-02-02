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
import { Info } from 'lucide-react';

interface ProfileCalculatorProps {
    onCalculate: (goals: PFC, profile: UserProfile) => void;
    initialProfile?: UserProfile;
}

const calculateRecommendedDuration = (currentWeight: number, targetWeight: number): number => {
    const weightToLose = currentWeight - targetWeight;
    const safeMonthlyWeightLoss = currentWeight * 0.05;
    if (weightToLose > 0 && safeMonthlyWeightLoss > 0) {
        const duration = weightToLose / safeMonthlyWeightLoss;
        // 小数点第一位に丸める
        return Math.round(duration * 10) / 10;
    }
    return 0;
};

export function ProfileCalculator({ onCalculate, initialProfile }: ProfileCalculatorProps) {
    const [profile, setProfile] = useState<UserProfile>(initialProfile || {
        gender: 'male',
        age: 30,
        height: 170,
        weight: 70,
        targetWeight: 65,
        activityLevel: 1.375,
    });

    const [targetDuration, setTargetDuration] = useState(() => {
        const recommended = calculateRecommendedDuration(profile.weight, profile.targetWeight);
        return recommended > 0 ? recommended : 3;
    });


    const calculateGoals = (p: UserProfile, duration: number) => {
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
        bmr = Math.round(bmr);
        const tdee = Math.round(bmr * activityLevel);

        const weightDifference = w - tw;
        let calorieAdjustment = 0;
        if (weightDifference > 0 && duration > 0) { // 減量
            const totalCaloriesToLose = weightDifference * 7200;
            const totalDays = duration * 30;
            calorieAdjustment = -(totalCaloriesToLose / totalDays);
        } else if (weightDifference < 0 && duration > 0) { // 増量
            const totalCaloriesToGain = Math.abs(weightDifference) * 7200;
            const totalDays = duration * 30;
            calorieAdjustment = totalCaloriesToGain / totalDays;
        }

        const caloriesBeforeAdjustment = tdee + calorieAdjustment;
        const minimumCalories = gender === 'male' ? 1500 : 1200;
        const targetCalories = Math.max(caloriesBeforeAdjustment, minimumCalories);

        return {
            protein: Math.round((targetCalories * 0.25) / 4) || 0,
            fat: Math.round((targetCalories * 0.25) / 9) || 0,
            carbs: Math.round((targetCalories * 0.50) / 4) || 0,
            calories: Math.round(targetCalories) || 0,
            caloriesBeforeAdjustment: Math.round(caloriesBeforeAdjustment),
            calorieAdjustment: Math.round(calorieAdjustment),
            minimumCalories,
            bmr,
            tdee,
        };
    };

    const heightInMeters = (profile.height || 170) / 100;
    const bmi = (profile.weight || 70) / (heightInMeters * heightInMeters);

    useEffect(() => {
        queueMicrotask(() => {
            const goals = calculateGoals(profile, targetDuration);
            onCalculate({
                protein: goals.protein,
                fat: goals.fat,
                carbs: goals.carbs,
                calories: goals.calories,
            }, profile);
        });
    }, [profile, onCalculate, targetDuration]);

    const calculatedGoals = calculateGoals(profile, targetDuration);
    const recommendedDuration = calculateRecommendedDuration(profile.weight, profile.targetWeight);
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

    const targetStatus = calculatedGoals.calorieAdjustment < 0 ? '減量' : calculatedGoals.calorieAdjustment > 0 ? '増量' : '維持';
    const targetFormula = `${calculatedGoals.tdee}kcal ${calculatedGoals.calorieAdjustment >= 0 ? '+' : ''} ${calculatedGoals.calorieAdjustment}kcal`;


    const handleLevelChange = (value: string) => {
        setProfile(prev => ({ ...prev, activityLevel: parseFloat(value) }));
    };

    const handleDurationBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        const roundedValue = Math.round(value * 10) / 10;
        setTargetDuration(Math.max(0.1, roundedValue));
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

            <Card className="p-3 mt-4 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800">
                <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">ダイエット期間の目安</p>
                </div>
                <div className="text-[10px] text-blue-700 dark:text-blue-400 mt-1 pl-6 space-y-1">
                    <p>専門家は、1ヶ月あたり現在の体重の5%以内の減量を推奨しています。</p>
                    <p>・安全な月間減量ペース: {profile.weight}kg × 5% = <strong>{(profile.weight * 0.05).toFixed(1)}kg</strong></p>
                    {recommendedDuration > 0 && (
                        <p>・推奨期間の計算: ({profile.weight}kg - {profile.targetWeight}kg) ÷ {(profile.weight * 0.05).toFixed(1)}kg/月 ≒ <strong>{recommendedDuration}ヶ月</strong></p>
                    )}
                </div>
            </Card>

            <div className="space-y-2 pt-4">
                <Label htmlFor="targetDuration">目標期間 (ヶ月)</Label>
                <Input
                    id="targetDuration"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(parseFloat(e.target.value) || 0)}
                    onBlur={handleDurationBlur}
                />
                 <p className="text-[10px] text-muted-foreground">
                    目標体重を達成するまでの期間を設定してください。小数点第一位まで入力できます。
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
                        <p className="text-[11px] font-bold text-foreground/80">計算の内訳</p>
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
                            <p className="text-[10px]">1日の調整カロリーを計算: <br /> <code className="text-[11px]">{targetFormula}</code></p>
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