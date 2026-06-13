import { endOfDay, format, startOfDay, startOfMonth, subDays } from 'date-fns'
import type { Product, Sale } from '@shared/types'
import { getDb } from '../datastore'
import { round2 } from '../util'
import type {
  BalanceSheetReport,
  DashboardData,
  DateRange,
  ProfitLossReport,
  SalesSummaryRow,
  SeriesPoint
} from '@shared/ipc'
import { inventoryValue, lowStockProducts } from './products'
import { totalPayable, totalReceivable } from './parties'

async function completedSales(from: number, to: number): Promise<Sale[]> {
  return getDb().sales.find(
    { status: 'completed', date: { $gte: from, $lte: to } },
    { sort: { date: 1 } }
  )
}

export async function getDashboard(): Promise<DashboardData> {
  const db = getDb()
  const nowTs = Date.now()
  const todayStart = startOfDay(nowTs).getTime()
  const monthStart = startOfMonth(nowTs).getTime()

  const [todaySales, monthSales, products, customersCount] = await Promise.all([
    completedSales(todayStart, nowTs),
    completedSales(monthStart, nowTs),
    db.products.find({ active: true }),
    db.customers.count({})
  ])

  const productById = new Map(products.map((p) => [p._id, p]))
  const categories = await db.categories.find({})
  const catName = new Map(categories.map((c) => [c._id, c.name]))

  const sum = (arr: Sale[], key: keyof Sale) => round2(arr.reduce((a, s) => a + (Number(s[key]) || 0), 0))

  const todayTotal = sum(todaySales, 'total')
  const todayProfit = sum(todaySales, 'profit')

  // 14-day trend
  const salesTrend: SeriesPoint[] = []
  const last30 = await completedSales(subDays(todayStart, 29).getTime(), nowTs)
  for (let i = 13; i >= 0; i--) {
    const day = subDays(todayStart, i)
    const dStart = startOfDay(day).getTime()
    const dEnd = endOfDay(day).getTime()
    const daySales = last30.filter((s) => s.date >= dStart && s.date <= dEnd)
    salesTrend.push({
      label: format(day, 'MMM d'),
      value: round2(daySales.reduce((a, s) => a + s.total, 0)),
      secondary: round2(daySales.reduce((a, s) => a + s.profit, 0))
    })
  }

  // category + product breakdown over the month
  const catTotals = new Map<string, number>()
  const prodTotals = new Map<string, { name: string; qty: number; revenue: number }>()
  const payTotals = new Map<string, number>()
  const hourly = new Array(24).fill(0)

  for (const sale of monthSales) {
    payTotals.set(sale.paymentMethod, (payTotals.get(sale.paymentMethod) ?? 0) + sale.total)
    const hr = new Date(sale.date).getHours()
    hourly[hr] += sale.total
    for (const item of sale.items) {
      const revenue = item.lineTotal
      const prod = productById.get(item.productId)
      const cat = prod?.categoryId ? catName.get(prod.categoryId) ?? 'Uncategorized' : 'Uncategorized'
      catTotals.set(cat, (catTotals.get(cat) ?? 0) + revenue)
      const existing = prodTotals.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0 }
      existing.qty += item.qty
      existing.revenue += revenue
      prodTotals.set(item.productId, existing)
    }
  }

  const salesByCategory: SeriesPoint[] = [...catTotals.entries()]
    .map(([label, value]) => ({ label, value: round2(value) }))
    .sort((a, b) => b.value - a.value)

  const topProducts = [...prodTotals.values()]
    .map((p) => ({ ...p, revenue: round2(p.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  const paymentBreakdown: SeriesPoint[] = [...payTotals.entries()].map(([label, value]) => ({
    label,
    value: round2(value)
  }))

  const hourlyHeat: SeriesPoint[] = hourly.map((v, h) => ({
    label: `${String(h).padStart(2, '0')}:00`,
    value: round2(v)
  }))

  const [inv, receivable, payable, low] = await Promise.all([
    inventoryValue(),
    totalReceivable(),
    totalPayable(),
    lowStockProducts()
  ])

  const recentSales = await db.sales.find(
    { status: { $ne: 'held' } },
    { sort: { date: -1 }, limit: 8 }
  )

  return {
    kpis: {
      todaySales: todayTotal,
      todayProfit,
      todayTransactions: todaySales.length,
      todayAvgBasket: todaySales.length ? round2(todayTotal / todaySales.length) : 0,
      monthSales: sum(monthSales, 'total'),
      monthProfit: sum(monthSales, 'profit'),
      totalReceivable: receivable,
      totalPayable: payable,
      inventoryValue: inv,
      lowStockCount: low.length,
      outOfStockCount: products.filter((p) => p.trackStock && p.stock <= 0).length,
      totalProducts: products.length,
      totalCustomers: customersCount
    },
    salesTrend,
    salesByCategory,
    topProducts,
    paymentBreakdown,
    hourlyHeat,
    recentSales,
    lowStock: low.slice(0, 10)
  }
}

export async function getProfitLoss(range: DateRange): Promise<ProfitLossReport> {
  const sales = await completedSales(range.from, range.to)
  const expenses = await getDb().expenses.find({ date: { $gte: range.from, $lte: range.to } })

  const grossSales = round2(sales.reduce((a, s) => a + s.subtotal, 0))
  const discounts = round2(sales.reduce((a, s) => a + s.discount, 0))
  const taxCollected = round2(sales.reduce((a, s) => a + s.taxTotal, 0))
  const cogs = round2(sales.reduce((a, s) => a + s.costTotal, 0))
  const netSales = round2(grossSales - discounts)
  const grossProfit = round2(netSales - cogs)

  const byCat = new Map<string, number>()
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount)
  const expenseTotal = round2(expenses.reduce((a, e) => a + e.amount, 0))

  return {
    range,
    grossSales,
    discounts,
    taxCollected,
    netSales,
    cogs,
    grossProfit,
    expenses: expenseTotal,
    netProfit: round2(grossProfit - expenseTotal),
    expenseByCategory: [...byCat.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount)
  }
}

export async function getBalanceSheet(asOf: number): Promise<BalanceSheetReport> {
  const db = getDb()
  const sales = await db.sales.find({ status: 'completed', date: { $lte: asOf } })
  const purchases = await db.purchases.find({ date: { $lte: asOf } })
  const expenses = await db.expenses.find({ date: { $lte: asOf } })

  // Simplified cash position: cash collected on sales - cash paid on purchases - expenses.
  const cashIn = sales.reduce((a, s) => a + Math.min(s.paid, s.total), 0)
  const cashOutPurchases = purchases.reduce((a, p) => a + p.paid, 0)
  const cashOutExpenses = expenses.reduce((a, e) => a + e.amount, 0)
  const cash = round2(cashIn - cashOutPurchases - cashOutExpenses)

  const [inv, receivable, payable] = await Promise.all([
    inventoryValue(),
    totalReceivable(),
    totalPayable()
  ])

  const assetsTotal = round2(cash + inv + receivable)
  const liabilitiesTotal = round2(payable)

  return {
    asOf,
    assets: {
      cashAndEquivalents: cash,
      inventoryValue: inv,
      accountsReceivable: receivable,
      total: assetsTotal
    },
    liabilities: { accountsPayable: payable, total: liabilitiesTotal },
    equity: { ownersEquity: round2(assetsTotal - liabilitiesTotal) }
  }
}

export async function getSalesSummary(range: DateRange): Promise<SalesSummaryRow[]> {
  const sales = await completedSales(range.from, range.to)
  const byDay = new Map<string, SalesSummaryRow>()
  for (const s of sales) {
    const key = format(s.date, 'yyyy-MM-dd')
    const row = byDay.get(key) ?? {
      date: key,
      transactions: 0,
      gross: 0,
      discount: 0,
      tax: 0,
      net: 0,
      profit: 0
    }
    row.transactions += 1
    row.gross = round2(row.gross + s.subtotal)
    row.discount = round2(row.discount + s.discount)
    row.tax = round2(row.tax + s.taxTotal)
    row.net = round2(row.net + s.total)
    row.profit = round2(row.profit + s.profit)
    byDay.set(key, row)
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export { type Product }
