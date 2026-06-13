/* Headless smoke test of the Nexus POS data layer (no Electron/display needed). */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initDb } from '../electron/main/db/datastore'
import { seedIfEmpty } from '../electron/main/db/seed'
import { checkout, listSales, refundSale } from '../electron/main/db/repositories/sales'
import { listProducts, inventoryValue } from '../electron/main/db/repositories/products'
import { listCustomers, recordPayment, getLedger, totalReceivable } from '../electron/main/db/repositories/parties'
import { savePurchase } from '../electron/main/db/repositories/purchases'
import { saveExpense } from '../electron/main/db/repositories/expenses'
import { getDashboard, getProfitLoss, getBalanceSheet, getSalesSummary } from '../electron/main/db/repositories/reports'
import { getForecast } from '../electron/main/db/repositories/forecast'
import { login } from '../electron/main/db/repositories/users'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`)
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    failures++
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-pos-test-'))
  initDb(dir)
  console.log('\n[1] Seeding…')
  await seedIfEmpty()
  const products = await listProducts()
  assert(products.length >= 20, `seeded ${products.length} products`)
  const customers = await listCustomers()
  assert(customers.length >= 3, `seeded ${customers.length} customers`)

  console.log('\n[2] Auth…')
  const ok = await login('admin', '1234')
  assert(ok.ok && ok.user?.role === 'owner', 'admin logs in with PIN 1234')
  const bad = await login('admin', '0000')
  assert(!bad.ok, 'wrong PIN rejected')

  console.log('\n[3] Cash checkout + stock decrement…')
  const p = products[0]
  const beforeStock = p.stock
  const sale = await checkout({
    items: [{ productId: p._id, qty: 2, price: p.salePrice, discount: 0 }],
    discount: 0,
    paid: p.salePrice * 2,
    paymentMethod: 'cash'
  })
  assert(sale.invoiceNo.startsWith('INV-'), `invoice ${sale.invoiceNo} generated`)
  assert(Math.abs(sale.total - p.salePrice * 2) < 0.01, 'total computed correctly')
  assert(Math.abs(sale.profit - (p.salePrice - p.costPrice) * 2) < 0.01, 'profit computed correctly')
  const afterP = (await listProducts()).find((x) => x._id === p._id)!
  assert(afterP.stock === beforeStock - 2, `stock ${beforeStock} -> ${afterP.stock}`)

  console.log('\n[4] Credit sale -> receivable ledger…')
  const cust = customers.find((c) => c.name !== 'Walk-in Customer')!
  const beforeBal = cust.balance
  const credit = await checkout({
    items: [{ productId: products[1]._id, qty: 1, price: products[1].salePrice, discount: 0 }],
    discount: 0,
    paid: 0,
    paymentMethod: 'credit',
    customerId: cust._id
  })
  assert(credit.dueAmount > 0, `credit sale due ${credit.dueAmount.toFixed(2)}`)
  const ledger = await getLedger('customer', cust._id)
  assert(ledger.some((l) => l.type === 'invoice'), 'invoice posted to ledger')
  const custAfter = (await listCustomers()).find((c) => c._id === cust._id)!
  assert(Math.abs(custAfter.balance - (beforeBal + credit.dueAmount)) < 0.01, `balance ${beforeBal.toFixed(2)} -> ${custAfter.balance.toFixed(2)}`)

  console.log('\n[5] Receive payment reduces balance…')
  await recordPayment('customer', { partyId: cust._id, amount: credit.dueAmount, method: 'cash' })
  const custPaid = (await listCustomers()).find((c) => c._id === cust._id)!
  assert(Math.abs(custPaid.balance - beforeBal) < 0.01, `balance back to ${custPaid.balance.toFixed(2)}`)

  console.log('\n[6] Purchase increases stock + payable…')
  const invBefore = await inventoryValue()
  const pur = await savePurchase({
    items: [{ productId: products[2]._id, sku: products[2].sku, name: products[2].name, qty: 10, costPrice: products[2].costPrice, discount: 0, taxRate: 0, lineTotal: products[2].costPrice * 10 }],
    paid: 0,
    status: 'received'
  })
  assert(pur.dueAmount > 0, `purchase due ${pur.dueAmount.toFixed(2)}`)
  const prodAfterPur = (await listProducts()).find((x) => x._id === products[2]._id)!
  assert(prodAfterPur.stock === products[2].stock + 10, `stock +10 -> ${prodAfterPur.stock}`)
  const invAfter = await inventoryValue()
  assert(invAfter > invBefore, `inventory value ${invBefore.toFixed(2)} -> ${invAfter.toFixed(2)}`)

  console.log('\n[7] Refund restocks…')
  const refundStockBefore = (await listProducts()).find((x) => x._id === p._id)!.stock
  await refundSale(sale._id)
  const refundStockAfter = (await listProducts()).find((x) => x._id === p._id)!.stock
  assert(refundStockAfter === refundStockBefore + 2, `refund restocked ${refundStockBefore} -> ${refundStockAfter}`)
  const refunded = (await listSales()).find((s) => s._id === sale._id)
  assert(refunded?.status === 'refunded', 'sale marked refunded')

  console.log('\n[8] Expenses + reports…')
  await saveExpense({ category: 'Rent', amount: 500, date: Date.now() })
  const dash = await getDashboard()
  assert(dash.kpis.totalProducts > 0, `dashboard KPIs (today sales ${dash.kpis.todaySales.toFixed(2)})`)
  assert(dash.salesTrend.length === 14, 'sales trend has 14 days')
  assert(dash.salesByCategory.length > 0, 'category breakdown present')
  const pl = await getProfitLoss({ from: 0, to: Date.now() })
  assert(pl.netProfit !== undefined, `P&L net profit ${pl.netProfit.toFixed(2)}`)
  assert(Math.abs(pl.grossProfit - (pl.netSales - pl.cogs)) < 0.01, 'gross profit = net sales - COGS')
  const bs = await getBalanceSheet(Date.now())
  assert(Math.abs(bs.assets.total - (bs.assets.cashAndEquivalents + bs.assets.inventoryValue + bs.assets.accountsReceivable)) < 0.01, 'assets sum correct')
  assert(Math.abs(bs.equity.ownersEquity - (bs.assets.total - bs.liabilities.total)) < 0.01, 'equity = assets - liabilities')
  const summary = await getSalesSummary({ from: 0, to: Date.now() })
  assert(summary.length > 0, `daily summary ${summary.length} days`)

  console.log('\n[9] Forecast…')
  const fc = await getForecast(14)
  assert(fc.forecast.length === 14, `14-day forecast (next 7 = ${fc.projectedNext7.toFixed(2)})`)
  assert(fc.history.length === 60, 'uses 60 days history')
  assert(fc.projectedNext30 >= fc.projectedNext7, 'next30 >= next7')

  console.log('\n[10] Receivable total…')
  const recv = await totalReceivable()
  assert(recv >= 0, `total receivable ${recv.toFixed(2)}`)

  rmSync(dir, { recursive: true, force: true })
  console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('SMOKE TEST CRASHED:', e)
  process.exit(1)
})
