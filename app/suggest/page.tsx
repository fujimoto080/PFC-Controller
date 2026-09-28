import { Suspense } from 'react';
import { MealSuggestView } from '@/components/suggest/MealSuggestView';

export default function SuggestPage() {
  // クエリを読む部分だけをクライアント描画にし、ページ自体は静的に配信する
  return (
    <Suspense>
      <MealSuggestView />
    </Suspense>
  );
}
