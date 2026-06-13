// Typed contract for the bridge between the renderer and the main process.
// `window.api` (exposed in the preload script) implements `PosApi`.

import type {
  AppSettings,
  Category,
  Customer,
  Expense,
  LedgerEntry,
  Product,
  Purchase,
  Sale,
  StockMovement,
  SyncStatus,
  User,
  Vendor,
  BackupPlan
} from './types'

export interface ListQuery {
  search?: string
  limit?: number
  skip?: number
  sort?: Record<string, 1 | -1>
  filter?: Record<string, unknown>
}

export interface DateRange {
  from: number
  to: number
}

export interface DashboardKpis {
  todaySales: number
  todayProfit: number
  todayTransactions: number
  todayAvgBasket: number
  monthSales: number
  monthProfit: number
  totalReceivable: number
  totalPayable: number
  inventoryValue: number
  lowStockCount: number
  outOfStockCount: number
  totalProducts: number
  totalCustomers: number
}

export interface SeriesPoint {
  label: string
  value: number
  secondary?: number
}

export interface DashboardData {
  kpis: DashboardKpis
  salesTrend: SeriesPoint[] // last 14 days
  salesByCategory: SeriesPoint[]
  topProducts: { name: string; qty: number; revenue: number }[]
  paymentBreakdown: SeriesPoint[]
  hourlyHeat: SeriesPoint[]
  recentSales: Sale[]
  lowStock: Product[]
}

export interface ForecastResult {
  history: SeriesPoint[]
  forecast: SeriesPoint[]
  method: string
  growthRatePct: number
  projectedNext7: number
  projectedNext30: number
}

export interface ProfitLossReport {
  range: DateRange
  grossSales: number
  discounts: number
  taxCollected: number
  netSales: number
  cogs: number
  grossProfit: number
  expenses: number
  netProfit: number
  expenseByCategory: { category: string; amount: number }[]
}

export interface BalanceSheetReport {
  asOf: number
  assets: {
    cashAndEquivalents: number
    inventoryValue: number
    accountsReceivable: number
    total: number
  }
  liabilities: {
    accountsPayable: number
    total: number
  }
  equity: {
    ownersEquity: number
  }
}

export interface SalesSummaryRow {
  date: string
  transactions: number
  gross: number
  discount: number
  tax: number
  net: number
  profit: number
}

export interface SaveExportRequest {
  defaultName: string
  /** raw file bytes generated in the renderer */
  data: Uint8Array | ArrayBuffer | number[]
  extension: string // 'pdf' | 'xlsx' | 'csv'
}

export interface SaveExportResult {
  saved: boolean
  path?: string
}

export interface CartCheckout {
  items: {
    productId: string
    qty: number
    price: number
    discount: number
  }[]
  discount: number
  paid: number
  paymentMethod: string
  customerId?: string
  note?: string
  hold?: boolean
}

export interface PartyPayment {
  partyId: string
  amount: number
  method: string
  note?: string
}

export interface PosApi {
  // --- meta / auth ---
  getVersion(): Promise<string>
  listUsers(): Promise<User[]>
  login(username: string, pin: string): Promise<{ ok: boolean; user?: User; error?: string }>
  saveUser(user: Partial<User> & { pin?: string }): Promise<User>
  deleteUser(id: string): Promise<void>

  // --- settings / backup ---
  getSettings(): Promise<AppSettings>
  saveSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  setBackupPlan(plan: BackupPlan, opts?: { localFolder?: string; cloudUri?: string; cloudDbName?: string }): Promise<AppSettings>
  pickFolder(): Promise<string | undefined>
  runBackupNow(): Promise<{ ok: boolean; message: string }>
  testCloudConnection(uri: string, dbName: string): Promise<{ ok: boolean; message: string }>
  getSyncStatus(): Promise<SyncStatus>
  restoreFromBackup(): Promise<{ ok: boolean; message: string }>

  // --- categories ---
  listCategories(): Promise<Category[]>
  saveCategory(c: Partial<Category>): Promise<Category>
  deleteCategory(id: string): Promise<void>

  // --- products / inventory ---
  listProducts(q?: ListQuery): Promise<Product[]>
  getProduct(id: string): Promise<Product | null>
  findByBarcode(code: string): Promise<Product | null>
  saveProduct(p: Partial<Product>): Promise<Product>
  deleteProduct(id: string): Promise<void>
  adjustStock(productId: string, qty: number, note?: string): Promise<Product>
  listStockMovements(productId?: string, limit?: number): Promise<StockMovement[]>

  // --- customers / vendors ---
  listCustomers(q?: ListQuery): Promise<Customer[]>
  saveCustomer(c: Partial<Customer>): Promise<Customer>
  deleteCustomer(id: string): Promise<void>
  listVendors(q?: ListQuery): Promise<Vendor[]>
  saveVendor(v: Partial<Vendor>): Promise<Vendor>
  deleteVendor(id: string): Promise<void>
  getLedger(party: 'customer' | 'vendor', partyId: string): Promise<LedgerEntry[]>
  recordPayment(party: 'customer' | 'vendor', p: PartyPayment): Promise<void>

  // --- sales ---
  checkout(cart: CartCheckout): Promise<Sale>
  listSales(q?: ListQuery & DateRange): Promise<Sale[]>
  getSale(id: string): Promise<Sale | null>
  listHeldSales(): Promise<Sale[]>
  refundSale(id: string): Promise<Sale>
  nextInvoiceNo(): Promise<string>

  // --- purchases ---
  listPurchases(q?: ListQuery): Promise<Purchase[]>
  savePurchase(p: Partial<Purchase> & { items: Purchase['items'] }): Promise<Purchase>
  deletePurchase(id: string): Promise<void>

  // --- expenses ---
  listExpenses(q?: ListQuery & Partial<DateRange>): Promise<Expense[]>
  saveExpense(e: Partial<Expense>): Promise<Expense>
  deleteExpense(id: string): Promise<void>

  // --- dashboard / reports ---
  getDashboard(): Promise<DashboardData>
  getForecast(days: number): Promise<ForecastResult>
  getProfitLoss(range: DateRange): Promise<ProfitLossReport>
  getBalanceSheet(asOf: number): Promise<BalanceSheetReport>
  getSalesSummary(range: DateRange): Promise<SalesSummaryRow[]>

  // --- export / file ---
  saveExport(req: SaveExportRequest): Promise<SaveExportResult>

  // --- events ---
  onSyncStatus(cb: (s: SyncStatus) => void): () => void
}

export const IPC = {
  invoke: 'pos:invoke'
} as const

declare global {
  interface Window {
    api: PosApi
  }
}
