import type { PosApi } from '@shared/ipc'

// `window.api` is injected by the preload bridge.
export const api: PosApi = window.api
