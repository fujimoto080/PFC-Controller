"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Camera, Search, Plus, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { addFoodItem } from "@/lib/storage"
import { FoodItem } from "@/lib/types"
import publicFoods from "@/data/public_foods.json"
import { toast } from "sonner"

export function AddFoodForm() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("manual")
    const [searchQuery, setSearchQuery] = useState("")

    // Form for manual entry
    const { register, handleSubmit, reset } = useForm<FoodItem>()

    const onSubmitManual = (data: any) => {
        // Basic validation / conversion
        const item: FoodItem = {
            id: Date.now().toString(),
            name: data.name,
            protein: Number(data.protein),
            fat: Number(data.fat),
            carbs: Number(data.carbs),
            calories: Number(data.calories),
            timestamp: Date.now()
        }

        addFoodItem(item)
        toast.success("Added " + item.name)
        reset()
        router.push("/")
    }

    const handleAddPublic = (food: any) => {
        const item: FoodItem = {
            ...food,
            id: Date.now().toString(), // unique id for log
            timestamp: Date.now()
        }
        addFoodItem(item)
        toast.success("Added " + item.name)
        router.push("/")
    }

    const filteredFoods = publicFoods.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <Tabs defaultValue="manual" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="manual">Manual</TabsTrigger>
                    <TabsTrigger value="search">Search</TabsTrigger>
                    <TabsTrigger value="photo">Photo</TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <TabsContent value="manual" className="mt-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <form onSubmit={handleSubmit(onSubmitManual)} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Food Name</Label>
                                            <Input {...register("name", { required: true })} placeholder="e.g. My Lunch" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Protein (g)</Label>
                                                <Input type="number" step="0.1" {...register("protein")} placeholder="0" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Fat (g)</Label>
                                                <Input type="number" step="0.1" {...register("fat")} placeholder="0" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Carbs (g)</Label>
                                                <Input type="number" step="0.1" {...register("carbs")} placeholder="0" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Calories</Label>
                                                <Input type="number" {...register("calories")} placeholder="0" />
                                            </div>
                                        </div>
                                        <Button type="submit" className="w-full">
                                            <Plus className="mr-2 h-4 w-4" /> Add Entry
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="search" className="mt-4">
                            <Card>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="search"
                                            placeholder="Search foods..."
                                            className="pl-8"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {filteredFoods.map((food) => (
                                            <div key={food.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors" role="button" onClick={() => handleAddPublic(food)}>
                                                <div>
                                                    <div className="font-medium">{food.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        P:{food.protein} F:{food.fat} C:{food.carbs} | {food.calories}kcal
                                                    </div>
                                                </div>
                                                <Button size="icon" variant="ghost">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {filteredFoods.length === 0 && (
                                            <div className="text-center text-muted-foreground text-sm py-4">No foods found.</div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="photo" className="mt-4">
                            <Card>
                                <CardContent className="pt-6 text-center space-y-4">
                                    <div className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-muted-foreground relative overflow-hidden group">
                                        <Camera className="h-10 w-10 mb-2 group-hover:scale-110 transition-transform" />
                                        <p>Take a photo</p>
                                        <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Note: Photo analysis is not currently connected to an AI API. Use Manual or Search for accurate data.
                                    </p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </motion.div>
                </AnimatePresence>
            </Tabs>
        </div>
    )
}
