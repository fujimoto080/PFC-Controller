import Link from 'next/link';
import { PageTitle } from '@/components/ui/page-title';

export const metadata = {
  title: 'プライバシーポリシー | PFC Balance',
  description: 'PFC Balance のプライバシーポリシー',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-6 pb-24">
      <PageTitle>プライバシーポリシー</PageTitle>

      <section className="space-y-3 text-sm leading-7">
        <p>
          PFC Balance（以下「本アプリ」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
        </p>
        <p>
          本ポリシーでは、本アプリにおける情報の取得・利用・管理について説明します。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-7">
        <h2 className="text-base font-semibold">1. 取得する情報</h2>
        <p>
          本アプリでは、食事ログ、目標PFC、ユーザー設定など、ユーザーが入力した情報を端末内に保存します。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-7">
        <h2 className="text-base font-semibold">2. 情報の利用目的</h2>
        <p>
          取得した情報は、PFCバランスの計算、履歴表示、入力補助など、本アプリの機能提供のためにのみ利用します。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-7">
        <h2 className="text-base font-semibold">3. 第三者提供</h2>
        <p>
          本アプリは、法令に基づく場合を除き、取得した情報を第三者に提供しません。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-7">
        <h2 className="text-base font-semibold">4. 情報の管理</h2>
        <p>
          本アプリのデータは主にユーザー端末内で管理されます。ユーザーは端末の操作により、保存データを削除できます。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-7">
        <h2 className="text-base font-semibold">5. ポリシーの改定</h2>
        <p>
          本ポリシーは、必要に応じて改定することがあります。改定後の内容は本ページに掲載した時点で効力を生じます。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-7">
        <h2 className="text-base font-semibold">6. お問い合わせ</h2>
        <p>本ポリシーに関するお問い合わせは、アプリ配布ページの連絡先をご利用ください。</p>
      </section>

      <Link href="/" className="text-primary inline-block text-sm underline">
        ホームに戻る
      </Link>
    </div>
  );
}
