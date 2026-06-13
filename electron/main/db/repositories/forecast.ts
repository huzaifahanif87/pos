import { addDays, endOfDay, format, startOfDay, subDays } from 'date-fns'
import { getDb } from '../datastore'
import { round2 } from '../util'
import type { ForecastResult, SeriesPoint } from '@shared/ipc'

/**
 * Sales forecast using a least-squares linear trend combined with day-of-week
 * seasonal factors. Explainable and robust on the small histories typical of a
 * single shop, with no external dependencies.
 */
export async function getForecast(days = 14): Promise<ForecastResult> {
  const db = getDb()
  const lookback = 60
  const todayStart = startOfDay(Date.now())
  const from = subDays(todayStart, lookback - 1).getTime()
  const sales = await db.sales.find({ status: 'completed', date: { $gte: from } })

  // daily totals
  const daily: number[] = []
  const history: SeriesPoint[] = []
  const dows: number[] = []
  for (let i = lookback - 1; i >= 0; i--) {
    const day = subDays(todayStart, i)
    const s = startOfDay(day).getTime()
    const e = endOfDay(day).getTime()
    const total = sales.filter((x) => x.date >= s && x.date <= e).reduce((a, x) => a + x.total, 0)
    daily.push(total)
    dows.push(day.getDay())
    history.push({ label: format(day, 'MMM d'), value: round2(total) })
  }

  const n = daily.length
  const mean = daily.reduce((a, v) => a + v, 0) / n || 0

  // Linear regression y = a + b*x
  const xs = daily.map((_, i) => i)
  const xMean = (n - 1) / 2
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (daily[i] - mean)
    den += (xs[i] - xMean) ** 2
  }
  const b = den === 0 ? 0 : num / den
  const a = mean - b * xMean

  // Day-of-week seasonal factors (ratio to mean)
  const dowSum = new Array(7).fill(0)
  const dowCount = new Array(7).fill(0)
  for (let i = 0; i < n; i++) {
    dowSum[dows[i]] += daily[i]
    dowCount[dows[i]] += 1
  }
  const dowFactor = dowSum.map((sum, d) => {
    const avg = dowCount[d] ? sum / dowCount[d] : mean
    return mean > 0 ? avg / mean : 1
  })

  const forecast: SeriesPoint[] = []
  let next7 = 0
  let next30Sum = 0
  for (let i = 1; i <= Math.max(days, 30); i++) {
    const idx = n - 1 + i
    const trend = a + b * idx
    const day = addDays(todayStart, i)
    const seasonal = dowFactor[day.getDay()] || 1
    const value = Math.max(0, round2(trend * seasonal))
    if (i <= days) forecast.push({ label: format(day, 'MMM d'), value })
    if (i <= 7) next7 += value
    if (i <= 30) next30Sum += value
  }

  const recent7 = daily.slice(-7).reduce((x, y) => x + y, 0)
  const prev7 = daily.slice(-14, -7).reduce((x, y) => x + y, 0)
  const growthRatePct = prev7 > 0 ? round2(((recent7 - prev7) / prev7) * 100) : 0

  return {
    history,
    forecast,
    method: 'Linear trend + weekday seasonality',
    growthRatePct,
    projectedNext7: round2(next7),
    projectedNext30: round2(next30Sum)
  }
}
