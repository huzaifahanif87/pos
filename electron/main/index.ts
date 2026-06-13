import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { initDb } from './db/datastore'
import { seedIfEmpty } from './db/seed'
import { router } from './ipc/router'
import { backup } from './services/backup'
import { IPC } from '@shared/ipc'

const isDev = !app.isPackaged

// On Linux, unprivileged dev runs hit Chromium's SUID-sandbox permission check
// (chrome-sandbox must be root:root mode 4755). Packaged builds set this up via
// the installer, so only relax it for local Linux development. Windows/macOS are
// unaffected.
if (isDev && process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}

// Many Linux machines (esp. Intel integrated graphics / headless-ish sessions)
// fail GPU process init and can show a blank window. Software rendering is plenty
// for this UI, so disable hardware acceleration on Linux. Windows/macOS keep it.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: 'Nexus POS',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.invoke, async (_e, method: string, args: unknown[]) => {
    const fn = (router as Record<string, (...a: unknown[]) => unknown>)[method]
    if (typeof fn !== 'function') throw new Error(`Unknown method: ${method}`)
    return fn(...(args ?? []))
  })

  // Push sync/backup status changes to the renderer.
  backup.on('status', (status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('sync:status', status)
    }
  })
}

app.whenReady().then(async () => {
  initDb(app.getPath('userData'))
  await seedIfEmpty()
  registerIpc()
  createWindow()
  backup.startAuto()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
