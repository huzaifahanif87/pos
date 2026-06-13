import { Cloud, CloudOff, FolderSync, HardDrive, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { useApp } from '../store/app'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

export function SyncPill() {
  const { syncStatus, toast } = useApp()
  const [busy, setBusy] = useState(false)
  if (!syncStatus) return null

  const plan = syncStatus.plan
  const planMeta = {
    offline: { icon: HardDrive, label: 'Offline', tone: 'text-gray-700 bg-gray-100' },
    'local-folder': { icon: FolderSync, label: 'Local Backup', tone: 'text-cyan-600 bg-cyan-500/10' },
    cloud: syncStatus.online
      ? { icon: Cloud, label: 'Cloud Synced', tone: 'text-emerald-600 bg-emerald-500/10' }
      : { icon: CloudOff, label: 'Cloud (offline)', tone: 'text-amber-600 bg-amber-500/10' }
  }[plan]

  const Icon = planMeta.icon

  const runBackup = async () => {
    setBusy(true)
    const res = await api.runBackupNow()
    toast(res.ok ? 'success' : 'error', res.message)
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-3">
      {syncStatus.pendingChanges > 0 && (
        <span className="chip bg-amber-500/10 text-amber-600">{syncStatus.pendingChanges} unsynced</span>
      )}
      <div className={clsx('chip', planMeta.tone)}>
        <Icon size={14} />
        {planMeta.label}
      </div>
      <button
        className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        onClick={runBackup}
        disabled={busy}
        title={`Last backup ${timeAgo(syncStatus.lastBackupAt)}`}
      >
        <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
        Back up now
      </button>
    </div>
  )
}
