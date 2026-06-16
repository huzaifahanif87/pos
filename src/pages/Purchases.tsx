import { useEffect, useState } from 'react'
import { Plus, Trash2, ClipboardList, FileDown, Eye, Search } from 'lucide-react'
import type { Product, Purchase, PurchaseItem, Vendor } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../store/app'
import { money, dt, num, isDecimalUnit } from '../lib/format'
import { Modal, Field, Badge, EmptyState, StatCard, Spinner, NumberInput } from '../components/ui'
import { exportPDF, type Column } from '../lib/export'

export default function Purchases() {
  const { settings, toast } = useApp()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<Purchase | null>(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    setPurchases(await api.listPurchases({ search }))
    setLoading(false)
  }
  useEffect(() => {
    void load()
  }, [])

  const totals = {
    count: purchases.length,
    value: purchases.reduce((a, p) => a + p.total, 0),
    due: purchases.reduce((a, p) => a + p.dueAmount, 0)
  }

  const exportList = async () => {
    const cols: Column[] = [
      { header: 'Bill', key: 'billNo' },
      { header: 'Date', key: 'date' },
      { header: 'Vendor', key: 'vendorName' },
      { header: 'Total', key: 'total', money: true, align: 'right' },
      { header: 'Paid', key: 'paid', money: true, align: 'right' },
      { header: 'Due', key: 'dueAmount', money: true, align: 'right' }
    ]
    const rows = purchases.map((p) => ({ ...p, date: dt(p.date) }))
    const ok = await exportPDF('purchases', { title: 'Purchases Report', shopName: settings?.shop.name, summary: [{ label: 'Total Purchases', value: money(totals.value) }, { label: 'Total Due', value: money(totals.due) }] }, cols, rows as unknown as Record<string, string | number>[])
    if (ok) toast('success', 'Exported')
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Purchase Bills" value={num(totals.count)} icon={<ClipboardList size={18} />} />
        <StatCard label="Total Purchased" value={money(totals.value)} tone="cyan" />
        <StatCard label="Payable Due" value={money(totals.due)} tone="rose" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Search bill or vendor…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <button className="btn-ghost" onClick={exportList}><FileDown size={16} /> Export</button>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New Purchase</button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? <Spinner /> : !purchases.length ? <EmptyState icon={<ClipboardList size={40} />} title="No purchases recorded" hint="Record stock you buy from vendors here" /> : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-white">
              <tr>
                <th className="th">Bill #</th><th className="th">Date</th><th className="th">Vendor</th>
                <th className="th text-right">Items</th><th className="th text-right">Total</th><th className="th text-right">Due</th>
                <th className="th">Status</th><th className="th text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {purchases.map((p) => (
                <tr key={p._id} className="hover:bg-gray-100">
                  <td className="td font-medium">{p.billNo}</td>
                  <td className="td text-gray-500">{dt(p.date)}</td>
                  <td className="td">{p.vendorName ?? '—'}</td>
                  <td className="td text-right">{p.items.length}</td>
                  <td className="td text-right font-medium">{money(p.total)}</td>
                  <td className="td text-right">{p.dueAmount > 0 ? <span className="text-amber-600">{money(p.dueAmount)}</span> : '—'}</td>
                  <td className="td"><Badge tone={p.status === 'received' ? 'green' : 'amber'}>{p.status}</Badge></td>
                  <td className="td text-right"><button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-cyan-600" onClick={() => setViewing(p)}><Eye size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <PurchaseForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load() }} />}
      {viewing && (
        <Modal open onClose={() => setViewing(null)} size="lg" title={`Purchase ${viewing.billNo}`}>
          <div className="mb-3 flex justify-between text-sm text-gray-500"><span>{dt(viewing.date)}</span><span>{viewing.vendorName}</span></div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200"><tr><th className="th">Item</th><th className="th text-right">Qty</th><th className="th text-right">Cost</th><th className="th text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {viewing.items.map((i, idx) => <tr key={idx}><td className="td">{i.name}</td><td className="td text-right">{i.qty}</td><td className="td text-right">{money(i.costPrice)}</td><td className="td text-right">{money(i.lineTotal)}</td></tr>)}
            </tbody>
          </table>
          <div className="mt-4 ml-auto w-56 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>Total</span><span className="font-bold text-gray-900">{money(viewing.total)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Paid</span><span>{money(viewing.paid)}</span></div>
            {viewing.dueAmount > 0 && <div className="flex justify-between text-amber-600"><span>Due</span><span>{money(viewing.dueAmount)}</span></div>}
          </div>
        </Modal>
      )}
    </div>
  )
}

function PurchaseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [vendorId, setVendorId] = useState('')
  const [lines, setLines] = useState<PurchaseItem[]>([])
  const [paid, setPaid] = useState(0)
  const [pick, setPick] = useState('')

  useEffect(() => {
    void api.listVendors().then(setVendors)
    void api.listProducts({ limit: 1000 }).then(setProducts)
  }, [])

  const addProduct = (p: Product) => {
    if (lines.some((l) => l.productId === p._id)) return
    setLines([...lines, { productId: p._id, sku: p.sku, name: p.name, qty: 1, costPrice: p.costPrice, discount: 0, taxRate: p.taxRate, lineTotal: p.costPrice }])
    setPick('')
  }
  const upd = (id: string, patch: Partial<PurchaseItem>) =>
    setLines(lines.map((l) => (l.productId === id ? { ...l, ...patch, lineTotal: ((patch.costPrice ?? l.costPrice) * (patch.qty ?? l.qty)) - (patch.discount ?? l.discount) } : l)))

  const total = lines.reduce((a, l) => a + l.lineTotal, 0)

  const save = async () => {
    if (!lines.length) return toast('error', 'Add at least one item')
    await api.savePurchase({ vendorId: vendorId || undefined, items: lines, paid, status: 'received' })
    toast('success', 'Purchase recorded & stock updated')
    onSaved()
  }

  const filtered = pick ? products.filter((p) => p.name.toLowerCase().includes(pick.toLowerCase()) || p.sku.toLowerCase().includes(pick.toLowerCase())).slice(0, 6) : []

  return (
    <Modal open onClose={onClose} size="xl" title="New Purchase" footer={
      <>
        <span className="mr-auto self-center text-sm">Total: <span className="font-bold text-gray-900">{money(total)}</span></span>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save}>Save Purchase</button>
      </>
    }>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <Field label="Vendor">
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">No vendor (cash purchase)</option>
            {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
          </select>
        </Field>
        <Field label="Amount Paid Now"><input type="number" className="input" value={paid} onChange={(e) => setPaid(Number(e.target.value))} /></Field>
      </div>

      <div className="relative mb-3">
        <input className="input" placeholder="Search product to add…" value={pick} onChange={(e) => setPick(e.target.value)} />
        {filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-xl">
            {filtered.map((p) => (
              <button key={p._id} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-gray-200" onClick={() => addProduct(p)}>
                <span>{p.name}</span><span className="text-gray-500">{money(p.costPrice)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200"><tr><th className="th">Item</th><th className="th">Qty</th><th className="th">Cost</th><th className="th text-right">Total</th><th className="th"></th></tr></thead>
          <tbody className="divide-y divide-gray-200">
            {lines.map((l) => {
              const prod = products.find((p) => p._id === l.productId)
              const dec = prod?.allowDecimal ?? isDecimalUnit(prod?.unit)
              return (
              <tr key={l.productId}>
                <td className="td">{l.name}<span className="ml-1 text-xs text-gray-400">/ {prod?.unit ?? 'pcs'}</span></td>
                <td className="td"><NumberInput className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1" value={l.qty} allowDecimal={dec} onChange={(n) => upd(l.productId, { qty: n })} /></td>
                <td className="td"><NumberInput className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1" value={l.costPrice} onChange={(n) => upd(l.productId, { costPrice: n })} /></td>
                <td className="td text-right">{money(l.lineTotal)}</td>
                <td className="td"><button className="text-gray-400 hover:text-rose-600" onClick={() => setLines(lines.filter((x) => x.productId !== l.productId))}><Trash2 size={15} /></button></td>
              </tr>
            )})}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
