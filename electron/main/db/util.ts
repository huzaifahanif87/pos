import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export const now = (): number => Date.now()

/** Compact, sortable, collision-resistant id (timestamp + random). */
export function newId(prefix = ''): string {
  const ts = Date.now().toString(36)
  const rnd = randomBytes(6).toString('hex')
  return `${prefix}${ts}${rnd}`
}

/** Hash a PIN/password with a per-record salt using scrypt. */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(secret, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifySecret(secret: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(secret, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Quantity precision — 3 decimals so weighed items (e.g. 0.125 kg) stay accurate. */
export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000
}

const DECIMAL_UNITS = new Set(['kg', 'g', 'ltr', 'l', 'ml', 'm', 'cm', 'gram', 'litre', 'liter'])
export function isDecimalUnit(unit: string | undefined): boolean {
  return unit ? DECIMAL_UNITS.has(unit.toLowerCase()) : false
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
