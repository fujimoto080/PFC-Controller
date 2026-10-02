'use client';

import { Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MACROS } from '@/lib/macros';
import {
  ACTIVITY_LEVELS,
  bmrGenderOffset,
  calculateBMI,
  calculateRecommendedDuration,
  minimumCalories,
  type GoalBreakdown,
} from '@/lib/nutrition-goals';
import type { UserProfile } from '@/lib/types';

interface ProfileCalculatorProps {
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  duration: number;
  goals: GoalBreakdown;
}

const GENDER_LABELS = { male: '男性', female: '女性' } as const;

const NUMBER_FIELDS = [
  { key: 'age', label: '年齢' },
  { key: 'height', label: '身長 (cm)' },
  { key: 'weight', label: '現在の体重 (kg)' },
  { key: 'targetWeight', label: '目標体重 (kg)' },
] as const satisfies readonly { key: keyof UserProfile; label: string }[];

/** プロフィール入力と、そこから求めた目標カロリー・PFC の計算内訳を表示する。 */
export function ProfileCalculator({
  profile,
  onProfileChange,
  duration,
  goals,
}: ProfileCalculatorProps) {
  const update = (patch: Partial<UserProfile>) => {
    onProfileChange({ ...profile, ...patch });
  };

  const durationInfo = calculateRecommendedDuration(profile);
  const safeMonthlyLoss = (profile.weight * 0.05).toFixed(1);
  const activityLabel =
    ACTIVITY_LEVELS.find((level) => level.value === profile.activityLevel)
      ?.label ?? '';
  const offset = bmrGenderOffset(profile.gender);
  const targetStatus =
    goals.calorieAdjustment < 0
      ? '減量'
      : goals.calorieAdjustment > 0
        ? '増量'
        : '維持';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1.5">
          <Label>性別</Label>
          <Select
            value={profile.gender}
            onValueChange={(gender) => {
              update({ gender: gender as UserProfile['gender'] });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="性別" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GENDER_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {NUMBER_FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              type="number"
              value={profile[key]}
              onChange={(e) => {
                update({ [key]: parseInt(e.target.value) || 0 });
              }}
            />
          </div>
        ))}

        <div className="min-w-0 space-y-1.5">
          <Label>活動レベル</Label>
          <Select
            value={String(profile.activityLevel)}
            onValueChange={(value) => {
              update({ activityLevel: Number(value) });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="活動レベル" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_LEVELS.map(({ value, label }) => (
                <SelectItem key={value} value={String(value)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="gap-1 border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
            ダイエット期間の目安
          </p>
        </div>
        <div className="space-y-0.5 pl-6 text-[10px] text-blue-700 dark:text-blue-400">
          <p>減量は1ヶ月あたり現在の体重の5%以内が目安です。</p>
          <p>
            ・安全な月間減量ペース: {profile.weight}kg × 5% ={' '}
            <strong>{safeMonthlyLoss}kg</strong>
          </p>
          {durationInfo.recommended > 0 && (
            <>
              <p>
                ・5%ルールでの最短期間: ({profile.weight}kg -{' '}
                {profile.targetWeight}kg) ÷ {safeMonthlyLoss}
                kg/月 ≒ <strong>{durationInfo.byWeightLoss}ヶ月</strong>
              </p>
              <p>
                ・安全カロリー({minimumCalories(profile.gender)}
                kcal)での最短期間:{' '}
                <strong>{durationInfo.byCalorieLimit}ヶ月</strong>
              </p>
              <p className="pt-1 font-bold text-blue-900 dark:text-blue-200">
                → 推奨期間: {durationInfo.recommended}ヶ月以上
                {durationInfo.byCalorieLimit > durationInfo.byWeightLoss && (
                  <span> (カロリー制限を考慮)</span>
                )}
              </p>
            </>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">目標期間（自動計算）</span>
        <span className="font-semibold">{duration}ヶ月</span>
      </div>

      <div className="bg-muted/50 space-y-2 rounded-lg p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">現在のBMI</span>
          <span className="font-semibold">
            {calculateBMI(profile).toFixed(1)}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between font-bold">
            <span>推奨カロリー</span>
            <span>{goals.calories} kcal</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
            {MACROS.map(({ key, label }) => (
              <Card key={key} className="gap-0.5 p-2">
                <div className="text-muted-foreground">{label}</div>
                <div className="font-semibold">{goals[key]}g</div>
              </Card>
            ))}
          </div>
        </div>
        <div className="text-muted-foreground bg-background/50 mt-2 space-y-2 rounded-md p-3 text-xs">
          <p className="text-foreground/80 text-[11px] font-bold">計算の内訳</p>
          <BreakdownStep
            title="1. 基礎代謝量 (BMR)"
            description={`${GENDER_LABELS[profile.gender]}の場合:`}
            formula={`10 * ${profile.weight}kg + 6.25 * ${profile.height}cm - 5 * ${profile.age}歳 ${offset >= 0 ? '+' : '-'} ${Math.abs(offset)}`}
            result={goals.bmr}
          />
          <BreakdownStep
            title="2. 維持カロリー (TDEE)"
            description={`BMR × 活動レベル(${activityLabel}):`}
            formula={`${goals.bmr} * ${profile.activityLevel}`}
            result={goals.tdee}
          />
          <BreakdownStep
            title={`3. 目標カロリー (${targetStatus})`}
            description="1日の調整カロリーを計算:"
            formula={`${goals.tdee}kcal ${goals.calorieAdjustment >= 0 ? '+' : ''} ${goals.calorieAdjustment}kcal`}
            result={goals.caloriesBeforeLimit}
          />
          {goals.calories !== goals.caloriesBeforeLimit && (
            <BreakdownStep
              title="4. 安全のための制限"
              description={`健康維持のため、最低カロリー（${goals.minimumCalories}kcal）を下回らないよう調整しました。`}
              result={goals.calories}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BreakdownStep({
  title,
  description,
  formula,
  result,
}: {
  title: string;
  description: string;
  formula?: string;
  result: number;
}) {
  return (
    <div className="space-y-1">
      <p className="font-semibold">{title}</p>
      <p className="text-[10px]">
        {description}
        {formula && (
          <>
            <br />
            <code className="text-[11px]">{formula}</code>
          </>
        )}
      </p>
      <p className="text-right text-sm font-bold">= {result} kcal</p>
    </div>
  );
}
