import { getDb } from './datastore'
import { hashSecret } from './util'
import { getSettings } from './settings'

/**
 * On first run we only ensure default settings and the two staff accounts exist.
 * No demo catalog/customers/sales — the shop starts with a clean, empty database
 * ready for real data.
 *
 * Default logins: Store Owner (admin / PIN 1234), Cashier (cashier / PIN 1111).
 * Change or remove these from Settings → Users once you're set up.
 */
export async function seedIfEmpty(): Promise<void> {
  const db = getDb()
  await getSettings() // ensure default settings document exists

  const userCount = await db.users.count({})
  if (userCount === 0) {
    await db.users.insert({
      username: 'admin',
      name: 'Store Owner',
      role: 'owner',
      pinHash: hashSecret('1234'),
      active: true
    })
    await db.users.insert({
      username: 'cashier',
      name: 'Cashier',
      role: 'cashier',
      pinHash: hashSecret('1111'),
      active: true
    })
  }
}
