import type { TabState } from './types'
import { DEFAULT_START_HOURS_AGO } from './config'

export function parseValue(raw: string): number {
    return parseFloat(raw.split(' ')[0])
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(date: Date): string {
    return (
        date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
    )
}

export function toTimeStr(date: Date): string {
    return pad(date.getHours()) + ':' + pad(date.getMinutes())
}

export function combineToISO(date: string, time: string): string {
    return new Date(`${date}T${time}:00`).toISOString()
}

export function defaultStart(): TabState {
    const d = new Date()
    d.setHours(d.getHours() - DEFAULT_START_HOURS_AGO)
    const now = new Date()
    return {
        startDate: toDateStr(d),
        startTime: toTimeStr(d),
        endDate: toDateStr(now),
        endTime: toTimeStr(now),
    }
}
