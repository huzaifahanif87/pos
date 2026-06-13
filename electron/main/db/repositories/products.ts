import type { Product, StockMovement, StockMovementType, Category } from '@shared/types'
import { getDb } from '../datastore'
import { escapeRegex, now, round2 } from '../util'
import type { ListQuery } from '@shared/ipc'

export async function listCategories(): Promise<Category[]> {
  return getDb().categories.find({}, { sort: { name: 1 } })
}

export async function saveCategory(c: Partial<Category>): Promise<Category> {
  return getDb().categories.upsert(c)
}

export async function deleteCategory(id: string): Promise<void> {
  await getDb().categories.softDelete(id)
}

export async function listProducts(q: ListQuery = {}): Promise<Product[]> {
  const query: Record<string, unknown> = { ...(q.filter ?? {}) }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i')
    query.$or = [{ name: rx }, { sku: rx }, { barcode: rx }]
  }
  return getDb().products.find(query, {
    sort: q.sort ?? { name: 1 },
    limit: q.limit,
    skip: q.skip
  })
}

export async function getProduct(id: string): Promise<Product | null> {
  return getDb().products.findOne({ _id: id })
}

export async function findByBarcode(code: string): Promise<Product | null> {
  const db = getDb()
  const byBarcode = await db.products.findOne({ barcode: code })
  if (byBarcode) return byBarcode
  return db.products.findOne({ sku: code })
}

export async function saveProduct(p: Partial<Product>): Promise<Product> {
  const db = getDb()
  const isNew = !p._id
  const doc: Partial<Product> = {
    unit: 'pcs',
    costPrice: 0,
    salePrice: 0,
    taxRate: 0,
    stock: 0,
    lowStockThreshold: 5,
    trackStock: true,
    active: true,
    ...p
  }
  const saved = await db.products.upsert(doc)
  if (isNew && saved.trackStock && saved.stock !== 0) {
    await recordStockMovement(saved._id, saved.name, 'opening', saved.stock, saved.stock)
  }
  return saved
}

export async function deleteProduct(id: string): Promise<void> {
  await getDb().products.softDelete(id)
}

export async function recordStockMovement(
  productId: string,
  productName: string,
  type: StockMovementType,
  qty: number,
  balanceAfter: number,
  ref?: { refId?: string; refNo?: string; note?: string }
): Promise<StockMovement> {
  return getDb().stock.insert({
    productId,
    productName,
    type,
    qty,
    balanceAfter,
    refId: ref?.refId,
    refNo: ref?.refNo,
    note: ref?.note,
    date: now()
  })
}

/** Apply a signed stock delta to a product and log the movement. */
export async function applyStockDelta(
  productId: string,
  delta: number,
  type: StockMovementType,
  ref?: { refId?: string; refNo?: string; note?: string }
): Promise<Product | null> {
  const db = getDb()
  const product = await db.products.findOne({ _id: productId })
  if (!product || !product.trackStock) return product
  const newStock = round2(product.stock + delta)
  const updated = await db.products.update(productId, { stock: newStock })
  await recordStockMovement(productId, product.name, type, delta, newStock, ref)
  return updated
}

export async function adjustStock(productId: string, qty: number, note?: string): Promise<Product> {
  const db = getDb()
  const product = await db.products.findOne({ _id: productId })
  if (!product) throw new Error('Product not found')
  const newStock = round2(qty)
  const delta = round2(newStock - product.stock)
  const updated = await db.products.update(productId, { stock: newStock })
  await recordStockMovement(productId, product.name, 'adjustment', delta, newStock, { note })
  return updated
}

export async function listStockMovements(productId?: string, limit = 200): Promise<StockMovement[]> {
  const query = productId ? { productId } : {}
  return getDb().stock.find(query, { sort: { date: -1 }, limit })
}

export async function inventoryValue(): Promise<number> {
  const products = await getDb().products.find({ trackStock: true })
  return round2(products.reduce((acc, p) => acc + p.stock * p.costPrice, 0))
}

export async function lowStockProducts(): Promise<Product[]> {
  const products = await getDb().products.find({ trackStock: true, active: true })
  return products.filter((p) => p.stock <= p.lowStockThreshold)
}
