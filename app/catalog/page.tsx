import { ChevronRight } from 'lucide-react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { PageTitle } from '@/components/ui/page-title';
import { CATALOG_STORES } from '@/lib/catalog/stores';

export const metadata = { title: '商品カタログ | PFC Balance' };

/** 組み合わせ提案に使うお店の商品一覧（data/<店舗 ID>.json）。 */
export default function CatalogPage() {
  return (
    <div className="space-y-6 pb-24">
      <PageTitle>商品カタログ</PageTitle>
      <p className="text-muted-foreground px-4 text-sm">
        各お店の公式サイトから毎週取り直す
      </p>

      {CATALOG_STORES.map((store) => (
        <section key={store.id} className="space-y-2 px-4">
          <h2 className="flex items-baseline gap-2 font-semibold">
            {store.name}
            {store.scope && `（${store.scope}）`}
            <span className="text-muted-foreground text-xs font-normal">
              {store.items.length} 件
            </span>
          </h2>
          {store.categories.map(({ slug, label }) => {
            const items = store.items.filter((item) => item.category === slug);
            return (
              <details key={slug} className="group bg-card rounded-lg border">
                <summary className="flex cursor-pointer list-none items-center gap-1 p-3 font-medium">
                  <ChevronRight className="text-muted-foreground h-4 w-4 transition-transform group-open:rotate-90" />
                  {label}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {items.length} 件
                  </span>
                </summary>
                <div className="divide-y border-t">
                  {items.map((item) => (
                    <div key={item.id} className="space-y-0.5 px-3 py-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary text-sm"
                      >
                        {item.name}
                      </a>
                      <PfcMacroLine food={item} />
                      {(item.price !== undefined || item.area) && (
                        <div className="text-muted-foreground text-xs">
                          {[
                            item.price !== undefined && `${item.price}円`,
                            item.area,
                          ]
                            .filter(Boolean)
                            .join('・')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </section>
      ))}
    </div>
  );
}
