import { useEffect, useState } from 'react'
import {
  Store,
  HardDrive,
  FolderSync,
  Cloud,
  Check,
  FolderOpen,
  Plug,
  Users,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  ShieldCheck
} from 'lucide-react'
import clsx from 'clsx'
import type { AppSettings, BackupPlan, User } from '@shared/types'
import { api } from '../lib/api'
import { useApp } from '../store/app'
import { timeAgo } from '../lib/format'
import { Card, Field, Badge, Modal, Spinner } from '../components/ui'

const PLANS: { id: BackupPlan; title: string; desc: string; icon: typeof HardDrive }[] = [
  { id: 'offline', title: 'Offline Only', desc: 'Everything stays on this computer. Automatic rolling local snapshots keep you safe — zero setup, no internet needed.', icon: HardDrive },
  { id: 'local-folder', title: 'Local / Network Backup', desc: 'Mirror encrypted snapshots to a USB drive, network share, or any folder you choose. Great for a second physical copy.', icon: FolderSync },
  { id: 'cloud', title: 'Cloud Backup (MongoDB Atlas)', desc: 'Sync to your MongoDB Atlas cluster so data is safe off-site and available across locations. Works offline and syncs when online.', icon: Cloud }
]

export default function Settings() {
  const { settings, setSettings, toast } = useApp()
  const [form, setForm] = useState<AppSettings | null>(settings)
  const [usersOpen, setUsersOpen] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => setForm(settings), [settings])
  if (!form) return <Spinner />

  const setShop = (k: string, v: string) => setForm({ ...form, shop: { ...form.shop, [k]: v } })
  const setBackup = (patch: Partial<AppSettings['backup']>) => setForm({ ...form, backup: { ...form.backup, ...patch } })

  const saveAll = async () => {
    const saved = await api.saveSettings(form)
    setSettings(saved)
    toast('success', 'Settings saved')
  }

  const choosePlan = async (plan: BackupPlan) => {
    setBackup({ plan })
    const saved = await api.setBackupPlan(plan, {
      localFolder: form.backup.localFolder,
      cloudUri: form.backup.cloudUri,
      cloudDbName: form.backup.cloudDbName
    })
    setSettings(saved)
    toast('success', `Backup plan: ${plan}`)
  }

  const pickFolder = async () => {
    const folder = await api.pickFolder()
    if (folder) {
      setBackup({ localFolder: folder })
      const saved = await api.setBackupPlan('local-folder', { localFolder: folder })
      setSettings(saved)
      toast('success', 'Backup folder set')
    }
  }

  const testCloud = async () => {
    if (!form.backup.cloudUri) return toast('error', 'Enter a connection string')
    setTesting(true)
    const res = await api.testCloudConnection(form.backup.cloudUri, form.backup.cloudDbName ?? 'nexus_pos')
    toast(res.ok ? 'success' : 'error', res.message)
    setTesting(false)
  }

  const restore = async () => {
    if (!confirm('Restore the latest local backup? Current data will be replaced after restart.')) return
    const res = await api.restoreFromBackup()
    toast(res.ok ? 'success' : 'error', res.message)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Shop profile */}
      <Card>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900"><Store size={16} /> Shop Profile</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Shop Name"><input className="input" value={form.shop.name} onChange={(e) => setShop('name', e.target.value)} /></Field>
          <Field label="Legal / Business Name"><input className="input" value={form.shop.legalName ?? ''} onChange={(e) => setShop('legalName', e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={form.shop.phone ?? ''} onChange={(e) => setShop('phone', e.target.value)} /></Field>
          <Field label="Email"><input className="input" value={form.shop.email ?? ''} onChange={(e) => setShop('email', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Address"><input className="input" value={form.shop.address ?? ''} onChange={(e) => setShop('address', e.target.value)} /></Field></div>
          <Field label="Tax / Registration No."><input className="input" value={form.shop.taxNumber ?? ''} onChange={(e) => setShop('taxNumber', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency Code"><input className="input" value={form.shop.currency} onChange={(e) => setShop('currency', e.target.value)} /></Field>
            <Field label="Symbol"><input className="input" value={form.shop.currencySymbol} onChange={(e) => setShop('currencySymbol', e.target.value)} /></Field>
          </div>
          <div className="col-span-2"><Field label="Receipt Footer Note"><input className="input" value={form.shop.footerNote ?? ''} onChange={(e) => setShop('footerNote', e.target.value)} /></Field></div>
        </div>
      </Card>

      {/* Backup plan */}
      <Card>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900"><ShieldCheck size={16} /> Backup &amp; Sync Plan</h3>
        <p className="mb-4 text-xs text-gray-400">Choose how this shop's data is protected. You can switch anytime. Last backup: {timeAgo(form.backup.lastBackupAt)}.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PLANS.map((p) => {
            const active = form.backup.plan === p.id
            return (
              <button key={p.id} onClick={() => choosePlan(p.id)} className={clsx('relative rounded-2xl border p-4 text-left transition', active ? 'border-gray-900 bg-gray-100' : 'border-gray-200 bg-gray-100 hover:border-gray-300')}>
                {active && <Check size={16} className="absolute right-3 top-3 text-gray-900" />}
                <p.icon size={22} className={active ? 'text-gray-900' : 'text-gray-500'} />
                <p className="mt-2 text-sm font-semibold text-gray-900">{p.title}</p>
                <p className="mt-1 text-xs text-gray-500">{p.desc}</p>
              </button>
            )
          })}
        </div>

        {form.backup.plan === 'local-folder' && (
          <div className="mt-4 rounded-xl bg-gray-100 p-4">
            <Field label="Backup Folder">
              <div className="flex gap-2">
                <input className="input" readOnly value={form.backup.localFolder ?? ''} placeholder="No folder selected" />
                <button className="btn-ghost shrink-0" onClick={pickFolder}><FolderOpen size={16} /> Browse</button>
              </div>
            </Field>
          </div>
        )}

        {form.backup.plan === 'cloud' && (
          <div className="mt-4 space-y-3 rounded-xl bg-gray-100 p-4">
            <Field label="MongoDB Atlas Connection String" hint="mongodb+srv://user:pass@cluster.mongodb.net">
              <input className="input font-mono text-xs" value={form.backup.cloudUri ?? ''} onChange={(e) => setBackup({ cloudUri: e.target.value })} placeholder="mongodb+srv://…" />
            </Field>
            <div className="flex items-end gap-2">
              <div className="flex-1"><Field label="Database Name"><input className="input" value={form.backup.cloudDbName ?? 'nexus_pos'} onChange={(e) => setBackup({ cloudDbName: e.target.value })} /></Field></div>
              <button className="btn-ghost" onClick={testCloud} disabled={testing}><Plug size={16} /> {testing ? 'Testing…' : 'Test Connection'}</button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.backup.autoBackup} onChange={(e) => setBackup({ autoBackup: e.target.checked })} /> Automatic backup
          </label>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            Every
            <input type="number" className="w-20 rounded-lg bg-gray-100 px-2 py-1 text-center" value={form.backup.intervalMinutes} onChange={(e) => setBackup({ intervalMinutes: Number(e.target.value) })} />
            minutes
          </div>
          <button className="btn-ghost ml-auto" onClick={restore}><RotateCcw size={16} /> Restore latest backup</button>
        </div>
      </Card>

      {/* Invoicing & misc */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Invoicing &amp; Receipts</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Invoice Prefix"><input className="input" value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} /></Field>
          <Field label="Next Invoice #"><input type="number" className="input" value={form.nextInvoiceSeq} onChange={(e) => setForm({ ...form, nextInvoiceSeq: Number(e.target.value) })} /></Field>
          <Field label="Default Tax %"><input type="number" className="input" value={form.defaultTaxRate} onChange={(e) => setForm({ ...form, defaultTaxRate: Number(e.target.value) })} /></Field>
          <Field label="Receipt Width (mm)">
            <select className="input" value={form.receiptWidthMM} onChange={(e) => setForm({ ...form, receiptWidthMM: Number(e.target.value) })}>
              <option value={58}>58mm</option>
              <option value={80}>80mm</option>
            </select>
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <button className="btn-ghost" onClick={() => setUsersOpen(true)}><Users size={16} /> Manage Users &amp; Roles</button>
        <button className="btn-primary" onClick={saveAll}><Save size={16} /> Save Settings</button>
      </div>

      {usersOpen && <UserManager onClose={() => setUsersOpen(false)} />}
    </div>
  )
}

function UserManager({ onClose }: { onClose: () => void }) {
  const { toast } = useApp()
  const [users, setUsers] = useState<User[]>([])
  const [editing, setEditing] = useState<(Partial<User> & { pin?: string }) | null>(null)

  const load = async () => setUsers(await api.listUsers())
  useEffect(() => {
    void load()
  }, [])

  const save = async () => {
    if (!editing?.name || !editing.username) return toast('error', 'Name and username required')
    if (!editing._id && !editing.pin) return toast('error', 'Set a PIN')
    await api.saveUser(editing)
    setEditing(null)
    await load()
    toast('success', 'User saved')
  }
  const del = async (u: User) => {
    if (!confirm(`Delete ${u.name}?`)) return
    try {
      await api.deleteUser(u._id)
      await load()
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Users & Roles" footer={<button className="btn-primary" onClick={() => setEditing({ role: 'cashier', active: true })}><Plus size={16} /> Add User</button>}>
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name"><input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Username"><input className="input" value={editing.username ?? ''} onChange={(e) => setEditing({ ...editing, username: e.target.value })} /></Field>
            <Field label="Role">
              <select className="input" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as User['role'] })}>
                <option value="owner">Owner (full access)</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
              </select>
            </Field>
            <Field label={editing._id ? 'New PIN (blank = keep)' : 'PIN'}><input type="password" className="input" value={editing.pin ?? ''} onChange={(e) => setEditing({ ...editing, pin: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Save User</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u._id} className="flex items-center justify-between rounded-xl bg-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{u.name}</p>
                <p className="text-xs text-gray-400">@{u.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={u.role === 'owner' ? 'violet' : u.role === 'manager' ? 'blue' : 'slate'}>{u.role}</Badge>
                <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900" onClick={() => setEditing(u)}>Edit</button>
                <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-rose-600" onClick={() => del(u)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
