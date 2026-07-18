import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function parseJSON<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

export function tagsArray(str: string): string[] {
  return parseJSON<string[]>(str, [])
}

export function folderForType(entity_type: string): string {
  const map: Record<string, string> = {
    restaurant: 'restaurants',
    class: 'classes',
    show: 'shows',
    concert: 'shows',
    exhibit: 'events',
    market: 'events',
    fitness: 'classes',
    party: 'events',
    event: 'events',
    other: 'general',
  }
  return map[entity_type] ?? 'general'
}

export function formatPriceLevel(level: number | null): string {
  if (!level) return ''
  return '$'.repeat(level)
}

export function formatHours(hoursJson: string | null): Record<string, string> {
  if (!hoursJson) return {}
  return parseJSON(hoursJson, {})
}
