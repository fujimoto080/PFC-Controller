'use client';

import { Pencil, Plus, Star, Trash } from 'lucide-react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Checkbox } from '@/components/ui/checkbox';
import { IconButton } from '@/components/ui/icon-button';
import type { FoodItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FoodRowProps {
  food: FoodItem;
  barcodes: string[];
  isFavorite: boolean;
  /** 選択モードでなければ null */
  selected: boolean | null;
  onToggleSelect: () => void;
  onAddLog: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** 食品辞書の 1 行。選択モード中はチェックボックス、それ以外は操作ボタンを表示する。 */
export function FoodRow({
  food,
  barcodes,
  isFavorite,
  selected,
  onToggleSelect,
  onAddLog,
  onToggleFavorite,
  onEdit,
  onDelete,
}: FoodRowProps) {
  const isSelecting = selected !== null;
  return (
    // 行クリックは選択の補助操作。キーボード操作は Checkbox で提供する。
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border p-3',
        selected ? 'border-primary bg-primary/5' : 'bg-card',
      )}
      onClick={isSelecting ? onToggleSelect : undefined}
    >
      {isSelecting && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          onClick={(e) => {
            e.stopPropagation();
          }}
          aria-label={`${food.name}を選択`}
        />
      )}
      <div className="flex-1 pr-2">
        <div className="font-medium">{food.name}</div>
        <PfcMacroLine food={food} />
        {barcodes.length > 0 && (
          <div className="text-muted-foreground text-xs">
            バーコード: {barcodes.join(', ')}
          </div>
        )}
      </div>
      {isSelecting ? (
        <div className="text-primary text-xs">
          {selected ? '選択中' : 'タップで選択'}
        </div>
      ) : (
        <div className="flex gap-1">
          <IconButton onClick={onAddLog} aria-label="食事記録に追加">
            <Plus className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={onToggleFavorite} aria-label="お気に入り">
            <Star
              className={cn(
                'h-4 w-4',
                isFavorite
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground',
              )}
            />
          </IconButton>
          <IconButton onClick={onEdit} aria-label="編集">
            <Pencil className="text-muted-foreground h-4 w-4" />
          </IconButton>
          <IconButton onClick={onDelete} aria-label="削除">
            <Trash className="text-destructive h-4 w-4" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
