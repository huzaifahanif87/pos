import { create } from 'zustand'
import type { Product } from '@shared/types'

export interface CartLine {
  productId: string
  sku: string
  name: string
  price: number
  qty: number
  discount: number
  taxRate: number
  stock: number
  trackStock: boolean
}

interface CartState {
  lines: CartLine[]
  customerId?: string
  orderDiscount: number
  note: string
  add: (p: Product) => void
  setQty: (productId: string, qty: number) => void
  setPrice: (productId: string, price: number) => void
  setLineDiscount: (productId: string, discount: number) => void
  remove: (productId: string) => void
  clear: () => void
  setCustomer: (id?: string) => void
  setOrderDiscount: (n: number) => void
  setNote: (s: string) => void
  load: (lines: CartLine[], customerId?: string, note?: string) => void
  subtotal: () => number
  itemDiscount: () => number
  taxTotal: () => number
  total: () => number
  count: () => number
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  customerId: undefined,
  orderDiscount: 0,
  note: '',

  add: (p) => {
    const lines = get().lines
    const existing = lines.find((l) => l.productId === p._id)
    if (existing) {
      set({ lines: lines.map((l) => (l.productId === p._id ? { ...l, qty: l.qty + 1 } : l)) })
    } else {
      set({
        lines: [
          ...lines,
          {
            productId: p._id,
            sku: p.sku,
            name: p.name,
            price: p.salePrice,
            qty: 1,
            discount: 0,
            taxRate: p.taxRate,
            stock: p.stock,
            trackStock: p.trackStock
          }
        ]
      })
    }
  },

  setQty: (productId, qty) =>
    set({
      lines: get()
        .lines.map((l) => (l.productId === productId ? { ...l, qty: Math.max(0, qty) } : l))
        .filter((l) => l.qty > 0)
    }),

  setPrice: (productId, price) =>
    set({ lines: get().lines.map((l) => (l.productId === productId ? { ...l, price: Math.max(0, price) } : l)) }),

  setLineDiscount: (productId, discount) =>
    set({
      lines: get().lines.map((l) => (l.productId === productId ? { ...l, discount: Math.max(0, discount) } : l))
    }),

  remove: (productId) => set({ lines: get().lines.filter((l) => l.productId !== productId) }),

  clear: () => set({ lines: [], customerId: undefined, orderDiscount: 0, note: '' }),

  setCustomer: (customerId) => set({ customerId }),
  setOrderDiscount: (orderDiscount) => set({ orderDiscount: Math.max(0, orderDiscount) }),
  setNote: (note) => set({ note }),
  load: (lines, customerId, note) => set({ lines, customerId, note: note ?? '' }),

  subtotal: () => get().lines.reduce((a, l) => a + l.price * l.qty, 0),
  itemDiscount: () => get().lines.reduce((a, l) => a + l.discount, 0),
  taxTotal: () =>
    get().lines.reduce((a, l) => a + ((l.price * l.qty - l.discount) * l.taxRate) / 100, 0),
  total: () => {
    const s = get()
    const net = s.subtotal() - s.itemDiscount() - s.orderDiscount
    return Math.max(0, net + s.taxTotal())
  },
  count: () => get().lines.reduce((a, l) => a + l.qty, 0)
}))
