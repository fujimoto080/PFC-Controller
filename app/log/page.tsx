import { LogList } from '@/components/history/LogList';
import { PageTitle } from '@/components/ui/page-title';

export default function LogPage() {
  return (
    <>
      <PageTitle>履歴</PageTitle>
      <LogList />
    </>
  );
}
