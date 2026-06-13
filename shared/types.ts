// Shared domain types used by both the Electron main process and the React renderer.
// The local store (NeDB) and the cloud store (MongoDB Atlas) use the SAME document
// shapes, so a record can be pushed/pulled between them without transformation.

export type ID = string

/** Fields every synced document carries, used by the offline<->cloud sync engine. */
export interface BaseDoc {
  _id: ID
  createdAt: number
  updatedAt: number
  /** Soft-delete tombstone so deletes propagate to the cloud. */
  deleted?: boolean
  /** Incremented on every local write; used for last-write-wins conflict resolution. */
  rev?: number
  /** Set once the doc has been confirmed in the cloud. */
  syncedAt?: number
}

export type UserRole = 'owner' | 'manager' | 'cashier'

export interface User extends BaseDoc {
  username: string
  name: string
  role: UserRole
  pinHash: string
  active: boolean
}

export interface Category extends BaseDoc {
  name: string
  description?: string
  color?: string
}

export interface Product extends BaseDoc {
  sku: string
  barcode?: string
  name: string
  categoryId?: ID
  unit: string // pcs, kg, ltr, box...
  costPrice: number
  salePrice: number
  taxRate: number // percent
  stock: number
  lowStockThreshold: number
  trackStock: boolean
  active: boolean
  color?: string
  description?: string
}

export interface Party extends BaseDoc {
  name: string
  phone?: string
  email?: string
  address?: string
  openingBalance: number
  /** Current outstanding balance. Customers: receivable (they owe us). Vendors: payable (we owe them). */
  balance: number
  creditLimit?: number
  notes?: string
}
export type Customer = Party
export type Vendor = Party

export interface SaleItem {
  productId: ID
  sku: string
  name: string
  qty: number
  price: number
  costPrice: number
  discount: number // absolute amount on the line
  taxRate: number
  lineTotal: number
}

export type SaleStatus = 'completed' | 'held' | 'refunded' | 'partial-refund'
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'credit' | 'mixed'

export interface Sale extends BaseDoc {
  invoiceNo: string
  date: number
  items: SaleItem[]
  subtotal: number
  discount: number
  taxTotal: number
  total: number
  paid: number
  change: number
  dueAmount: number
  costTotal: number
  profit: number
  paymentMethod: PaymentMethod
  customerId?: ID
  customerName?: string
  status: SaleStatus
  userId?: ID
  userName?: string
  note?: string
}

export interface PurchaseItem {
  productId: ID
  sku: string
  name: string
  qty: number
  costPrice: number
  discount: number
  taxRate: number
  lineTotal: number
}

export type PurchaseStatus = 'received' | 'ordered' | 'returned'

export interface Purchase extends BaseDoc {
  billNo: string
  date: number
  vendorId?: ID
  vendorName?: string
  items: PurchaseItem[]
  subtotal: number
  discount: number
  taxTotal: number
  total: number
  paid: number
  dueAmount: number
  status: PurchaseStatus
  note?: string
}

export type LedgerParty = 'customer' | 'vendor'
export type LedgerType =
  | 'opening'
  | 'invoice'
  | 'purchase'
  | 'payment-in'
  | 'payment-out'
  | 'refund'
  | 'adjustment'

export interface LedgerEntry extends BaseDoc {
  party: LedgerParty
  partyId: ID
  partyName: string
  type: LedgerType
  refId?: ID
  refNo?: string
  /** Amount that increases what the party owes us / we owe them. */
  debit: number
  /** Amount that decreases the balance (e.g. a payment). */
  credit: number
  balanceAfter: number
  method?: PaymentMethod
  note?: string
  date: number
}

export type StockMovementType = 'sale' | 'purchase' | 'adjustment' | 'sale-return' | 'purchase-return' | 'opening'

export interface StockMovement extends BaseDoc {
  productId: ID
  productName: string
  type: StockMovementType
  qty: number // signed: + adds stock, - removes
  balanceAfter: number
  refId?: ID
  refNo?: string
  note?: string
  date: number
}

export interface Expense extends BaseDoc {
  category: string
  amount: number
  note?: string
  date: number
  userId?: ID
}

export type BackupPlan = 'offline' | 'local-folder' | 'cloud'

export interface ShopProfile {
  name: string
  legalName?: string
  phone?: string
  email?: string
  address?: string
  taxNumber?: string
  currency: string
  currencySymbol: string
  footerNote?: string
  logoColor?: string
}

export interface BackupSettings {
  plan: BackupPlan
  /** Local folder to mirror encrypted backups into (local-folder plan). */
  localFolder?: string
  /** MongoDB Atlas connection string (cloud plan). */
  cloudUri?: string
  cloudDbName?: string
  autoBackup: boolean
  intervalMinutes: number
  lastBackupAt?: number
  lastSyncAt?: number
}

export interface AppSettings {
  _id: 'app-settings'
  shop: ShopProfile
  backup: BackupSettings
  invoicePrefix: string
  nextInvoiceSeq: number
  purchasePrefix: string
  nextPurchaseSeq: number
  defaultTaxRate: number
  lowStockAlerts: boolean
  theme: 'light' | 'dark' | 'system'
  receiptWidthMM: number
  updatedAt: number
}

export interface SyncStatus {
  online: boolean
  plan: BackupPlan
  lastBackupAt?: number
  lastSyncAt?: number
  pendingChanges: number
  inProgress: boolean
  lastError?: string
}
