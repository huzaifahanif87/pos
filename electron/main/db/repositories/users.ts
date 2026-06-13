import type { User } from '@shared/types'
import { getDb } from '../datastore'
import { hashSecret, verifySecret } from '../util'

function strip(u: User): User {
  return { ...u, pinHash: '' }
}

export async function listUsers(): Promise<User[]> {
  const users = await getDb().users.find({}, { sort: { name: 1 } })
  return users.map(strip)
}

export async function login(
  username: string,
  pin: string
): Promise<{ ok: boolean; user?: User; error?: string }> {
  const user = await getDb().users.findOne({ username: username.toLowerCase().trim() })
  if (!user || !user.active) return { ok: false, error: 'Unknown or disabled user' }
  if (!verifySecret(pin, user.pinHash)) return { ok: false, error: 'Incorrect PIN' }
  return { ok: true, user: strip(user) }
}

export async function saveUser(input: Partial<User> & { pin?: string }): Promise<User> {
  const db = getDb()
  const doc: Partial<User> = {
    role: 'cashier',
    active: true,
    ...input,
    username: (input.username ?? '').toLowerCase().trim()
  }
  delete (doc as { pin?: string }).pin
  if (input.pin) doc.pinHash = hashSecret(input.pin)
  const saved = await db.users.upsert(doc)
  return strip(saved)
}

export async function deleteUser(id: string): Promise<void> {
  const owners = await getDb().users.find({ role: 'owner' })
  const target = await getDb().users.findOne({ _id: id })
  if (target?.role === 'owner' && owners.length <= 1) {
    throw new Error('Cannot delete the only owner account')
  }
  await getDb().users.softDelete(id)
}
