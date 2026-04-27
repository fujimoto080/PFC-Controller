import { FoodItem } from '@/lib/types';

const MAX_SUGGESTIONS = 5;

const normalizeFoodName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s　\-_ー・]+/g, '');

const calcLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
};

const calcSimilarityScore = (input: string, target: string): number => {
  if (!input || !target) return 0;
  if (target.includes(input)) return 1;

  const maxLength = Math.max(input.length, target.length);
  if (maxLength === 0) return 0;

  const distance = calcLevenshteinDistance(input, target);
  return 1 - distance / maxLength;
};

export function getSimilarFoodSuggestions(
  foods: FoodItem[],
  inputName: string,
): Array<FoodItem & { similarityScore: number }> {
  const normalizedInput = normalizeFoodName(inputName.trim());
  if (normalizedInput.length < 2) return [];

  return foods
    .map((food) => {
      const normalizedName = normalizeFoodName(food.name);
      return {
        ...food,
        similarityScore: calcSimilarityScore(normalizedInput, normalizedName),
      };
    })
    .filter((food) => food.similarityScore >= 0.5)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, MAX_SUGGESTIONS);
}
