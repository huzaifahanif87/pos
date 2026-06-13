import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import type { SyncStatus } from '@shared/types'
import { getDb, syncedCollections } from '../db/datastore'
import { getSettings } from '../db/settings'
import { syncWithCloud } from './cloudSync'

const COLLECTION_FILES = [
  'users',
  'categories',
  'products',
  'customers',
  'vendors',
  'sales',
  'purchases',
  'ledger',
  'stock',
  'expenses',
  'settings'
]

class BackupService extends EventEmitter {
  private status: SyncStatus = {
    online: false,
    plan: 'offline',
    pendingChanges: 0,
    inProgress: false
  }
  private timer: NodeJS.Timeout | null = null

  getStatus(): SyncStatus {
    return { ...this.status }
  }

  private patch(p: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...p }
    this.emit('status', this.getStatus())
  }

  async refreshPending(): Promise<void> {
    const db = getDb()
    let pending = 0
    for (const { col } of syncedCollections(db)) {
      const docs = await col.findRaw({})
      pending += docs.filter((d) => !d.syncedAt || (d.updatedAt ?? 0) > d.syncedAt).length
    }
    const settings = await getSettings()
    this.patch({
      pendingChanges: pending,
      plan: settings.backup.plan,
      lastBackupAt: settings.backup.lastBackupAt,
      lastSyncAt: settings.backup.lastSyncAt
    })
  }

  /** Write a timestamped JSON snapshot of every collection to `targetDir`. */
  private writeSnapshot(targetDir: string): string {
    mkdirSync(targetDir, { recursive: true })
    const db = getDb()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const snapDir = join(targetDir, `backup-${stamp}`)
    mkdirSync(snapDir, { recursive: true })
    for (const name of COLLECTION_FILES) {
      const src = join(db.dataDir, `${name}.db`)
      if (existsSync(src)) copyFileSync(src, join(snapDir, `${name}.db`))
    }
    writeFileSync(
      join(snapDir, 'manifest.json'),
      JSON.stringify({ app: 'nexus-pos', version: 1, createdAt: Date.now(), collections: COLLECTION_FILES }, null, 2)
    )
    return snapDir
  }

  /** Keep only the most recent `keep` snapshots in a directory. */
  private prune(dir: string, keep = 10): void {
    if (!existsSync(dir)) return
    const snaps = readdirSync(dir)
      .filter((n) => n.startsWith('backup-'))
      .map((n) => ({ n, t: statSync(join(dir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const old of snaps.slice(keep)) rmSync(join(dir, old.n), { recursive: true, force: true })
  }

  async runBackupNow(): Promise<{ ok: boolean; message: string }> {
    if (this.status.inProgress) return { ok: false, message: 'A backup is already running' }
    this.patch({ inProgress: true, lastError: undefined })
    try {
      const settings = await getSettings()
      const db = getDb()
      const messages: string[] = []

      // Always keep a rolling local snapshot (the safety net for every plan).
      const localBackups = join(db.dataDir, '..', 'backups')
      this.writeSnapshot(localBackups)
      this.prune(localBackups, 14)
      messages.push('Local snapshot saved')

      // Mirror to a user folder (USB / network drive) when chosen.
      if (settings.backup.plan === 'local-folder' && settings.backup.localFolder) {
        const dir = join(settings.backup.localFolder, 'NexusPOS-Backups')
        this.writeSnapshot(dir)
        this.prune(dir, 30)
        messages.push(`Mirrored to ${settings.backup.localFolder}`)
      }

      // Push to MongoDB Atlas when on the cloud plan.
      if (settings.backup.plan === 'cloud' && settings.backup.cloudUri) {
        const res = await syncWithCloud(settings.backup.cloudUri, settings.backup.cloudDbName ?? 'nexus_pos')
        messages.push(res.message)
        if (res.ok) {
          await this.saveBackupTimes({ lastSyncAt: Date.now() })
          this.patch({ online: true })
        } else {
          this.patch({ online: false, lastError: res.message })
        }
      }

      await this.saveBackupTimes({ lastBackupAt: Date.now() })
      await this.refreshPending()
      return { ok: true, message: messages.join(' · ') }
    } catch (err) {
      const message = (err as Error).message
      this.patch({ lastError: message })
      return { ok: false, message }
    } finally {
      this.patch({ inProgress: false })
    }
  }

  private async saveBackupTimes(times: { lastBackupAt?: number; lastSyncAt?: number }): Promise<void> {
    const settings = await getSettings()
    const { saveSettings } = await import('../db/settings')
    await saveSettings({ backup: { ...settings.backup, ...times } })
  }

  async restoreLatest(): Promise<{ ok: boolean; message: string }> {
    const db = getDb()
    const backupsDir = join(db.dataDir, '..', 'backups')
    if (!existsSync(backupsDir)) return { ok: false, message: 'No local backups found' }
    const snaps = readdirSync(backupsDir)
      .filter((n) => n.startsWith('backup-'))
      .map((n) => ({ n, t: statSync(join(backupsDir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    if (!snaps.length) return { ok: false, message: 'No local backups found' }
    const latest = join(backupsDir, snaps[0].n)
    for (const name of COLLECTION_FILES) {
      const src = join(latest, `${name}.db`)
      if (existsSync(src)) copyFileSync(src, join(db.dataDir, `${name}.db`))
    }
    return { ok: true, message: `Restored from ${snaps[0].n}. Please restart the app.` }
  }

  startAuto(): void {
    void this.scheduleNext()
  }

  private async scheduleNext(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    const settings = await getSettings()
    this.patch({ plan: settings.backup.plan })
    await this.refreshPending()
    if (!settings.backup.autoBackup || settings.backup.plan === 'offline') return
    const ms = Math.max(5, settings.backup.intervalMinutes) * 60_000
    this.timer = setInterval(() => void this.runBackupNow(), ms)
  }

  async reschedule(): Promise<void> {
    await this.scheduleNext()
  }

  importSnapshotFile(filePath: string): { ok: boolean; message: string } {
    try {
      const manifest = JSON.parse(readFileSync(filePath, 'utf-8'))
      return { ok: true, message: `Valid backup from ${new Date(manifest.createdAt).toLocaleString()}` }
    } catch {
      return { ok: false, message: 'Not a valid Nexus POS backup manifest' }
    }
  }
}

export const backup = new BackupService()
