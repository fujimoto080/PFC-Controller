import { ChevronRight } from 'lucide-react';
import catalog from '@/data/seven-eleven.json';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { PageTitle } from '@/components/ui/page-title';
import { SEVEN_ELEVEN_CATEGORIES, itemUrl } from '@/lib/seven-eleven';

export const metadata = { title: '商品カタログ | PFC Balance' };

/** 組み合わせ提案に使うセブン-イレブン（関東）の商品一覧（data/seven-eleven.json）。 */
export default function CatalogPage() {
  return (
    <div className="space-y-6 pb-24">
      <PageTitle>商品カタログ</PageTitle>

      <div className="space-y-2 px-4">
        <p className="text-muted-foreground text-sm">
          セブン-イレブン（関東）{catalog.length} 件。公式サイトから毎週取り直す
        </p>
        {SEVEN_ELEVEN_CATEGORIES.map(({ slug, label }) => {
          const items = catalog.filter((item) => item.category === slug);
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
                      href={itemUrl(item.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary text-sm"
                    >
                      {item.name}
                    </a>
                    <PfcMacroLine food={item} />
                    <div className="text-muted-foreground text-xs">
                      {item.price}円・{item.area}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
