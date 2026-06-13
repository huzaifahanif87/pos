import type { UserRole } from '@shared/types'

// Capabilities gate both navigation (which pages appear) and sensitive actions
// (seeing profit, refunding, deleting, managing users).
export type Cap =
  | 'dashboard'
  | 'register'
  | 'inventory'
  | 'sales'
  | 'purchases'
  | 'customers'
  | 'vendors'
  | 'expenses'
  | 'reports'
  | 'forecast'
  | 'settings'
  | 'viewProfit'
  | 'refund'
  | 'delete'
  | 'manageUsers'

const ALL: Cap[] = [
  'dashboard', 'register', 'inventory', 'sales', 'purchases', 'customers',
  'vendors', 'expenses', 'reports', 'forecast', 'settings',
  'viewProfit', 'refund', 'delete', 'manageUsers'
]

const ROLE_CAPS: Record<UserRole, Cap[]> = {
  // Full access to everything.
  owner: ALL,
  // Runs day-to-day operations and sees the numbers, but not app/user/backup settings.
  manager: [
    'dashboard', 'register', 'inventory', 'sales', 'purchases', 'customers',
    'vendors', 'expenses', 'reports', 'forecast', 'viewProfit', 'refund', 'delete'
  ],
  // Focused till: sell, look up past receipts, manage customer accounts/credit.
  // No dashboard, profit, reports, purchasing, vendors, expenses or settings.
  cashier: ['register', 'sales', 'customers']
}

export function can(role: UserRole | undefined, cap: Cap): boolean {
  if (!role) return false
  return ROLE_CAPS[role].includes(cap)
}

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier'
}
