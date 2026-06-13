import type { AppSettings, BackupPlan } from '@shared/types'
import { getDb } from './datastore'
import { now } from './util'

export function defaultSettings(): AppSettings {
  return {
    _id: 'app-settings',
    shop: {
      name: 'My Shop',
      legalName: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      currency: 'USD',
      currencySymbol: '$',
      footerNote: 'Thank you for shopping with us!',
      logoColor: '#316dff'
    },
    backup: {
      plan: 'offline',
      autoBackup: true,
      intervalMinutes: 30
    },
    invoicePrefix: 'INV-',
    nextInvoiceSeq: 1,
    purchasePrefix: 'PUR-',
    nextPurchaseSeq: 1,
    defaultTaxRate: 0,
    lowStockAlerts: true,
    theme: 'dark',
    receiptWidthMM: 80,
    updatedAt: now()
  }
}

export async function getSettings(): Promise<AppSettings> {
  const db = getDb()
  const found = (await db.settings.findOneAsync({ _id: 'app-settings' })) as AppSettings | null
  if (found) return found
  const def = defaultSettings()
  await db.settings.insertAsync(def as never)
  return def
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = getDb()
  const current = await getSettings()
  const next: AppSettings = {
    ...current,
    ...patch,
    shop: { ...current.shop, ...(patch.shop ?? {}) },
    backup: { ...current.backup, ...(patch.backup ?? {}) },
    _id: 'app-settings',
    updatedAt: now()
  }
  await db.settings.updateAsync({ _id: 'app-settings' }, next, { upsert: true })
  return next
}

export async function setBackupPlan(
  plan: BackupPlan,
  opts: { localFolder?: string; cloudUri?: string; cloudDbName?: string } = {}
): Promise<AppSettings> {
  const current = await getSettings()
  return saveSettings({
    backup: {
      ...current.backup,
      plan,
      localFolder: opts.localFolder ?? current.backup.localFolder,
      cloudUri: opts.cloudUri ?? current.backup.cloudUri,
      cloudDbName: opts.cloudDbName ?? current.backup.cloudDbName ?? 'nexus_pos'
    }
  })
}

/** Atomically allocate the next invoice number. */
export async function nextInvoiceNo(): Promise<string> {
  const s = await getSettings()
  const seq = s.nextInvoiceSeq
  await saveSettings({ nextInvoiceSeq: seq + 1 })
  return `${s.invoicePrefix}${String(seq).padStart(5, '0')}`
}

export async function nextPurchaseNo(): Promise<string> {
  const s = await getSettings()
  const seq = s.nextPurchaseSeq
  await saveSettings({ nextPurchaseSeq: seq + 1 })
  return `${s.purchasePrefix}${String(seq).padStart(5, '0')}`
}
