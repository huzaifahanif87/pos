import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  ReceiptText,
  ClipboardList,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Store,
  TrendingUp
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from './store/app'
import { can, ROLE_LABEL, type Cap } from './lib/permissions'
import { Spinner, Toaster } from './components/ui'
import { SyncPill } from './components/SyncPill'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Register from './pages/Register'
import Products from './pages/Products'
import Customers from './pages/Customers'
import Vendors from './pages/Vendors'
import Purchases from './pages/Purchases'
import Sales from './pages/Sales'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Forecast from './pages/Forecast'
import SettingsPage from './pages/Settings'

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; cap: Cap; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, cap: 'dashboard', end: true },
  { to: '/register', label: 'Sell / Register', icon: ShoppingCart, cap: 'register' },
  { to: '/products', label: 'Inventory', icon: Package, cap: 'inventory' },
  { to: '/sales', label: 'Sales History', icon: ReceiptText, cap: 'sales' },
  { to: '/purchases', label: 'Purchases', icon: ClipboardList, cap: 'purchases' },
  { to: '/customers', label: 'Customers', icon: Users, cap: 'customers' },
  { to: '/vendors', label: 'Vendors', icon: Truck, cap: 'vendors' },
  { to: '/expenses', label: 'Expenses', icon: Wallet, cap: 'expenses' },
  { to: '/reports', label: 'Reports', icon: BarChart3, cap: 'reports' },
  { to: '/forecast', label: 'Forecasting', icon: TrendingUp, cap: 'forecast' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, cap: 'settings' }
]

function Sidebar() {
  const { settings, user, setUser } = useApp()
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gray-900 text-white">
          <Store size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Nexus POS</p>
          <p className="truncate text-xs text-gray-400">{settings?.shop.name}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.filter((n) => can(user?.role, n.cap)).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}
          >
            <n.icon size={18} />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center justify-between rounded-xl px-2 py-2">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gray-200 text-xs font-semibold uppercase text-gray-900">
              {user?.name?.[0] ?? 'U'}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900">{user?.name}</p>
              <p className="text-[11px] text-gray-400">{user ? ROLE_LABEL[user.role] : ''}</p>
            </div>
          </div>
          <button
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-rose-600"
            title="Log out"
            onClick={() => setUser(null)}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function Topbar() {
  const location = useLocation()
  const title = NAV.find((n) => (n.end ? n.to === location.pathname : location.pathname.startsWith(n.to) && n.to !== '/'))?.label ?? 'Dashboard'
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      <SyncPill />
    </header>
  )
}

export default function App() {
  const { ready, user, init } = useApp()

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner label="Starting Nexus POS…" />
      </div>
    )
  }

  if (!user) return <Login />

  const role = user.role
  // First page this role is allowed to see — where redirects and "/" land.
  const home = NAV.find((n) => can(role, n.cap))?.to ?? '/register'
  // Render a route only if permitted; otherwise bounce to the role's home page.
  const g = (cap: Cap, el: JSX.Element) => (can(role, cap) ? el : <Navigate to={home} replace />)

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <Routes>
            <Route path="/" element={g('dashboard', <Dashboard />)} />
            <Route path="/register" element={g('register', <Register />)} />
            <Route path="/products" element={g('inventory', <Products />)} />
            <Route path="/sales" element={g('sales', <Sales />)} />
            <Route path="/purchases" element={g('purchases', <Purchases />)} />
            <Route path="/customers" element={g('customers', <Customers />)} />
            <Route path="/vendors" element={g('vendors', <Vendors />)} />
            <Route path="/expenses" element={g('expenses', <Expenses />)} />
            <Route path="/reports" element={g('reports', <Reports />)} />
            <Route path="/forecast" element={g('forecast', <Forecast />)} />
            <Route path="/settings" element={g('settings', <SettingsPage />)} />
            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </main>
      </div>
      <Toaster />
    </div>
  )
}
