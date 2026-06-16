import { format } from 'date-fns'

let currencySymbol = '$'
let currencyCode = 'USD'

export function setCurrency(symbol: string, code: string): void {
  currencySymbol = symbol || '$'
  currencyCode = code || 'USD'
}

export function money(n: number | undefined | null): string {
  const v = Number(n ?? 0)
  const formatted = Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${v < 0 ? '-' : ''}${currencySymbol}${formatted}`
}

export function moneyCode(): string {
  return currencyCode
}

export function num(n: number | undefined | null, digits = 0): string {
  return Number(n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

/** Quantity formatter: shows up to 3 decimals, trimming trailing zeros (e.g. 1.5, 0.25, 40). */
export function qty(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

const DECIMAL_UNITS = new Set(['kg', 'g', 'ltr', 'l', 'ml', 'm', 'cm', 'gram', 'litre', 'liter'])
export function isDecimalUnit(unit: string | undefined): boolean {
  return unit ? DECIMAL_UNITS.has(unit.toLowerCase()) : false
}

export function pct(n: number | undefined | null): string {
  const v = Number(n ?? 0)
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

export function dt(ts: number | undefined | null, fmt = 'MMM d, yyyy'): string {
  if (!ts) return '—'
  return format(ts, fmt)
}

export function dtTime(ts: number | undefined | null): string {
  if (!ts) return '—'
  return format(ts, 'MMM d, yyyy · h:mm a')
}

export function timeAgo(ts: number | undefined | null): string {
  if (!ts) return 'never'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
