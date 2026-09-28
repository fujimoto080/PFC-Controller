import { usageNameOf } from '@/lib/client/usage';

function render(html: string): Element {
  document.body.innerHTML = html;
  const target = document.querySelector('[data-target]');
  if (!target) throw new Error('data-target がありません');
  return target;
}

describe('usageNameOf', () => {
  it('data-track を最優先する', () => {
    expect(
      usageNameOf(
        render(
          '<button data-track="お気に入りから記録" aria-label="x"><span data-target>おにぎり</span></button>',
        ),
      ),
    ).toBe('お気に入りから記録');
  });

  it('aria-label を表示テキストより優先する', () => {
    expect(
      usageNameOf(render('<button aria-label="削除" data-target>×</button>')),
    ).toBe('削除');
  });

  it('表示テキストの空白をまとめる', () => {
    expect(
      usageNameOf(
        render(
          '<a href="/foods"><span data-target> 食品\n  リスト </span></a>',
        ),
      ),
    ).toBe('食品 リスト');
  });

  it('テキストが無ければアイコン名を使う', () => {
    expect(
      usageNameOf(
        render(
          '<button data-target><svg class="lucide lucide-trash-2"></svg></button>',
        ),
      ),
    ).toBe('icon:trash-2');
  });

  it('操作対象の外なら null', () => {
    expect(usageNameOf(render('<div data-target>テキスト</div>'))).toBeNull();
  });
});
