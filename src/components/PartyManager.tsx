import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, BookOpen, HandCoins, FileDown, Users } from 'lucide-react'
import type { LedgerEntry, Party } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../store/app'
import { money, dtTime, num } from '../lib/format'
import { Modal, Field, Badge, EmptyState, StatCard, Spinner } from './ui'
import { exportExcel, exportPDF, type Column } from '../lib/export'

type Kind = 'customer' | 'vendor'

export function PartyManager({ kind }: { kind: Kind }) {
  const { settings, toast } = useApp()
  const [parties, setParties] = useState<Party[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Party> | null>(null)
  const [ledgerOf, setLedgerOf] = useState<Party | null>(null)
  const [payOf, setPayOf] = useState<Party | null>(null)

  const isCustomer = kind === 'customer'
  const balanceLabel = isCustomer ? 'Receivable (they owe)' : 'Payable (we owe)'

  const load = async () => {
    setLoading(true)
    const list = isCustomer ? await api.listCustomers() : await api.listVendors()
    setParties(list)
    setLoading(false)
  }
  useEffect(() => {
    void load()
  }, [kind])

  const filtered = useMemo(() => {
    if (!search.trim()) return parties
    const q = search.toLowerCase()
    return parties.filter((p) => p.name.toLowerCase().includes(q) || p.phone?.includes(q))
  }, [parties, search])

  const totalBalance = useMemo(() => parties.reduce((a, p) => a + p.balance, 0), [parties])
  const owing = useMemo(() => parties.filter((p) => p.balance > 0.01).length, [parties])

  const remove = async (p: Party) => {
    if (!confirm(`Delete "${p.name}"?`)) return
    if (isCustomer) await api.deleteCustomer(p._id)
    else await api.deleteVendor(p._id)
    toast('success', 'Deleted')
    void load()
  }

  const exportList = async () => {
    const cols: Column[] = [
      { header: 'Name', key: 'name', width: 26 },
      { header: 'Phone', key: 'phone' },
      { header: 'Opening', key: 'openingBalance', money: true, align: 'right' },
      { header: balanceLabel, key: 'balance', money: true, align: 'right' }
    ]
    const ok = await exportPDF(
      `${kind}s`,
      {
        title: `${isCustomer ? 'Customer' : 'Vendor'} Accounts`,
        shopName: settings?.shop.name,
        summary: [{ label: `Total ${balanceLabel}`, value: money(totalBalance) }]
      },
      cols,
      filtered as unknown as Record<string, string | number>[]
    )
    if (ok) toast('success', 'Exported')
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`Total ${isCustomer ? 'Customers' : 'Vendors'}`} value={num(parties.length)} icon={<Users size={18} />} />
        <StatCard label={balanceLabel} value={money(totalBalance)} tone={isCustomer ? 'emerald' : 'rose'} icon={<HandCoins size={18} />} />
        <StatCard label="Accounts with balance" value={num(owing)} tone="amber" icon={<BookOpen size={18} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder={`Search ${kind}s…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-ghost" onClick={exportList}><FileDown size={16} /> Export</button>
        <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add {isCustomer ? 'Customer' : 'Vendor'}</button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <Spinner />
        ) : !filtered.length ? (
          <EmptyState icon={<Users size={40} />} title={`No ${kind}s yet`} />
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-white">
              <tr>
                <th className="th">Name</th>
                <th className="th">Contact</th>
                <th className="th text-right">{balanceLabel}</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((p) => (
                <tr key={p._id} className="hover:bg-gray-100">
                  <td className="td">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {p.address && <p className="text-xs text-gray-400">{p.address}</p>}
                  </td>
                  <td className="td text-gray-500">
                    {p.phone || '—'}
                    {p.email && <p className="text-xs text-gray-400">{p.email}</p>}
                  </td>
                  <td className="td text-right">
                    {p.balance > 0.01 ? (
                      <Badge tone={isCustomer ? 'amber' : 'red'}>{money(p.balance)}</Badge>
                    ) : p.balance < -0.01 ? (
                      <Badge tone="green">{money(p.balance)} advance</Badge>
                    ) : (
                      <span className="text-gray-400">Settled</span>
                    )}
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-emerald-600" onClick={() => setPayOf(p)} title="Record payment">
                        <HandCoins size={15} />
                      </button>
                      <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-cyan-600" onClick={() => setLedgerOf(p)} title="View ledger">
                        <BookOpen size={15} />
                      </button>
                      <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900" onClick={() => setEditing(p)}>
                        <Pencil size={15} />
                      </button>
                      <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-rose-600" onClick={() => remove(p)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && <PartyForm kind={kind} party={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
      {payOf && <PaymentForm kind={kind} party={payOf} onClose={() => setPayOf(null)} onSaved={() => { setPayOf(null); void load() }} />}
      {ledgerOf && <LedgerView kind={kind} party={ledgerOf} onClose={() => setLedgerOf(null)} />}
    </div>
  )
}

function PartyForm({ kind, party, onClose, onSaved }: { kind: Kind; party: Partial<Party>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [form, setForm] = useState<Partial<Party>>({ openingBalance: 0, ...party })
  const set = (k: keyof Party, v: unknown) => setForm((f) => ({ ...f, [k]: v }))
  const save = async () => {
    if (!form.name?.trim()) return toast('error', 'Name is required')
    if (kind === 'customer') await api.saveCustomer(form)
    else await api.saveVendor(form)
    toast('success', 'Saved')
    onSaved()
  }
  return (
    <Modal open onClose={onClose} title={party._id ? 'Edit' : `New ${kind === 'customer' ? 'Customer' : 'Vendor'}`} footer={
      <>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save}>Save</button>
      </>
    }>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label="Name"><input className="input" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus /></Field></div>
        <Field label="Phone"><input className="input" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input className="input" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <div className="col-span-2"><Field label="Address"><input className="input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field></div>
        {!party._id && (
          <Field label="Opening Balance" hint={kind === 'customer' ? 'Amount they already owe you' : 'Amount you already owe them'}>
            <input type="number" className="input" value={form.openingBalance ?? 0} onChange={(e) => set('openingBalance', Number(e.target.value))} />
          </Field>
        )}
        {kind === 'customer' && (
          <Field label="Credit Limit"><input type="number" className="input" value={form.creditLimit ?? ''} onChange={(e) => set('creditLimit', Number(e.target.value))} /></Field>
        )}
        <div className="col-span-2"><Field label="Notes"><input className="input" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field></div>
      </div>
    </Modal>
  )
}

function PaymentForm({ kind, party, onClose, onSaved }: { kind: Kind; party: Party; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [amount, setAmount] = useState<number>(party.balance > 0 ? party.balance : 0)
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const save = async () => {
    if (amount <= 0) return toast('error', 'Enter an amount')
    await api.recordPayment(kind, { partyId: party._id, amount, method, note })
    toast('success', kind === 'customer' ? 'Payment received' : 'Payment made')
    onSaved()
  }
  return (
    <Modal open onClose={onClose} title={`${kind === 'customer' ? 'Receive Payment from' : 'Pay'} ${party.name}`} footer={
      <>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-success" onClick={save}>Record Payment</button>
      </>
    }>
      <div className="mb-4 rounded-xl bg-gray-100 p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-gray-500">Current Balance</p>
        <p className="text-2xl font-bold text-amber-600">{money(party.balance)}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount"><input type="number" className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} autoFocus /></Field>
        <Field label="Method">
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {['cash', 'card', 'mobile'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <div className="col-span-2"><Field label="Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
      </div>
    </Modal>
  )
}

function LedgerView({ kind, party, onClose }: { kind: Kind; party: Party; onClose: () => void }) {
  const { settings, toast } = useApp()
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    void api.getLedger(kind, party._id).then((e) => {
      setEntries(e)
      setLoading(false)
    })
  }, [kind, party._id])

  const exportLedger = async () => {
    const cols: Column[] = [
      { header: 'Date', key: 'date' },
      { header: 'Type', key: 'type' },
      { header: 'Reference', key: 'refNo' },
      { header: 'Debit', key: 'debit', money: true, align: 'right' },
      { header: 'Credit', key: 'credit', money: true, align: 'right' },
      { header: 'Balance', key: 'balanceAfter', money: true, align: 'right' }
    ]
    const rows = entries.map((e) => ({ ...e, date: dtTime(e.date), refNo: e.refNo ?? e.note ?? '' }))
    const ok = await exportExcel(`ledger-${party.name}`, {
      title: `Account Ledger — ${party.name}`,
      shopName: settings?.shop.name,
      summary: [{ label: 'Closing Balance', value: money(party.balance) }]
    }, cols, rows as unknown as Record<string, string | number>[])
    if (ok) toast('success', 'Ledger exported')
  }

  return (
    <Modal open onClose={onClose} size="xl" title={`Ledger — ${party.name}`} footer={
      <>
        <span className="mr-auto self-center text-sm text-gray-500">Closing balance: <span className="font-bold text-amber-600">{money(party.balance)}</span></span>
        <button className="btn-ghost" onClick={exportLedger}><FileDown size={16} /> Export Excel</button>
        <button className="btn-primary" onClick={onClose}>Close</button>
      </>
    }>
      {loading ? <Spinner /> : !entries.length ? <EmptyState title="No transactions yet" /> : (
        <table className="w-full">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="th">Date</th>
              <th className="th">Type</th>
              <th className="th">Reference</th>
              <th className="th text-right">Debit</th>
              <th className="th text-right">Credit</th>
              <th className="th text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((e) => (
              <tr key={e._id}>
                <td className="td text-gray-500">{dtTime(e.date)}</td>
                <td className="td capitalize">{e.type.replace('-', ' ')}</td>
                <td className="td text-gray-500">{e.refNo ?? e.note ?? '—'}</td>
                <td className="td text-right">{e.debit ? money(e.debit) : '—'}</td>
                <td className="td text-right text-emerald-600">{e.credit ? money(e.credit) : '—'}</td>
                <td className="td text-right font-medium">{money(e.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
