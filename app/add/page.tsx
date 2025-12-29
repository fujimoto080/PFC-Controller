import { AddFoodForm } from '@/components/input/AddFoodForm';

export default function AddPage() {
  return (
    <div className="space-y-6">
      <header className="py-2">
        <h1 className="text-2xl font-bold tracking-tight">食事を追加</h1>
      </header>
      <AddFoodForm />
    </div>
  );
}
