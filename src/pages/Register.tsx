import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Trash2,
  Plus,
  Minus,
  Pause,
  Play,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  UserPlus,
  X
} from 'lucide-react'
import type { Customer, Product, Sale } from '@shared/types'
import { api } from '../lib/api'
import { useCart } from '../store/cart'
import { useApp } from '../store/app'
import { money, qty, isDecimalUnit } from '../lib/format'
import { exportReceiptPDF } from '../lib/export'
import { Modal, Badge, EmptyState, NumberInput } from '../components/ui'
import clsx from 'clsx'

export default function Register() {
  const cart = useCart()
  const { settings, user, toast } = useApp()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([])
  const [payOpen, setPayOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [held, setHeld] = useState<Sale[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const [p, c, cats] = await Promise.all([api.listProducts({ limit: 500 }), api.listCustomers(), api.listCategories()])
    setProducts(p)
    setCustomers(c)
    setCategories(cats)
  }

  useEffect(() => {
    void load()
    searchRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.active)
    if (category !== 'all') list = list.filter((p) => p.categoryId === category)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.includes(q))
    }
    return list.slice(0, 60)
  }, [products, search, category])

  const onSearchKey = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      const p = await api.findByBarcode(search.trim())
      if (p) {
        cart.add(p)
        setSearch('')
      } else if (filtered.length === 1) {
        cart.add(filtered[0])
        setSearch('')
      }
    }
  }

  const hold = async () => {
    if (!cart.lines.length) return
    await api.checkout({
      items: cart.lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price, discount: l.discount })),
      discount: cart.orderDiscount,
      paid: 0,
      paymentMethod: 'cash',
      customerId: cart.customerId,
      note: cart.note,
      hold: true
    })
    cart.clear()
    toast('info', 'Sale held')
  }

  const openHeld = async () => {
    setHeld(await api.listHeldSales())
    setHeldOpen(true)
  }

  const recall = (sale: Sale) => {
    cart.load(
      sale.items.map((i) => {
        const prod = products.find((p) => p._id === i.productId)
        return {
          productId: i.productId,
          sku: i.sku,
          name: i.name,
          price: i.price,
          qty: i.qty,
          discount: i.discount,
          taxRate: i.taxRate,
          stock: prod?.stock ?? 0,
          trackStock: prod?.trackStock ?? true,
          unit: prod?.unit ?? 'pcs',
          allowDecimal: prod?.allowDecimal ?? isDecimalUnit(prod?.unit)
        }
      }),
      sale.customerId,
      sale.note
    )
    setHeldOpen(false)
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-[1fr_400px] gap-5">
      {/* Product browser */}
      <div className="flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              className="input pl-10"
              placeholder="Scan barcode or search products… (press Enter)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKey}
            />
          </div>
          <button className="btn-ghost" onClick={openHeld}>
            <Play size={16} /> Held ({held.length || ''})
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('all')}
            className={clsx('chip', category === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c._id}
              onClick={() => setCategory(c._id)}
              className={clsx('chip', category === c._id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700')}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-y-auto pr-1 xl:grid-cols-4">
          {filtered.map((p) => {
            const out = p.trackStock && p.stock <= 0
            return (
              <button
                key={p._id}
                disabled={out}
                onClick={() => cart.add(p)}
                className="card flex flex-col items-start p-3 text-left transition hover:border-gray-900 hover:bg-gray-100 disabled:opacity-40"
              >
                <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-gray-100 text-sm font-bold text-gray-900">
                  {p.name[0]}
                </div>
                <p className="line-clamp-2 text-sm font-medium text-gray-900">{p.name}</p>
                <p className="mt-0.5 text-xs text-gray-400">{p.sku}</p>
                <div className="mt-2 flex w-full items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">{money(p.salePrice)}</span>
                  {p.trackStock && (
                    <span className={clsx('text-xs', p.stock <= p.lowStockThreshold ? 'text-amber-600' : 'text-gray-400')}>
                      {qty(p.stock)} {p.unit}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
          {!filtered.length && <div className="col-span-full"><EmptyState title="No products found" hint="Try another search or category" /></div>}
        </div>
      </div>

      {/* Cart */}
      <div className="card flex flex-col p-0">
        <div className="border-b border-gray-200 p-4">
          <select
            className="input"
            value={cart.customerId ?? ''}
            onChange={(e) => cart.setCustomer(e.target.value || undefined)}
          >
            <option value="">Walk-in customer</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} {c.balance > 0 ? `(owes ${money(c.balance)})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {!cart.lines.length ? (
            <EmptyState title="Cart is empty" hint="Tap products or scan a barcode to add them" />
          ) : (
            <div className="space-y-2">
              {cart.lines.map((l) => (
                <div key={l.productId} className="rounded-xl bg-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{l.name}</p>
                      <p className="text-xs text-gray-400">{money(l.price)} / {l.unit}{l.allowDecimal ? ' · by weight' : ''}</p>
                    </div>
                    <button className="text-gray-400 hover:text-rose-600" onClick={() => cart.remove(l.productId)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button className="grid h-7 w-7 place-items-center rounded-lg bg-gray-200 hover:bg-gray-300" onClick={() => cart.setQty(l.productId, l.qty - 1)}>
                        <Minus size={13} />
                      </button>
                      <NumberInput
                        className="w-16 rounded-lg border border-gray-300 bg-white px-1 py-1 text-center text-sm"
                        value={l.qty}
                        allowDecimal={l.allowDecimal}
                        onChange={(n) => cart.setQty(l.productId, n)}
                      />
                      <button className="grid h-7 w-7 place-items-center rounded-lg bg-gray-200 hover:bg-gray-300" onClick={() => cart.setQty(l.productId, l.qty + 1)}>
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{money(l.price * l.qty - l.discount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-gray-200 p-4">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{money(cart.subtotal())}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Discount</span>
            <input
              type="number"
              className="w-24 rounded-lg bg-gray-100 px-2 py-1 text-right text-sm"
              value={cart.orderDiscount || ''}
              placeholder="0"
              onChange={(e) => cart.setOrderDiscount(Number(e.target.value) || 0)}
            />
          </div>
          {cart.taxTotal() > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Tax</span>
              <span>{money(cart.taxTotal())}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900">
            <span>Total</span>
            <span className="text-gray-900">{money(cart.total())}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button className="btn-ghost" onClick={() => cart.clear()} disabled={!cart.lines.length}>
              <X size={15} /> Clear
            </button>
            <button className="btn-ghost" onClick={hold} disabled={!cart.lines.length}>
              <Pause size={15} /> Hold
            </button>
            <button className="btn-primary" onClick={() => setPayOpen(true)} disabled={!cart.lines.length}>
              Pay
            </button>
          </div>
        </div>
      </div>

      {payOpen && (
        <PaymentModal
          customers={customers}
          onClose={() => setPayOpen(false)}
          onDone={async (sale) => {
            setPayOpen(false)
            cart.clear()
            await load()
            toast('success', `Sale ${sale.invoiceNo} completed`)
            const printReceipt = async () => {
              await exportReceiptPDF({
                invoiceNo: sale.invoiceNo,
                date: sale.date,
                shopName: settings?.shop.name ?? 'Nexus POS',
                shopAddress: settings?.shop.address,
                shopPhone: settings?.shop.phone,
                cashier: user?.name,
                customer: sale.customerName,
                items: sale.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, lineTotal: i.lineTotal })),
                subtotal: sale.subtotal,
                discount: sale.discount,
                tax: sale.taxTotal,
                total: sale.total,
                paid: sale.paid,
                change: sale.change,
                due: sale.dueAmount,
                footer: settings?.shop.footerNote,
                widthMM: settings?.receiptWidthMM
              })
            }
            void printReceipt()
          }}
        />
      )}

      <Modal open={heldOpen} onClose={() => setHeldOpen(false)} title="Held Sales">
        {!held.length ? (
          <EmptyState title="No held sales" />
        ) : (
          <div className="space-y-2">
            {held.map((h) => (
              <button key={h._id} className="card flex w-full items-center justify-between p-3 text-left hover:border-gray-900" onClick={() => recall(h)}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{h.items.length} items · {money(h.total)}</p>
                  <p className="text-xs text-gray-400">{new Date(h.date).toLocaleString()}</p>
                </div>
                <Badge tone="amber">Recall</Badge>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

function PaymentModal({ customers, onClose, onDone }: { customers: Customer[]; onClose: () => void; onDone: (s: Sale) => void }) {
  const cart = useCart()
  const { toast } = useApp()
  const total = cart.total()
  const [method, setMethod] = useState<'cash' | 'card' | 'mobile' | 'credit'>('cash')
  const [paid, setPaid] = useState<number>(total)
  const [busy, setBusy] = useState(false)
  const change = Math.max(0, paid - total)
  const due = Math.max(0, total - paid)
  // A "credit" (on account) sale, or any non-cash sale paid short, needs a customer to bill.
  const needsCustomer = method === 'credit' || due > 0
  const missingCustomer = needsCustomer && !cart.customerId

  const methods = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'mobile', label: 'Mobile', icon: Smartphone },
    { id: 'credit', label: 'Credit', icon: UserPlus }
  ] as const

  const complete = async () => {
    if (missingCustomer) {
      toast('error', 'Choose a customer to put this sale on account')
      return
    }
    setBusy(true)
    try {
      const sale = await api.checkout({
        items: cart.lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price, discount: l.discount })),
        discount: cart.orderDiscount,
        paid: method === 'credit' ? 0 : paid,
        paymentMethod: method,
        customerId: cart.customerId,
        note: cart.note
      })
      onDone(sale)
    } catch (e) {
      toast('error', (e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Take Payment"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-success" onClick={complete} disabled={busy || missingCustomer}>
            <Printer size={16} /> Complete & Print
          </button>
        </>
      }
    >
      <div className="mb-4 rounded-2xl bg-gray-100 p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-gray-500">Amount Due</p>
        <p className="text-4xl font-bold text-gray-900">{money(total)}</p>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMethod(m.id)
              if (m.id === 'credit') setPaid(0)
              else setPaid(total)
            }}
            className={clsx(
              'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition',
              method === m.id ? 'border-gray-900 bg-gray-100 text-gray-900' : 'border-gray-200 bg-gray-100 text-gray-700'
            )}
          >
            <m.icon size={18} />
            {m.label}
          </button>
        ))}
      </div>

      {needsCustomer && (
        <div className="mb-4">
          <label className="label">Customer account {method === 'credit' ? '(required for credit)' : '(required — sale not fully paid)'}</label>
          <select
            className={clsx('input', missingCustomer && 'border-rose-500 ring-2 ring-rose-500/30')}
            value={cart.customerId ?? ''}
            onChange={(e) => cart.setCustomer(e.target.value || undefined)}
            autoFocus
          >
            <option value="">— Select a customer —</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.balance > 0 ? ` · owes ${money(c.balance)}` : ''}
              </option>
            ))}
          </select>
          {missingCustomer && <p className="mt-1.5 text-xs text-rose-600">Pick a customer — the unpaid {money(method === 'credit' ? total : due)} will be added to their account.</p>}
        </div>
      )}

      {method !== 'credit' && (
        <div className="mb-4">
          <label className="label">Amount Tendered</label>
          <input type="number" className="input text-lg" value={paid} onChange={(e) => setPaid(Number(e.target.value) || 0)} autoFocus />
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50].map((q, i) => (
              <button key={i} className="btn-ghost py-2 text-xs" onClick={() => setPaid(q)}>
                {money(q)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5 rounded-xl bg-gray-100 p-4 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
        {method !== 'credit' && (
          <div className="flex justify-between text-gray-500">
            <span>Paid</span>
            <span>{money(paid)}</span>
          </div>
        )}
        {change > 0 && method !== 'credit' && (
          <div className="flex justify-between font-semibold text-emerald-600">
            <span>Change</span>
            <span>{money(change)}</span>
          </div>
        )}
        {(due > 0 || method === 'credit') && (
          <div className="flex justify-between font-semibold text-amber-600">
            <span>On account (due)</span>
            <span>{money(method === 'credit' ? total : due)}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
