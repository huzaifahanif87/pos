import { create } from 'zustand'
import type { AppSettings, SyncStatus, User } from '@shared/types'
import { api } from '../lib/api'
import { setCurrency } from '../lib/format'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  message: string
}

interface AppState {
  settings: AppSettings | null
  user: User | null
  syncStatus: SyncStatus | null
  toasts: Toast[]
  ready: boolean
  init: () => Promise<void>
  setUser: (u: User | null) => void
  refreshSettings: () => Promise<void>
  setSettings: (s: AppSettings) => void
  toast: (kind: Toast['kind'], message: string) => void
  dismiss: (id: string) => void
}

export const useApp = create<AppState>((set, get) => ({
  settings: null,
  user: null,
  syncStatus: null,
  toasts: [],
  ready: false,

  init: async () => {
    const settings = await api.getSettings()
    setCurrency(settings.shop.currencySymbol, settings.shop.currency)
    const syncStatus = await api.getSyncStatus()
    set({ settings, syncStatus, ready: true })
    api.onSyncStatus((s) => set({ syncStatus: s }))
  },

  setUser: (user) => set({ user }),

  refreshSettings: async () => {
    const settings = await api.getSettings()
    setCurrency(settings.shop.currencySymbol, settings.shop.currency)
    set({ settings })
  },

  setSettings: (settings) => {
    setCurrency(settings.shop.currencySymbol, settings.shop.currency)
    set({ settings })
  },

  toast: (kind, message) => {
    const id = Math.random().toString(36).slice(2)
    set({ toasts: [...get().toasts, { id, kind, message }] })
    setTimeout(() => get().dismiss(id), 3500)
  },

  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))
