import { Button } from "@/components/ui/button"

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <header className="py-2">
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            </header>

            <div className="flex flex-col gap-4">
                <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                    <h2 className="font-semibold mb-2">Target Settings</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        Current Target: 2000 kcal (P:100 F:60 C:250)
                    </p>
                    <Button variant="outline" className="w-full">Edit Targets</Button>
                </div>

                <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                    <h2 className="font-semibold mb-2">Data Management</h2>
                    <Button variant="destructive" className="w-full">Clear All Data</Button>
                </div>
            </div>
        </div>
    )
}
