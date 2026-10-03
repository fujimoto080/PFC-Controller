import {
  Activity,
  Bike,
  Dumbbell,
  Flower2,
  Footprints,
  HeartPulse,
  Mountain,
  Volleyball,
  Waves,
  type LucideIcon,
} from 'lucide-react';

/** スポーツ名に含まれる言葉からアイコンを選ぶ。上から順に最初に合ったものを使う。 */
const SPORT_ICONS: { keywords: string[]; icon: LucideIcon }[] = [
  { keywords: ['ウォーキング', 'ウォーク', '散歩', '歩'], icon: Footprints },
  { keywords: ['ランニング', 'ジョギング', 'マラソン', '走'], icon: Activity },
  { keywords: ['水泳', 'スイム', 'プール', '泳'], icon: Waves },
  {
    keywords: ['自転車', 'サイクリング', 'バイク', 'ロードバイク'],
    icon: Bike,
  },
  {
    keywords: [
      '筋トレ',
      'ウェイト',
      'トレーニング',
      'ジム',
      '腹筋',
      'スクワット',
    ],
    icon: Dumbbell,
  },
  { keywords: ['ヨガ', 'ストレッチ', 'ピラティス'], icon: Flower2 },
  { keywords: ['登山', 'ハイキング', 'トレッキング'], icon: Mountain },
  {
    keywords: [
      'テニス',
      'バドミントン',
      '卓球',
      'バレー',
      'サッカー',
      'バスケ',
      '野球',
    ],
    icon: Volleyball,
  },
];

/** スポーツ名に合ったアイコン。合うものが無ければ汎用の運動アイコン。 */
export function SportIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon =
    SPORT_ICONS.find(({ keywords }) =>
      keywords.some((keyword) => name.includes(keyword)),
    )?.icon ?? HeartPulse;
  return <Icon className={className} aria-hidden />;
}
