import type { Purchase, PurchaseItem } from '@shared/types'
import { getDb } from '../datastore'
import { now, round2 } from '../util'
import type { ListQuery } from '@shared/ipc'
import { nextPurchaseNo } from '../settings'
import { applyStockDelta } from './products'
import { postLedger } from './parties'

export async function listPurchases(q: ListQuery = {}): Promise<Purchase[]> {
  const query: Record<string, unknown> = { ...(q.filter ?? {}) }
  if (q.search) {
    query.$or = [{ billNo: new RegExp(q.search, 'i') }, { vendorName: new RegExp(q.search, 'i') }]
  }
  return getDb().purchases.find(query, { sort: q.sort ?? { date: -1 }, limit: q.limit ?? 200, skip: q.skip })
}

export async function savePurchase(input: Partial<Purchase> & { items: PurchaseItem[] }): Promise<Purchase> {
  const db = getDb()
  let subtotal = 0
  let itemDiscount = 0
  let taxTotal = 0
  const items: PurchaseItem[] = []

  for (const line of input.items) {
    const gross = round2(line.costPrice * line.qty)
    const lineDiscount = round2(line.discount || 0)
    const taxable = round2(gross - lineDiscount)
    const lineTax = round2((taxable * (line.taxRate || 0)) / 100)
    subtotal = round2(subtotal + gross)
    itemDiscount = round2(itemDiscount + lineDiscount)
    taxTotal = round2(taxTotal + lineTax)
    items.push({ ...line, lineTotal: round2(taxable + lineTax) })
  }

  const orderDiscount = round2(input.discount || 0)
  const discountTotal = round2(itemDiscount + orderDiscount)
  const total = round2(subtotal - discountTotal + taxTotal)
  const paid = round2(input.paid || 0)
  const dueAmount = round2(Math.max(0, total - paid))

  let vendorName = input.vendorName
  if (input.vendorId) {
    const v = await db.vendors.findOne({ _id: input.vendorId })
    vendorName = v?.name ?? vendorName
  }

  const billNo = input.billNo || (await nextPurchaseNo())
  const status = input.status ?? 'received'

  const purchase = await db.purchases.insert({
    billNo,
    date: input.date ?? now(),
    vendorId: input.vendorId,
    vendorName,
    items,
    subtotal,
    discount: discountTotal,
    taxTotal,
    total,
    paid,
    dueAmount,
    status,
    note: input.note
  })

  // Receiving stock increases inventory; for each new cost price, update the product cost too.
  if (status === 'received') {
    for (const item of items) {
      await applyStockDelta(item.productId, item.qty, 'purchase', {
        refId: purchase._id,
        refNo: billNo
      })
      if (item.costPrice > 0) {
        await db.products.update(item.productId, { costPrice: item.costPrice }).catch(() => undefined)
      }
    }
  }

  if (dueAmount > 0 && input.vendorId && vendorName) {
    await postLedger('vendor', input.vendorId, vendorName, 'purchase', dueAmount, 0, {
      refId: purchase._id,
      refNo: billNo,
      note: `Purchase ${billNo}`
    })
  }

  return purchase
}

export async function deletePurchase(id: string): Promise<void> {
  await getDb().purchases.softDelete(id)
}
