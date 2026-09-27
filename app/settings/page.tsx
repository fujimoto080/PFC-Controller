import Link from 'next/link';
import { PageTitle } from '@/components/ui/page-title';
import { GoalSettingsPanel } from '@/components/settings/GoalSettingsPanel';
import { AccountPanel } from '@/components/settings/AccountPanel';
import { CalendarSettingsPanel } from '@/components/settings/CalendarSettingsPanel';
import { MealPreferenceSettingsPanel } from '@/components/settings/MealPreferenceSettingsPanel';
import { MealSuggestionSettingsPanel } from '@/components/settings/MealSuggestionSettingsPanel';
import { SportSettingsPanel } from '@/components/settings/SportSettingsPanel';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageTitle>設定</PageTitle>

      <GoalSettingsPanel />

      <SportSettingsPanel />

      <MealSuggestionSettingsPanel />

      <CalendarSettingsPanel />
      <MealPreferenceSettingsPanel />
      <AccountPanel />

      <div className="text-right">
        <Link
          href="/privacy-policy"
          className="text-muted-foreground text-xs underline"
        >
          プライバシーポリシー
        </Link>
      </div>
    </div>
  );
}
