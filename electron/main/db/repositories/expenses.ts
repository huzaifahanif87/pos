import type { Expense } from '@shared/types'
import { getDb } from '../datastore'
import { now } from '../util'
import type { ListQuery, DateRange } from '@shared/ipc'

export async function listExpenses(q: (ListQuery & Partial<DateRange>) = {}): Promise<Expense[]> {
  const query: Record<string, unknown> = { ...(q.filter ?? {}) }
  if (q.from || q.to) {
    query.date = { $gte: q.from ?? 0, $lte: q.to ?? Number.MAX_SAFE_INTEGER }
  }
  if (q.search) query.$or = [{ category: new RegExp(q.search, 'i') }, { note: new RegExp(q.search, 'i') }]
  return getDb().expenses.find(query, { sort: q.sort ?? { date: -1 }, limit: q.limit ?? 500 })
}

export async function saveExpense(e: Partial<Expense>): Promise<Expense> {
  return getDb().expenses.upsert({ category: 'General', amount: 0, date: now(), ...e })
}

export async function deleteExpense(id: string): Promise<void> {
  await getDb().expenses.softDelete(id)
}
