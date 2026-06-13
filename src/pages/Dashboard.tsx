import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { DollarSign, TrendingUp, ShoppingBag, Users, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react'
import type { DashboardData } from '@shared/ipc'
import { api } from '../lib/api'
import { money, num } from '../lib/format'
import { Card, StatCard, Spinner, Badge, EmptyState } from '../components/ui'

const PIE_COLORS = ['#111827', '#4b5563', '#6b7280', '#9ca3af', '#374151', '#1f2937', '#d1d5db', '#e5e7eb']

function ChartCard({ title, children, sub }: { title: string; children: React.ReactNode; sub?: string }) {
  return (
    <Card className="flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#6b7280' }
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    void api.getDashboard().then(setData)
  }, [])

  if (!data) return <Spinner label="Loading dashboard…" />
  const k = data.kpis

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={money(k.todaySales)} tone="brand" icon={<DollarSign size={18} />} sub={`${num(k.todayTransactions)} transactions`} />
        <StatCard label="Today's Profit" value={money(k.todayProfit)} tone="emerald" icon={<TrendingUp size={18} />} sub={`Avg basket ${money(k.todayAvgBasket)}`} />
        <StatCard label="This Month" value={money(k.monthSales)} tone="violet" icon={<ShoppingBag size={18} />} sub={`Profit ${money(k.monthProfit)}`} />
        <StatCard label="Inventory Value" value={money(k.inventoryValue)} tone="cyan" icon={<Package size={18} />} sub={`${num(k.totalProducts)} products`} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Receivable" value={money(k.totalReceivable)} tone="amber" icon={<ArrowUpRight size={18} />} sub="Customers owe you" />
        <StatCard label="Payable" value={money(k.totalPayable)} tone="rose" icon={<ArrowDownRight size={18} />} sub="You owe vendors" />
        <StatCard label="Low Stock" value={num(k.lowStockCount)} tone="amber" icon={<AlertTriangle size={18} />} sub={`${num(k.outOfStockCount)} out of stock`} />
        <StatCard label="Customers" value={num(k.totalCustomers)} tone="brand" icon={<Users size={18} />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Sales & Profit Trend" sub="Last 14 days">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.salesTrend} margin={{ left: -10, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#111827" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#111827" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#9ca3af" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => money(v)} />
                <Area type="monotone" dataKey="value" name="Sales" stroke="#111827" strokeWidth={2} fill="url(#gSales)" />
                <Area type="monotone" dataKey="secondary" name="Profit" stroke="#9ca3af" strokeWidth={2} fill="url(#gProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Sales by Category" sub="This month">
          {data.salesByCategory.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.salesByCategory} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {data.salesByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v: number) => money(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No category data yet" />}
          <div className="mt-2 flex flex-wrap gap-2">
            {data.salesByCategory.slice(0, 6).map((c, i) => (
              <span key={c.label} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {c.label}
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Hourly Sales Pattern" sub="When customers buy (this month)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.hourlyHeat.filter((_, i) => i >= 6 && i <= 23)} margin={{ left: -15, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => money(v)} />
              <Bar dataKey="value" fill="#111827" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Products" sub="By revenue this month">
          {data.topProducts.length ? (
            <div className="space-y-2.5">
              {data.topProducts.slice(0, 6).map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-900">{p.name}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-gray-700" style={{ width: `${(p.revenue / data.topProducts[0].revenue) * 100}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-gray-700">{money(p.revenue)}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No sales yet" />}
        </ChartCard>

        <ChartCard title="Payment Methods" sub="This month">
          {data.paymentBreakdown.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.paymentBreakdown} dataKey="value" nameKey="label" outerRadius={85} label={(e) => e.label}>
                  {data.paymentBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v: number) => money(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No payments yet" />}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent Sales</h3>
          {data.recentSales.length ? (
            <div className="divide-y divide-gray-200">
              {data.recentSales.map((s) => (
                <div key={s._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.invoiceNo}</p>
                    <p className="text-xs text-gray-400">{s.customerName ?? 'Walk-in'} · {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{money(s.total)}</p>
                    {s.status === 'refunded' ? <Badge tone="red">Refunded</Badge> : <span className="text-xs capitalize text-gray-400">{s.paymentMethod}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No sales yet" />}
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><AlertTriangle size={15} className="text-amber-600" /> Low Stock Alerts</h3>
          {data.lowStock.length ? (
            <div className="divide-y divide-gray-200">
              {data.lowStock.map((p) => (
                <div key={p._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sku}</p>
                  </div>
                  <Badge tone={p.stock <= 0 ? 'red' : 'amber'}>{p.stock <= 0 ? 'Out of stock' : `${num(p.stock)} left`}</Badge>
                </div>
              ))}
            </div>
          ) : <div className="flex items-center gap-2 py-6 text-sm text-emerald-600"><Wallet size={16} /> All products well stocked</div>}
        </Card>
      </div>
    </div>
  )
}
