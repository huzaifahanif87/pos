import { useEffect, useState } from 'react'
import { endOfDay, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileDown, Scale, TrendingUp, CalendarRange, FileSpreadsheet, FileText } from 'lucide-react'
import type { BalanceSheetReport, ProfitLossReport, SalesSummaryRow } from '@shared/ipc'
import { api } from '../lib/api'
import { useApp } from '../store/app'
import { money, dt } from '../lib/format'
import { Card, Spinner, EmptyState } from '../components/ui'
import { exportCSV, exportExcel, exportPDF, type Column } from '../lib/export'

const RANGES = [
  { label: 'Today', from: () => startOfDay(Date.now()).getTime() },
  { label: '7 Days', from: () => subDays(Date.now(), 6).getTime() },
  { label: '30 Days', from: () => subDays(Date.now(), 29).getTime() },
  { label: 'This Month', from: () => startOfMonth(Date.now()).getTime() },
  { label: '3 Months', from: () => subMonths(Date.now(), 3).getTime() }
]

type Tab = 'pl' | 'balance' | 'daily'

export default function Reports() {
  const { settings, toast } = useApp()
  const [tab, setTab] = useState<Tab>('pl')
  const [rangeIdx, setRangeIdx] = useState(2)
  const [pl, setPl] = useState<ProfitLossReport | null>(null)
  const [bs, setBs] = useState<BalanceSheetReport | null>(null)
  const [daily, setDaily] = useState<SalesSummaryRow[] | null>(null)

  const range = { from: RANGES[rangeIdx].from(), to: endOfDay(Date.now()).getTime() }

  useEffect(() => {
    setPl(null)
    setDaily(null)
    void api.getProfitLoss(range).then(setPl)
    void api.getSalesSummary(range).then(setDaily)
    void api.getBalanceSheet(Date.now()).then(setBs)
  }, [rangeIdx])

  const shopName = settings?.shop.name

  const exportPL = async (kind: 'pdf' | 'xlsx') => {
    if (!pl) return
    const cols: Column[] = [{ header: 'Line Item', key: 'item', width: 34 }, { header: 'Amount', key: 'amount', money: true, align: 'right' }]
    const rows = [
      { item: 'Gross Sales', amount: pl.grossSales },
      { item: 'Less: Discounts', amount: -pl.discounts },
      { item: 'Net Sales', amount: pl.netSales },
      { item: 'Less: Cost of Goods Sold', amount: -pl.cogs },
      { item: 'Gross Profit', amount: pl.grossProfit },
      { item: 'Less: Operating Expenses', amount: -pl.expenses },
      { item: 'Net Profit', amount: pl.netProfit },
      { item: 'Tax Collected (payable)', amount: pl.taxCollected }
    ]
    const meta = { title: 'Profit & Loss Statement', subtitle: `${dt(range.from)} – ${dt(range.to)}`, shopName, summary: [{ label: 'Net Profit', value: money(pl.netProfit) }] }
    const ok = kind === 'pdf' ? await exportPDF('profit-loss', meta, cols, rows) : await exportExcel('profit-loss', meta, cols, rows)
    if (ok) toast('success', 'P&L exported')
  }

  const exportBalance = async (kind: 'pdf' | 'xlsx') => {
    if (!bs) return
    const cols: Column[] = [{ header: 'Account', key: 'item', width: 34 }, { header: 'Amount', key: 'amount', money: true, align: 'right' }]
    const rows = [
      { item: 'ASSETS', amount: '' as unknown as number },
      { item: '  Cash & Equivalents', amount: bs.assets.cashAndEquivalents },
      { item: '  Inventory', amount: bs.assets.inventoryValue },
      { item: '  Accounts Receivable', amount: bs.assets.accountsReceivable },
      { item: 'Total Assets', amount: bs.assets.total },
      { item: 'LIABILITIES', amount: '' as unknown as number },
      { item: '  Accounts Payable', amount: bs.liabilities.accountsPayable },
      { item: 'Total Liabilities', amount: bs.liabilities.total },
      { item: "Owner's Equity", amount: bs.equity.ownersEquity }
    ]
    const meta = { title: 'Balance Sheet', subtitle: `As of ${dt(bs.asOf)}`, shopName }
    const ok = kind === 'pdf' ? await exportPDF('balance-sheet', meta, cols, rows) : await exportExcel('balance-sheet', meta, cols, rows)
    if (ok) toast('success', 'Balance sheet exported')
  }

  const exportDaily = async (kind: 'pdf' | 'xlsx' | 'csv') => {
    if (!daily) return
    const cols: Column[] = [
      { header: 'Date', key: 'date' },
      { header: 'Txns', key: 'transactions', align: 'right' },
      { header: 'Gross', key: 'gross', money: true, align: 'right' },
      { header: 'Discount', key: 'discount', money: true, align: 'right' },
      { header: 'Tax', key: 'tax', money: true, align: 'right' },
      { header: 'Net Sales', key: 'net', money: true, align: 'right' },
      { header: 'Profit', key: 'profit', money: true, align: 'right' }
    ]
    const meta = {
      title: 'Daily Sales Sheet',
      subtitle: `${dt(range.from)} – ${dt(range.to)}`,
      shopName,
      summary: [
        { label: 'Total Net Sales', value: money(daily.reduce((a, d) => a + d.net, 0)) },
        { label: 'Total Profit', value: money(daily.reduce((a, d) => a + d.profit, 0)) }
      ]
    }
    const ok = kind === 'pdf' ? await exportPDF('daily-sales', meta, cols, daily as unknown as Record<string, string | number>[])
      : kind === 'xlsx' ? await exportExcel('daily-sales', meta, cols, daily as unknown as Record<string, string | number>[])
        : await exportCSV('daily-sales', cols, daily as unknown as Record<string, string | number>[])
    if (ok) toast('success', 'Daily sales exported')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {([['pl', 'Profit & Loss', TrendingUp], ['balance', 'Balance Sheet', Scale], ['daily', 'Daily Sales', CalendarRange]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        {tab !== 'balance' && (
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {RANGES.map((r, i) => (
              <button key={r.label} onClick={() => setRangeIdx(i)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${rangeIdx === i ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>{r.label}</button>
            ))}
          </div>
        )}
      </div>

      {tab === 'pl' && (
        !pl ? <Spinner /> : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Profit & Loss Statement</h3>
                <div className="flex gap-1.5">
                  <button className="btn-ghost py-1.5 text-xs" onClick={() => exportPL('pdf')}><FileText size={14} /> PDF</button>
                  <button className="btn-ghost py-1.5 text-xs" onClick={() => exportPL('xlsx')}><FileSpreadsheet size={14} /> Excel</button>
                </div>
              </div>
              <div className="space-y-1">
                <PLRow label="Gross Sales" value={pl.grossSales} />
                <PLRow label="Less: Discounts" value={-pl.discounts} muted />
                <PLRow label="Net Sales" value={pl.netSales} bold />
                <PLRow label="Less: Cost of Goods Sold" value={-pl.cogs} muted />
                <PLRow label="Gross Profit" value={pl.grossProfit} bold tone="emerald" />
                <PLRow label="Less: Operating Expenses" value={-pl.expenses} muted />
                <div className="my-2 border-t border-gray-200" />
                <PLRow label="NET PROFIT" value={pl.netProfit} bold big tone={pl.netProfit >= 0 ? 'emerald' : 'rose'} />
                <div className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">Tax collected (payable to authority): {money(pl.taxCollected)}</div>
              </div>
            </Card>
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Expense Breakdown</h3>
              {pl.expenseByCategory.length ? (
                <div className="space-y-2.5">
                  {pl.expenseByCategory.map((e) => (
                    <div key={e.category} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{e.category}</span>
                      <span className="text-sm font-medium text-gray-900">{money(e.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No expenses in this period" />}
            </Card>
          </div>
        )
      )}

      {tab === 'balance' && (
        !bs ? <Spinner /> : (
          <Card className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Balance Sheet</h3>
                <p className="text-xs text-gray-400">As of {dt(bs.asOf)}</p>
              </div>
              <div className="flex gap-1.5">
                <button className="btn-ghost py-1.5 text-xs" onClick={() => exportBalance('pdf')}><FileText size={14} /> PDF</button>
                <button className="btn-ghost py-1.5 text-xs" onClick={() => exportBalance('xlsx')}><FileSpreadsheet size={14} /> Excel</button>
              </div>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">Assets</p>
            <PLRow label="Cash & Equivalents" value={bs.assets.cashAndEquivalents} />
            <PLRow label="Inventory at Cost" value={bs.assets.inventoryValue} />
            <PLRow label="Accounts Receivable" value={bs.assets.accountsReceivable} />
            <PLRow label="Total Assets" value={bs.assets.total} bold />
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-rose-600">Liabilities</p>
            <PLRow label="Accounts Payable" value={bs.liabilities.accountsPayable} />
            <PLRow label="Total Liabilities" value={bs.liabilities.total} bold />
            <div className="my-3 border-t border-gray-200" />
            <PLRow label="Owner's Equity" value={bs.equity.ownersEquity} bold big tone="emerald" />
          </Card>
        )
      )}

      {tab === 'daily' && (
        !daily ? <Spinner /> : (
          <div className="space-y-4">
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Net Sales by Day</h3>
              {daily.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={daily} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }} formatter={(v: number) => money(v)} />
                    <Bar dataKey="net" name="Net Sales" fill="#111827" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Profit" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState title="No sales in this period" />}
            </Card>
            <Card className="p-0">
              <div className="flex items-center justify-between p-4">
                <h3 className="text-sm font-semibold text-gray-900">Daily Sales Sheet</h3>
                <div className="flex gap-1.5">
                  <button className="btn-ghost py-1.5 text-xs" onClick={() => exportDaily('pdf')}><FileText size={14} /> PDF</button>
                  <button className="btn-ghost py-1.5 text-xs" onClick={() => exportDaily('xlsx')}><FileSpreadsheet size={14} /> Excel</button>
                  <button className="btn-ghost py-1.5 text-xs" onClick={() => exportDaily('csv')}><FileDown size={14} /> CSV</button>
                </div>
              </div>
              {daily.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-y border-gray-200 bg-white">
                      <tr><th className="th">Date</th><th className="th text-right">Txns</th><th className="th text-right">Gross</th><th className="th text-right">Discount</th><th className="th text-right">Tax</th><th className="th text-right">Net Sales</th><th className="th text-right">Profit</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {daily.map((d) => (
                        <tr key={d.date} className="hover:bg-gray-100">
                          <td className="td">{d.date}</td>
                          <td className="td text-right">{d.transactions}</td>
                          <td className="td text-right">{money(d.gross)}</td>
                          <td className="td text-right text-gray-500">{money(d.discount)}</td>
                          <td className="td text-right text-gray-500">{money(d.tax)}</td>
                          <td className="td text-right font-medium">{money(d.net)}</td>
                          <td className="td text-right text-emerald-600">{money(d.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 font-semibold">
                        <td className="td">Total</td>
                        <td className="td text-right">{daily.reduce((a, d) => a + d.transactions, 0)}</td>
                        <td className="td text-right">{money(daily.reduce((a, d) => a + d.gross, 0))}</td>
                        <td className="td text-right">{money(daily.reduce((a, d) => a + d.discount, 0))}</td>
                        <td className="td text-right">{money(daily.reduce((a, d) => a + d.tax, 0))}</td>
                        <td className="td text-right">{money(daily.reduce((a, d) => a + d.net, 0))}</td>
                        <td className="td text-right text-emerald-600">{money(daily.reduce((a, d) => a + d.profit, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )
      )}
    </div>
  )
}

function PLRow({ label, value, bold, big, muted, tone }: { label: string; value: number; bold?: boolean; big?: boolean; muted?: boolean; tone?: 'emerald' | 'rose' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : bold ? 'text-gray-900' : 'text-gray-700'
  return (
    <div className={`flex items-center justify-between py-1.5 ${big ? 'text-lg' : 'text-sm'} ${muted ? 'text-gray-400' : ''}`}>
      <span className={bold ? 'font-semibold' : ''}>{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${toneClass}`}>{money(value)}</span>
    </div>
  )
}
