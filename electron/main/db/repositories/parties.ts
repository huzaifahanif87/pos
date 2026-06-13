import type { Customer, LedgerEntry, LedgerParty, LedgerType, PaymentMethod, Vendor } from '@shared/types'
import { getDb } from '../datastore'
import { escapeRegex, now, round2 } from '../util'
import type { ListQuery, PartyPayment } from '@shared/ipc'

function col(party: LedgerParty) {
  const db = getDb()
  return party === 'customer' ? db.customers : db.vendors
}

async function searchParties<T extends Customer | Vendor>(
  party: LedgerParty,
  q: ListQuery
): Promise<T[]> {
  const query: Record<string, unknown> = { ...(q.filter ?? {}) }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i')
    query.$or = [{ name: rx }, { phone: rx }, { email: rx }]
  }
  return col(party).find(query, { sort: q.sort ?? { name: 1 }, limit: q.limit, skip: q.skip }) as Promise<T[]>
}

export const listCustomers = (q: ListQuery = {}) => searchParties<Customer>('customer', q)
export const listVendors = (q: ListQuery = {}) => searchParties<Vendor>('vendor', q)

async function saveParty(party: LedgerParty, p: Partial<Customer>): Promise<Customer> {
  const isNew = !p._id
  const doc: Partial<Customer> = { openingBalance: 0, balance: 0, ...p }
  if (isNew) {
    doc.balance = doc.openingBalance ?? 0
  }
  const saved = (await col(party).upsert(doc)) as Customer
  if (isNew && (saved.openingBalance ?? 0) !== 0) {
    await getDb().ledger.insert({
      party,
      partyId: saved._id,
      partyName: saved.name,
      type: 'opening',
      debit: saved.openingBalance,
      credit: 0,
      balanceAfter: saved.openingBalance,
      note: 'Opening balance',
      date: now()
    })
  }
  return saved
}

export const saveCustomer = (p: Partial<Customer>) => saveParty('customer', p)
export const saveVendor = (p: Partial<Vendor>) => saveParty('vendor', p)

export async function deleteCustomer(id: string): Promise<void> {
  await getDb().customers.softDelete(id)
}
export async function deleteVendor(id: string): Promise<void> {
  await getDb().vendors.softDelete(id)
}

export async function getLedger(party: LedgerParty, partyId: string): Promise<LedgerEntry[]> {
  return getDb().ledger.find({ party, partyId }, { sort: { date: 1 } })
}

/**
 * Post a ledger entry and update the party's running balance.
 * `debit` increases what is owed, `credit` (a payment) reduces it.
 */
export async function postLedger(
  party: LedgerParty,
  partyId: string,
  partyName: string,
  type: LedgerType,
  debit: number,
  credit: number,
  ref?: { refId?: string; refNo?: string; method?: PaymentMethod; note?: string; date?: number }
): Promise<LedgerEntry> {
  const db = getDb()
  const partyDoc = (await col(party).findOne({ _id: partyId })) as Customer | null
  if (!partyDoc) throw new Error('Account not found')
  const balanceAfter = round2(partyDoc.balance + debit - credit)
  await col(party).update(partyId, { balance: balanceAfter })
  return db.ledger.insert({
    party,
    partyId,
    partyName,
    type,
    debit: round2(debit),
    credit: round2(credit),
    balanceAfter,
    refId: ref?.refId,
    refNo: ref?.refNo,
    method: ref?.method,
    note: ref?.note,
    date: ref?.date ?? now()
  })
}

export async function recordPayment(party: LedgerParty, p: PartyPayment): Promise<void> {
  const partyDoc = (await col(party).findOne({ _id: p.partyId })) as Customer | null
  if (!partyDoc) throw new Error('Account not found')
  const type: LedgerType = party === 'customer' ? 'payment-in' : 'payment-out'
  await postLedger(party, p.partyId, partyDoc.name, type, 0, round2(p.amount), {
    method: p.method as PaymentMethod,
    note: p.note ?? (party === 'customer' ? 'Payment received' : 'Payment made')
  })
}

export async function totalReceivable(): Promise<number> {
  return round2(await getDb().customers.sum('balance'))
}
export async function totalPayable(): Promise<number> {
  return round2(await getDb().vendors.sum('balance'))
}
