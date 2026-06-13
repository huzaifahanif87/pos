import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp, TrendingDown, CalendarDays, Sparkles } from 'lucide-react'
import type { ForecastResult } from '@shared/ipc'
import { api } from '../lib/api'
import { money, pct } from '../lib/format'
import { Card, StatCard, Spinner } from '../components/ui'

const tooltipStyle = {
  contentStyle: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#6b7280' }
}

export default function Forecast() {
  const [days, setDays] = useState(14)
  const [data, setData] = useState<ForecastResult | null>(null)

  useEffect(() => {
    setData(null)
    void api.getForecast(days).then(setData)
  }, [days])

  if (!data) return <Spinner label="Computing forecast…" />

  const combined = [
    ...data.history.map((h) => ({ label: h.label, actual: h.value })),
    ...data.forecast.map((f) => ({ label: f.label, forecast: f.value }))
  ]

  const up = data.growthRatePct >= 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Sparkles size={18} className="text-gray-900" /> Sales Forecast</h2>
          <p className="text-sm text-gray-500">{data.method}</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${days === d ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Projected Next 7 Days" value={money(data.projectedNext7)} tone="brand" icon={<CalendarDays size={18} />} />
        <StatCard label="Projected Next 30 Days" value={money(data.projectedNext30)} tone="violet" icon={<CalendarDays size={18} />} />
        <StatCard label="Weekly Growth" value={pct(data.growthRatePct)} tone={up ? 'emerald' : 'rose'} icon={up ? <TrendingUp size={18} /> : <TrendingDown size={18} />} sub="vs previous week" />
      </div>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Actual vs Forecast</h3>
        <p className="mb-4 text-xs text-gray-400">Solid = historical sales · Dashed = projection</p>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={combined} margin={{ left: -8, right: 10, top: 10 }}>
            <defs>
              <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#111827" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#111827" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.ceil(combined.length / 12)} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => money(v)} />
            <Area type="monotone" dataKey="actual" name="Actual" stroke="#111827" strokeWidth={2} fill="url(#gActual)" connectNulls />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#9ca3af" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-gray-100 p-2 text-gray-900"><Sparkles size={18} /></div>
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-gray-900">How this forecast works</p>
            <p className="mt-1 text-gray-500">
              Nexus analyzes up to 60 days of sales history, fits a linear trend line, then layers in day-of-week
              seasonality (e.g. busier weekends) to project the days ahead. The more you sell, the sharper the
              forecast becomes. Use it to plan stock orders and staffing.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
