import { MealSuggestView } from '@/components/suggest/MealSuggestView';
import { CATALOG_SOURCE_OPTIONS } from '@/lib/server/combination-suggestions';

export default function SuggestPage() {
  return <MealSuggestView catalogSources={CATALOG_SOURCE_OPTIONS} />;
}
