import { app, dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import type { PosApi } from '@shared/ipc'
import * as products from '../db/repositories/products'
import * as parties from '../db/repositories/parties'
import * as sales from '../db/repositories/sales'
import * as purchases from '../db/repositories/purchases'
import * as expenses from '../db/repositories/expenses'
import * as users from '../db/repositories/users'
import * as reports from '../db/repositories/reports'
import { getForecast } from '../db/repositories/forecast'
import * as settingsRepo from '../db/settings'
import { backup } from '../services/backup'
import { testConnection } from '../services/cloudSync'

type Handlers = {
  [K in keyof PosApi]: PosApi[K] extends (...a: infer A) => infer R ? (...a: A) => R : never
}

export const router: Handlers = {
  // meta / auth
  getVersion: async () => app.getVersion(),
  listUsers: () => users.listUsers(),
  login: (u, p) => users.login(u, p),
  saveUser: (u) => users.saveUser(u),
  deleteUser: (id) => users.deleteUser(id),

  // settings / backup
  getSettings: () => settingsRepo.getSettings(),
  saveSettings: (patch) => settingsRepo.saveSettings(patch),
  setBackupPlan: async (plan, opts) => {
    const s = await settingsRepo.setBackupPlan(plan, opts)
    await backup.reschedule()
    return s
  },
  pickFolder: async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const res = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
    return res.canceled ? undefined : res.filePaths[0]
  },
  runBackupNow: () => backup.runBackupNow(),
  testCloudConnection: (uri, dbName) => testConnection(uri, dbName),
  getSyncStatus: async () => {
    await backup.refreshPending()
    return backup.getStatus()
  },
  restoreFromBackup: () => backup.restoreLatest(),

  // categories
  listCategories: () => products.listCategories(),
  saveCategory: (c) => products.saveCategory(c),
  deleteCategory: (id) => products.deleteCategory(id),

  // products / inventory
  listProducts: (q) => products.listProducts(q),
  getProduct: (id) => products.getProduct(id),
  findByBarcode: (code) => products.findByBarcode(code),
  saveProduct: (p) => products.saveProduct(p),
  deleteProduct: (id) => products.deleteProduct(id),
  adjustStock: (id, qty, note) => products.adjustStock(id, qty, note),
  listStockMovements: (id, limit) => products.listStockMovements(id, limit),

  // parties
  listCustomers: (q) => parties.listCustomers(q),
  saveCustomer: (c) => parties.saveCustomer(c),
  deleteCustomer: (id) => parties.deleteCustomer(id),
  listVendors: (q) => parties.listVendors(q),
  saveVendor: (v) => parties.saveVendor(v),
  deleteVendor: (id) => parties.deleteVendor(id),
  getLedger: (party, id) => parties.getLedger(party, id),
  recordPayment: (party, p) => parties.recordPayment(party, p),

  // sales
  checkout: (cart) => sales.checkout(cart),
  listSales: (q) => sales.listSales(q),
  getSale: (id) => sales.getSale(id),
  listHeldSales: () => sales.listHeldSales(),
  refundSale: (id) => sales.refundSale(id),
  nextInvoiceNo: async () => {
    const s = await settingsRepo.getSettings()
    return `${s.invoicePrefix}${String(s.nextInvoiceSeq).padStart(5, '0')}`
  },

  // purchases
  listPurchases: (q) => purchases.listPurchases(q),
  savePurchase: (p) => purchases.savePurchase(p),
  deletePurchase: (id) => purchases.deletePurchase(id),

  // expenses
  listExpenses: (q) => expenses.listExpenses(q),
  saveExpense: (e) => expenses.saveExpense(e),
  deleteExpense: (id) => expenses.deleteExpense(id),

  // dashboard / reports
  getDashboard: () => reports.getDashboard(),
  getForecast: (days) => getForecast(days),
  getProfitLoss: (range) => reports.getProfitLoss(range),
  getBalanceSheet: (asOf) => reports.getBalanceSheet(asOf),
  getSalesSummary: (range) => reports.getSalesSummary(range),

  // export / file
  saveExport: async (req) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const res = await dialog.showSaveDialog(win, {
      defaultPath: req.defaultName,
      filters: [{ name: req.extension.toUpperCase(), extensions: [req.extension] }]
    })
    if (res.canceled || !res.filePath) return { saved: false }
    const buf = Buffer.from(
      req.data instanceof ArrayBuffer ? new Uint8Array(req.data) : (req.data as Uint8Array | number[])
    )
    writeFileSync(res.filePath, buf)
    return { saved: true, path: res.filePath }
  },

  // events handled separately in preload (no-op here)
  onSyncStatus: () => () => undefined
}

export type Router = typeof router
