import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import Datastore from '@seald-io/nedb'
import type { BaseDoc } from '@shared/types'
import { newId, now } from './util'

/**
 * Thin promise-based wrapper over a NeDB datastore. NeDB speaks a MongoDB-style
 * query/update dialect, so the same documents work against MongoDB Atlas in the
 * cloud sync layer with no transformation.
 */
export class Collection<T extends BaseDoc> {
  readonly store: Datastore

  constructor(filename: string, indexes: { fieldName: string; unique?: boolean }[] = []) {
    this.store = new Datastore({ filename, autoload: true, timestampData: false })
    for (const idx of indexes) {
      // sparse so optional unique fields (barcode) don't collide on undefined
      void this.store.ensureIndexAsync({ fieldName: idx.fieldName, unique: idx.unique, sparse: true })
    }
  }

  async insert(doc: Partial<T>): Promise<T> {
    const ts = now()
    const full = {
      _id: doc._id ?? newId(),
      createdAt: doc.createdAt ?? ts,
      updatedAt: ts,
      rev: 1,
      ...doc
    } as T
    return (await this.store.insertAsync(full as never)) as T
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const existing = (await this.store.findOneAsync({ _id: id })) as T | null
    if (!existing) throw new Error(`Record ${id} not found`)
    const next = {
      ...existing,
      ...patch,
      _id: id,
      updatedAt: now(),
      rev: (existing.rev ?? 1) + 1,
      syncedAt: undefined
    } as T
    await this.store.updateAsync({ _id: id }, next, {})
    return next
  }

  /** Insert when missing, otherwise patch. */
  async upsert(doc: Partial<T> & { _id?: string }): Promise<T> {
    if (doc._id) {
      const existing = await this.findOne({ _id: doc._id } as never)
      if (existing) return this.update(doc._id, doc)
    }
    return this.insert(doc)
  }

  /** Soft delete (tombstone) so the deletion can sync to the cloud. */
  async softDelete(id: string): Promise<void> {
    await this.store.updateAsync(
      { _id: id },
      { $set: { deleted: true, updatedAt: now(), syncedAt: undefined } },
      {}
    )
  }

  async hardDelete(query: object): Promise<number> {
    return this.store.removeAsync(query, { multi: true })
  }

  async findOne(query: object): Promise<T | null> {
    const doc = (await this.store.findOneAsync({ deleted: { $ne: true }, ...query })) as T | null
    return doc
  }

  async find(
    query: object = {},
    opts: { sort?: Record<string, 1 | -1>; limit?: number; skip?: number } = {}
  ): Promise<T[]> {
    let cursor = this.store.findAsync({ deleted: { $ne: true }, ...query })
    if (opts.sort) cursor = cursor.sort(opts.sort)
    if (opts.skip) cursor = cursor.skip(opts.skip)
    if (opts.limit) cursor = cursor.limit(opts.limit)
    return (await cursor.execAsync()) as T[]
  }

  /** Include tombstoned docs — used by the sync engine. */
  async findRaw(query: object = {}): Promise<T[]> {
    return (await this.store.findAsync(query).execAsync()) as T[]
  }

  async count(query: object = {}): Promise<number> {
    return this.store.countAsync({ deleted: { $ne: true }, ...query })
  }

  async sum(field: keyof T, query: object = {}): Promise<number> {
    const docs = await this.find(query)
    return docs.reduce((acc, d) => acc + (Number(d[field]) || 0), 0)
  }
}

export interface Db {
  users: Collection<import('@shared/types').User>
  categories: Collection<import('@shared/types').Category>
  products: Collection<import('@shared/types').Product>
  customers: Collection<import('@shared/types').Customer>
  vendors: Collection<import('@shared/types').Vendor>
  sales: Collection<import('@shared/types').Sale>
  purchases: Collection<import('@shared/types').Purchase>
  ledger: Collection<import('@shared/types').LedgerEntry>
  stock: Collection<import('@shared/types').StockMovement>
  expenses: Collection<import('@shared/types').Expense>
  settings: Datastore
  dataDir: string
}

let db: Db | null = null

export function initDb(userDataDir: string): Db {
  if (db) return db
  const dataDir = join(userDataDir, 'data')
  mkdirSync(dataDir, { recursive: true })
  const f = (name: string) => join(dataDir, `${name}.db`)

  db = {
    users: new Collection(f('users'), [{ fieldName: 'username', unique: true }]),
    categories: new Collection(f('categories')),
    products: new Collection(f('products'), [
      { fieldName: 'sku', unique: true },
      { fieldName: 'barcode', unique: true }
    ]),
    customers: new Collection(f('customers')),
    vendors: new Collection(f('vendors')),
    sales: new Collection(f('sales'), [{ fieldName: 'invoiceNo' }]),
    purchases: new Collection(f('purchases'), [{ fieldName: 'billNo' }]),
    ledger: new Collection(f('ledger')),
    stock: new Collection(f('stock')),
    expenses: new Collection(f('expenses')),
    settings: new Datastore({ filename: f('settings'), autoload: true }),
    dataDir
  }
  return db
}

export function getDb(): Db {
  if (!db) throw new Error('Database not initialized')
  return db
}

/** Returns every collection that participates in cloud sync. */
export function syncedCollections(d: Db): { name: string; col: Collection<BaseDoc> }[] {
  return [
    { name: 'users', col: d.users as Collection<BaseDoc> },
    { name: 'categories', col: d.categories as Collection<BaseDoc> },
    { name: 'products', col: d.products as Collection<BaseDoc> },
    { name: 'customers', col: d.customers as Collection<BaseDoc> },
    { name: 'vendors', col: d.vendors as Collection<BaseDoc> },
    { name: 'sales', col: d.sales as Collection<BaseDoc> },
    { name: 'purchases', col: d.purchases as Collection<BaseDoc> },
    { name: 'ledger', col: d.ledger as Collection<BaseDoc> },
    { name: 'stock', col: d.stock as Collection<BaseDoc> },
    { name: 'expenses', col: d.expenses as Collection<BaseDoc> }
  ]
}
