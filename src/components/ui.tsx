import { type ReactNode, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../store/app'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('card p-5', className)}>{children}</div>
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'brand'
}: {
  label: string
  value: string
  sub?: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan'
}) {
  void tone
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
        </div>
        {icon && <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-gray-700">{icon}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

/**
 * Numeric input that keeps a local text buffer while focused so users can type
 * fractional values (e.g. "1.5", "0.25") without the controlled value snapping
 * back. Commits a parsed number via onChange on every valid keystroke.
 */
export function NumberInput({
  value,
  onChange,
  allowDecimal = true,
  className = 'input',
  placeholder,
  autoFocus,
  min = 0
}: {
  value: number
  onChange: (n: number) => void
  allowDecimal?: boolean
  className?: string
  placeholder?: string
  autoFocus?: boolean
  min?: number
}) {
  const [buf, setBuf] = useState(value ? String(value) : '')
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setBuf(value ? String(value) : '')
  }, [value, focused])

  const handle = (raw: string) => {
    let cleaned = allowDecimal ? raw.replace(/[^0-9.]/g, '') : raw.replace(/[^0-9]/g, '')
    if (allowDecimal) {
      const parts = cleaned.split('.')
      if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('')
    }
    setBuf(cleaned)
    if (cleaned === '' || cleaned === '.') return onChange(0)
    const n = parseFloat(cleaned)
    if (!isNaN(n)) onChange(Math.max(min, n))
  }

  return (
    <input
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      className={className}
      value={buf}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        setBuf(value ? String(value) : '')
      }}
      onChange={(e) => handle(e.target.value)}
    />
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-gray-200 text-gray-900',
    green: 'bg-emerald-500/15 text-emerald-600',
    red: 'bg-rose-500/15 text-rose-600',
    amber: 'bg-amber-500/15 text-amber-600',
    blue: 'bg-gray-100 text-gray-900',
    violet: 'bg-violet-500/15 text-violet-700'
  }
  return <span className={clsx('chip', tones[tone] ?? tones.slate)}>{children}</span>
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={clsx('card w-full p-0', widths[size])} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon && <div className="text-gray-400">{icon}</div>}
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {hint && <p className="max-w-sm text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-gray-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export function Toaster() {
  const { toasts, dismiss } = useApp()
  const tones: Record<string, string> = {
    success: 'border-emerald-500/40 bg-emerald-50 text-emerald-700',
    error: 'border-rose-500/40 bg-rose-50 text-rose-700',
    info: 'border-gray-300 bg-gray-50 text-gray-900'
  }
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx('pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur', tones[t.kind])}
          onClick={() => dismiss(t.id)}
        >
          <span>{t.message}</span>
          <X size={14} className="opacity-60" />
        </div>
      ))}
    </div>
  )
}
