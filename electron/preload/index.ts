import { contextBridge, ipcRenderer } from 'electron'
import type { PosApi } from '@shared/ipc'
import { IPC } from '@shared/ipc'

// Every PosApi method simply forwards (method name + args) to the main process.
// We build a real object of functions (NOT a Proxy) because contextBridge mirrors
// own enumerable properties and cannot reflect a Proxy's trapped members.
const METHODS: (keyof PosApi)[] = [
  'getVersion', 'listUsers', 'login', 'saveUser', 'deleteUser',
  'getSettings', 'saveSettings', 'setBackupPlan', 'pickFolder', 'runBackupNow',
  'testCloudConnection', 'getSyncStatus', 'restoreFromBackup',
  'listCategories', 'saveCategory', 'deleteCategory',
  'listProducts', 'getProduct', 'findByBarcode', 'saveProduct', 'deleteProduct',
  'adjustStock', 'listStockMovements',
  'listCustomers', 'saveCustomer', 'deleteCustomer',
  'listVendors', 'saveVendor', 'deleteVendor', 'getLedger', 'recordPayment',
  'checkout', 'listSales', 'getSale', 'listHeldSales', 'refundSale', 'nextInvoiceNo',
  'listPurchases', 'savePurchase', 'deletePurchase',
  'listExpenses', 'saveExpense', 'deleteExpense',
  'getDashboard', 'getForecast', 'getProfitLoss', 'getBalanceSheet', 'getSalesSummary',
  'saveExport'
]

const api = {} as Record<string, unknown>
for (const method of METHODS) {
  api[method] = (...args: unknown[]) => ipcRenderer.invoke(IPC.invoke, method, args)
}

// Event subscription uses a renderer channel directly.
api.onSyncStatus = (cb: (s: unknown) => void) => {
  const listener = (_e: unknown, status: unknown) => cb(status)
  ipcRenderer.on('sync:status', listener)
  return () => ipcRenderer.removeListener('sync:status', listener)
}

contextBridge.exposeInMainWorld('api', api as unknown as PosApi)
