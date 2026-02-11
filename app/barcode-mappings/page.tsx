import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/ui/page-title';
import { listBarcodeMappings } from '@/lib/barcode-kv';

export const dynamic = 'force-dynamic';

export default async function BarcodeMappingsPage() {
  const mappings = await listBarcodeMappings();

  return (
    <div className="mx-auto w-full max-w-4xl pb-24">
      <PageTitle>バーコードマッピング一覧</PageTitle>

      <Card className="mx-4">
        <CardHeader>
          <CardTitle>登録済みバーコード: {mappings.length} 件</CardTitle>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              まだバーコードのマッピングが登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left">バーコード</th>
                    <th className="px-3 py-2 text-left">食品名</th>
                    <th className="px-3 py-2 text-right">P</th>
                    <th className="px-3 py-2 text-right">F</th>
                    <th className="px-3 py-2 text-right">C</th>
                    <th className="px-3 py-2 text-right">kcal</th>
                    <th className="px-3 py-2 text-left">店名</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(({ barcode, food }) => (
                    <tr key={barcode} className="border-t">
                      <td className="px-3 py-2 font-mono">{barcode}</td>
                      <td className="px-3 py-2">{food.name}</td>
                      <td className="px-3 py-2 text-right">{food.protein}</td>
                      <td className="px-3 py-2 text-right">{food.fat}</td>
                      <td className="px-3 py-2 text-right">{food.carbs}</td>
                      <td className="px-3 py-2 text-right">{food.calories}</td>
                      <td className="px-3 py-2">{food.store || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
