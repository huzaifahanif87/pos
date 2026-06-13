import type { Sale, SaleItem, PaymentMethod } from '@shared/types'
import { getDb } from '../datastore'
import { now, round2 } from '../util'
import type { CartCheckout, ListQuery, DateRange } from '@shared/ipc'
import { nextInvoiceNo } from '../settings'
import { applyStockDelta } from './products'
import { postLedger } from './parties'

export async function checkout(cart: CartCheckout): Promise<Sale> {
  const db = getDb()
  const items: SaleItem[] = []
  let subtotal = 0
  let itemDiscount = 0
  let taxTotal = 0
  let costTotal = 0

  for (const line of cart.items) {
    const product = await db.products.findOne({ _id: line.productId })
    if (!product) throw new Error(`Product ${line.productId} not found`)
    const gross = round2(line.price * line.qty)
    const lineDiscount = round2(line.discount || 0)
    const taxable = round2(gross - lineDiscount)
    const lineTax = round2((taxable * product.taxRate) / 100)
    const lineTotal = round2(taxable + lineTax)
    subtotal = round2(subtotal + gross)
    itemDiscount = round2(itemDiscount + lineDiscount)
    taxTotal = round2(taxTotal + lineTax)
    costTotal = round2(costTotal + product.costPrice * line.qty)
    items.push({
      productId: product._id,
      sku: product.sku,
      name: product.name,
      qty: line.qty,
      price: line.price,
      costPrice: product.costPrice,
      discount: lineDiscount,
      taxRate: product.taxRate,
      lineTotal
    })
  }

  const orderDiscount = round2(cart.discount || 0)
  const discountTotal = round2(itemDiscount + orderDiscount)
  const total = round2(subtotal - discountTotal + taxTotal)
  const netSales = round2(subtotal - discountTotal)
  const profit = round2(netSales - costTotal)

  // Holds are parked carts: no stock or ledger effect.
  if (cart.hold) {
    return db.sales.insert({
      invoiceNo: 'HOLD',
      date: now(),
      items,
      subtotal,
      discount: discountTotal,
      taxTotal,
      total,
      paid: 0,
      change: 0,
      dueAmount: total,
      costTotal,
      profit,
      paymentMethod: 'cash',
      customerId: cart.customerId,
      status: 'held',
      note: cart.note
    })
  }

  const paid = round2(cart.paid || 0)
  const dueAmount = round2(Math.max(0, total - paid))
  const change = round2(Math.max(0, paid - total))
  const invoiceNo = await nextInvoiceNo()

  let customerName: string | undefined
  if (cart.customerId) {
    const c = await db.customers.findOne({ _id: cart.customerId })
    customerName = c?.name
  }

  const sale = await db.sales.insert({
    invoiceNo,
    date: now(),
    items,
    subtotal,
    discount: discountTotal,
    taxTotal,
    total,
    paid,
    change,
    dueAmount,
    costTotal,
    profit,
    paymentMethod: cart.paymentMethod as PaymentMethod,
    customerId: cart.customerId,
    customerName,
    status: 'completed',
    note: cart.note
  })

  // Decrement stock
  for (const item of items) {
    await applyStockDelta(item.productId, -item.qty, 'sale', {
      refId: sale._id,
      refNo: invoiceNo
    })
  }

  // Post credit/due to the customer ledger
  if (dueAmount > 0 && cart.customerId && customerName) {
    await postLedger('customer', cart.customerId, customerName, 'invoice', dueAmount, 0, {
      refId: sale._id,
      refNo: invoiceNo,
      note: `Invoice ${invoiceNo}`
    })
  }

  return sale
}

export async function listSales(q: (ListQuery & Partial<DateRange>) = {}): Promise<Sale[]> {
  const query: Record<string, unknown> = { status: { $ne: 'held' }, ...(q.filter ?? {}) }
  if (q.from || q.to) {
    query.date = { $gte: q.from ?? 0, $lte: q.to ?? Number.MAX_SAFE_INTEGER }
  }
  if (q.search) {
    query.$or = [{ invoiceNo: new RegExp(q.search, 'i') }, { customerName: new RegExp(q.search, 'i') }]
  }
  return getDb().sales.find(query, { sort: q.sort ?? { date: -1 }, limit: q.limit ?? 200, skip: q.skip })
}

export async function getSale(id: string): Promise<Sale | null> {
  return getDb().sales.findOne({ _id: id })
}

export async function listHeldSales(): Promise<Sale[]> {
  return getDb().sales.find({ status: 'held' }, { sort: { date: -1 } })
}

export async function removeHeld(id: string): Promise<void> {
  await getDb().sales.hardDelete({ _id: id, status: 'held' })
}

export async function refundSale(id: string): Promise<Sale> {
  const db = getDb()
  const sale = await db.sales.findOne({ _id: id })
  if (!sale) throw new Error('Sale not found')
  if (sale.status === 'refunded') return sale

  for (const item of sale.items) {
    await applyStockDelta(item.productId, item.qty, 'sale-return', {
      refId: sale._id,
      refNo: sale.invoiceNo,
      note: 'Refund'
    })
  }

  if (sale.dueAmount > 0 && sale.customerId && sale.customerName) {
    await postLedger('customer', sale.customerId, sale.customerName, 'refund', 0, sale.dueAmount, {
      refId: sale._id,
      refNo: sale.invoiceNo,
      note: `Refund ${sale.invoiceNo}`
    })
  }

  return db.sales.update(id, { status: 'refunded' })
}
