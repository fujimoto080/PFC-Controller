"use client"

import { DailyLog, FoodItem, PFC, UserSettings, DEFAULT_TARGET } from "./types"

const STORAGE_KEY_LOGS = "pfc_logs"
const STORAGE_KEY_SETTINGS = "pfc_settings"

// Helper to get today's date string YYYY-MM-DD
export function getTodayString(): string {
    return new Date().toISOString().split("T")[0]
}

export function getLogs(): Record<string, DailyLog> {
    if (typeof window === "undefined") return {}
    const stored = localStorage.getItem(STORAGE_KEY_LOGS)
    return stored ? JSON.parse(stored) : {}
}

export function getTodayLog(): DailyLog {
    const date = getTodayString()
    const logs = getLogs()
    return logs[date] || { date, items: [], total: { protein: 0, fat: 0, carbs: 0, calories: 0 } }
}

export function saveLog(log: DailyLog) {
    const logs = getLogs()
    logs[log.date] = log
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs))
}

export function addFoodItem(item: FoodItem) {
    const log = getTodayLog()
    log.items.push(item)

    // Recalculate totals
    log.total = log.items.reduce((acc, curr) => ({
        protein: acc.protein + curr.protein,
        fat: acc.fat + curr.fat,
        carbs: acc.carbs + curr.carbs,
        calories: acc.calories + curr.calories,
    }), { protein: 0, fat: 0, carbs: 0, calories: 0 })

    saveLog(log)
}

export function getSettings(): UserSettings {
    if (typeof window === "undefined") return { targetPFC: DEFAULT_TARGET }
    const stored = localStorage.getItem(STORAGE_KEY_SETTINGS)
    return stored ? JSON.parse(stored) : { targetPFC: DEFAULT_TARGET }
}

export function saveSettings(settings: UserSettings) {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings))
}
