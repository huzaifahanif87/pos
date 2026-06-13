import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Wallet, FileDown } from 'lucide-react'
import type { Expense } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../store/app'
import { money, dt, num } from '../lib/format'
import { Modal, Field, EmptyState, StatCard, Spinner } from '../components/ui'
import { exportExcel, type Column } from '../lib/export'

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Marketing', 'Maintenance', 'Other']

export default function Expenses() {
  const { settings, toast } = useApp()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    setExpenses(await api.listExpenses({ limit: 500 }))
    setLoading(false)
  }
  useEffect(() => {
    void load()
  }, [])

  const total = useMemo(() => expenses.reduce((a, e) => a + e.amount, 0), [expenses])
  const thisMonth = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return expenses.filter((e) => e.date >= start.getTime()).reduce((a, e) => a + e.amount, 0)
  }, [expenses])

  const del = async (id: string) => {
    await api.deleteExpense(id)
    void load()
  }

  const exportData = async () => {
    const cols: Column[] = [
      { header: 'Date', key: 'date' },
      { header: 'Category', key: 'category' },
      { header: 'Note', key: 'note', width: 30 },
      { header: 'Amount', key: 'amount', money: true, align: 'right' }
    ]
    const rows = expenses.map((e) => ({ ...e, date: dt(e.date) }))
    const ok = await exportExcel('expenses', { title: 'Expenses Report', shopName: settings?.shop.name, summary: [{ label: 'Total', value: money(total) }] }, cols, rows as unknown as Record<string, string | number>[])
    if (ok) toast('success', 'Exported')
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Expenses" value={money(total)} tone="rose" icon={<Wallet size={18} />} />
        <StatCard label="This Month" value={money(thisMonth)} tone="amber" />
        <StatCard label="Entries" value={num(expenses.length)} />
      </div>
      <div className="flex items-center justify-end gap-3">
        <button className="btn-ghost" onClick={exportData}><FileDown size={16} /> Export</button>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Add Expense</button>
      </div>
      <div className="card overflow-hidden p-0">
        {loading ? <Spinner /> : !expenses.length ? <EmptyState icon={<Wallet size={40} />} title="No expenses recorded" /> : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-white"><tr><th className="th">Date</th><th className="th">Category</th><th className="th">Note</th><th className="th text-right">Amount</th><th className="th"></th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {expenses.map((e) => (
                <tr key={e._id} className="hover:bg-gray-100">
                  <td className="td text-gray-500">{dt(e.date)}</td>
                  <td className="td">{e.category}</td>
                  <td className="td text-gray-500">{e.note ?? '—'}</td>
                  <td className="td text-right font-medium">{money(e.amount)}</td>
                  <td className="td text-right"><button className="text-gray-400 hover:text-rose-600" onClick={() => del(e._id)}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <ExpenseForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load() }} />}
    </div>
  )
}

function ExpenseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [form, setForm] = useState<Partial<Expense>>({ category: 'Rent', amount: 0, date: Date.now() })
  const save = async () => {
    if (!form.amount || form.amount <= 0) return toast('error', 'Enter an amount')
    await api.saveExpense(form)
    toast('success', 'Expense added')
    onSaved()
  }
  return (
    <Modal open onClose={onClose} title="Add Expense" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Amount"><input type="number" className="input" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} autoFocus /></Field>
        <div className="col-span-2"><Field label="Note"><input className="input" value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field></div>
      </div>
    </Modal>
  )
}
