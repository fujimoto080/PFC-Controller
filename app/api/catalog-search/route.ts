import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { searchCatalogFoods } from '@/lib/server/catalog-search';

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

export const GET = defineRoute(
  { label: 'カタログ検索', auth: true },
  async (request, { userId }) => {
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
      throw new ApiError(
        `検索語は ${MIN_QUERY_LENGTH}〜${MAX_QUERY_LENGTH} 文字で指定してください`,
        400,
      );
    }
    return NextResponse.json(await searchCatalogFoods(userId, query));
  },
);
