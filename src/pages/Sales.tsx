import { useEffect, useMemo, useState } from 'react'
import { startOfDay, startOfMonth, subDays } from 'date-fns'
import { Search, Eye, RotateCcw, Printer, FileDown, ReceiptText } from 'lucide-react'
import type { Sale } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../store/app'
import { can } from '../lib/permissions'
import { money, dtTime, num } from '../lib/format'
import { Modal, Badge, EmptyState, StatCard, Spinner } from '../components/ui'
import { exportExcel, exportPDF, exportReceiptPDF, type Column } from '../lib/export'

const RANGES = [
  { label: 'Today', from: () => startOfDay(Date.now()).getTime() },
  { label: '7 Days', from: () => subDays(Date.now(), 7).getTime() },
  { label: '30 Days', from: () => subDays(Date.now(), 30).getTime() },
  { label: 'This Month', from: () => startOfMonth(Date.now()).getTime() },
  { label: 'All', from: () => 0 }
]

export default function Sales() {
  const { settings, user, toast } = useApp()
  const [sales, setSales] = useState<Sale[]>([])
  const [range, setRange] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<Sale | null>(null)

  const load = async () => {
    setLoading(true)
    const data = await api.listSales({ from: RANGES[range].from(), to: Date.now(), search, limit: 500 })
    setSales(data)
    setLoading(false)
  }
  useEffect(() => {
    void load()
  }, [range])

  const filtered = useMemo(() => {
    if (!search.trim()) return sales
    const q = search.toLowerCase()
    return sales.filter((s) => s.invoiceNo.toLowerCase().includes(q) || s.customerName?.toLowerCase().includes(q))
  }, [sales, search])

  const totals = useMemo(() => {
    const completed = filtered.filter((s) => s.status === 'completed')
    return {
      count: completed.length,
      revenue: completed.reduce((a, s) => a + s.total, 0),
      profit: completed.reduce((a, s) => a + s.profit, 0),
      due: filtered.reduce((a, s) => a + s.dueAmount, 0)
    }
  }, [filtered])

  const refund = async (s: Sale) => {
    if (!confirm(`Refund invoice ${s.invoiceNo}? This restocks items and reverses any dues.`)) return
    await api.refundSale(s._id)
    toast('success', 'Sale refunded')
    void load()
  }

  const reprint = async (s: Sale) => {
    await exportReceiptPDF({
      invoiceNo: s.invoiceNo,
      date: s.date,
      shopName: settings?.shop.name ?? 'Nexus POS',
      shopAddress: settings?.shop.address,
      shopPhone: settings?.shop.phone,
      cashier: user?.name,
      customer: s.customerName,
      items: s.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, lineTotal: i.lineTotal })),
      subtotal: s.subtotal,
      discount: s.discount,
      tax: s.taxTotal,
      total: s.total,
      paid: s.paid,
      change: s.change,
      due: s.dueAmount,
      footer: settings?.shop.footerNote,
      widthMM: settings?.receiptWidthMM
    })
  }

  const exportSales = async (kind: 'pdf' | 'xlsx') => {
    const cols: Column[] = [
      { header: 'Invoice', key: 'invoiceNo' },
      { header: 'Date', key: 'date', width: 22 },
      { header: 'Customer', key: 'customer' },
      { header: 'Method', key: 'paymentMethod' },
      { header: 'Total', key: 'total', money: true, align: 'right' },
      { header: 'Paid', key: 'paid', money: true, align: 'right' },
      { header: 'Due', key: 'dueAmount', money: true, align: 'right' },
      { header: 'Status', key: 'status' }
    ]
    const rows = filtered.map((s) => ({ ...s, date: dtTime(s.date), customer: s.customerName ?? 'Walk-in' }))
    const meta = {
      title: 'Sales Report',
      subtitle: RANGES[range].label,
      shopName: settings?.shop.name,
      summary: [
        { label: 'Transactions', value: num(totals.count) },
        { label: 'Revenue', value: money(totals.revenue) },
        { label: 'Profit', value: money(totals.profit) }
      ]
    }
    const ok = kind === 'pdf'
      ? await exportPDF('sales', meta, cols, rows as unknown as Record<string, string | number>[])
      : await exportExcel('sales', meta, cols, rows as unknown as Record<string, string | number>[])
    if (ok) toast('success', 'Sales exported')
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Transactions" value={num(totals.count)} icon={<ReceiptText size={18} />} />
        <StatCard label="Revenue" value={money(totals.revenue)} tone="emerald" />
        {can(user?.role, 'viewProfit') && <StatCard label="Profit" value={money(totals.profit)} tone="violet" />}
        <StatCard label="Outstanding Due" value={money(totals.due)} tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setRange(i)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${range === i ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Search invoice or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-ghost" onClick={() => exportSales('pdf')}><FileDown size={16} /> PDF</button>
        <button className="btn-ghost" onClick={() => exportSales('xlsx')}>Excel</button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? <Spinner /> : !filtered.length ? <EmptyState icon={<ReceiptText size={40} />} title="No sales in this period" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-white">
                <tr>
                  <th className="th">Invoice</th>
                  <th className="th">Date</th>
                  <th className="th">Customer</th>
                  <th className="th">Method</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Due</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-100">
                    <td className="td font-medium">{s.invoiceNo}</td>
                    <td className="td text-gray-500">{dtTime(s.date)}</td>
                    <td className="td">{s.customerName ?? 'Walk-in'}</td>
                    <td className="td capitalize text-gray-500">{s.paymentMethod}</td>
                    <td className="td text-right font-medium">{money(s.total)}</td>
                    <td className="td text-right">{s.dueAmount > 0 ? <span className="text-amber-600">{money(s.dueAmount)}</span> : '—'}</td>
                    <td className="td">
                      {s.status === 'completed' ? <Badge tone="green">Completed</Badge> : s.status === 'refunded' ? <Badge tone="red">Refunded</Badge> : <Badge tone="amber">{s.status}</Badge>}
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-cyan-600" onClick={() => setViewing(s)}><Eye size={15} /></button>
                        <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900" onClick={() => reprint(s)}><Printer size={15} /></button>
                        {s.status === 'completed' && can(user?.role, 'refund') && (
                          <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-rose-600" onClick={() => refund(s)}><RotateCcw size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && (
        <Modal open onClose={() => setViewing(null)} size="lg" title={`Invoice ${viewing.invoiceNo}`} footer={<button className="btn-primary" onClick={() => reprint(viewing)}><Printer size={16} /> Print Receipt</button>}>
          <div className="mb-3 flex justify-between text-sm text-gray-500">
            <span>{dtTime(viewing.date)}</span>
            <span>{viewing.customerName ?? 'Walk-in'}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr><th className="th">Item</th><th className="th text-right">Qty</th><th className="th text-right">Price</th><th className="th text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {viewing.items.map((i, idx) => (
                <tr key={idx}><td className="td">{i.name}</td><td className="td text-right">{i.qty}</td><td className="td text-right">{money(i.price)}</td><td className="td text-right">{money(i.lineTotal)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 ml-auto w-56 space-y-1 text-sm">
            <Row label="Subtotal" value={money(viewing.subtotal)} />
            {viewing.discount > 0 && <Row label="Discount" value={`-${money(viewing.discount)}`} />}
            {viewing.taxTotal > 0 && <Row label="Tax" value={money(viewing.taxTotal)} />}
            <Row label="Total" value={money(viewing.total)} bold />
            <Row label="Paid" value={money(viewing.paid)} />
            {viewing.dueAmount > 0 && <Row label="Due" value={money(viewing.dueAmount)} />}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-gray-200 pt-1 font-bold text-gray-900' : 'text-gray-500'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
