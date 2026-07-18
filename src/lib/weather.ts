/**
 * NYC weather via Open-Meteo (free, no key). Cached in-module for 30 minutes.
 * Used for feed ranking (boost indoor on rainy days, outdoor on nice ones),
 * forecast chips on cards, and the You page strip.
 */

export interface DayForecast {
  date: string // YYYY-MM-DD
  precipProb: number // 0-100
  tempMax: number // °F
  code: number // WMO weather code
}

const NYC = { lat: 40.7128, lon: -74.006 }
const CACHE_MS = 30 * 60 * 1000

let cache: { at: number; days: Record<string, DayForecast> } | null = null

export async function getForecast(): Promise<Record<string, DayForecast>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.days
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${NYC.lat}&longitude=${NYC.lon}` +
      `&daily=precipitation_probability_max,temperature_2m_max,weather_code` +
      `&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=14`
    const res = await fetch(url, { next: { revalidate: 1800 } })
    const data = await res.json()
    const days: Record<string, DayForecast> = {}
    const d = data.daily
    for (let i = 0; i < (d?.time?.length ?? 0); i++) {
      days[d.time[i]] = {
        date: d.time[i],
        precipProb: d.precipitation_probability_max?.[i] ?? 0,
        tempMax: Math.round(d.temperature_2m_max?.[i] ?? 70),
        code: d.weather_code?.[i] ?? 0,
      }
    }
    cache = { at: Date.now(), days }
    return days
  } catch {
    return cache?.days ?? {}
  }
}

export function weatherEmoji(f: DayForecast): string {
  if (f.precipProb >= 60) return '🌧'
  if (f.precipProb >= 35) return '🌦'
  if (f.code >= 71 && f.code <= 77) return '🌨'
  if (f.tempMax >= 88) return '🥵'
  return '☀️'
}

export function isNiceDay(f: DayForecast): boolean {
  return f.precipProb < 25 && f.tempMax >= 58 && f.tempMax <= 88
}

export function isRainyDay(f: DayForecast): boolean {
  return f.precipProb >= 55
}

/**
 * Score adjustment for an event given its indoor/outdoor tags and date.
 * Positive = boost, negative = penalty. Zero when weather is neutral,
 * the setting is unknown, or the date is beyond the forecast window.
 */
export function weatherAdjust(
  tags: string[],
  eventDate: Date | null,
  forecast: Record<string, DayForecast>
): number {
  if (!eventDate) return 0
  const key = eventDate.toISOString().slice(0, 10)
  const f = forecast[key]
  if (!f) return 0
  const outdoor = tags.includes('Outdoor')
  const indoor = tags.includes('Indoor')
  if (outdoor && isRainyDay(f)) return -18
  if (outdoor && f.tempMax >= 92) return -8
  if (outdoor && isNiceDay(f)) return 10
  if (indoor && isRainyDay(f)) return 6
  return 0
}
