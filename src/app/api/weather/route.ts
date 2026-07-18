import { NextResponse } from 'next/server'
import { getForecast } from '@/lib/weather'

export async function GET() {
  const days = await getForecast()
  const res = NextResponse.json({ days })
  res.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600')
  return res
}
