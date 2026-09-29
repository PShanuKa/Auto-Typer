import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, shell } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const CANCEL_SHORTCUT = 'CommandOrControl+Alt+X'

let mainWindow = null
let run = null

function typerScriptPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'typer.ps1')
    : join(app.getAppPath(), 'resources', 'typer.ps1')
}

function sendStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('type:status', status)
  }
}

function finishRun(status) {
  if (!run) {
    return
  }
  clearInterval(run.timer)
  if (run.tempFile && existsSync(run.tempFile)) {
    try {
      unlinkSync(run.tempFile)
    } catch {
      // the typer script deletes it too; ignore races
    }
  }
  run = null
  globalShortcut.unregister(CANCEL_SHORTCUT)
  sendStatus(status)
}

function cancelRun() {
  if (!run) {
    return
  }
  if (run.child) {
    run.child.kill()
  }
  finishRun({ phase: 'cancelled' })
}

function startTyping(options) {
  const text = options.pressEnter ? `${options.text}\n` : options.text
  const tempFile = join(tmpdir(), `auto-typer-${randomUUID()}.txt`)
  writeFileSync(tempFile, text, 'utf8')
  run.tempFile = tempFile

  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      typerScriptPath(),
      '-Path',
      tempFile,
      '-DelayMs',
      String(options.delayMs),
      '-Mode',
      options.mode
    ],
    { windowsHide: true }
  )
  run.child = child

  let total = 0
  let stderr = ''
  let buffer = ''
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop()
    for (const line of lines) {
      if (line.startsWith('T:')) {
        total = Number(line.slice(2))
        sendStatus({ phase: 'typing', done: 0, total })
      } else if (line.startsWith('P:')) {
        sendStatus({ phase: 'typing', done: Number(line.slice(2)), total })
      }
    }
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  child.on('error', (err) => finishRun({ phase: 'error', message: err.message }))
  child.on('close', (code) => {
    if (!run || run.child !== child) {
      return
    }
    if (code === 0) {
      finishRun({ phase: 'done', total })
    } else {
      finishRun({ phase: 'error', message: stderr.trim() || `Typer exited with code ${code}` })
    }
  })
}

ipcMain.handle('type:start', (_event, options) => {
  if (run || !options?.text) {
    return false
  }
  run = { timer: null, child: null, tempFile: null }
  globalShortcut.register(CANCEL_SHORTCUT, cancelRun)

  let remaining = Math.max(0, Math.floor(options.countdown))
  sendStatus({ phase: 'countdown', remaining })
  if (remaining === 0) {
    startTyping(options)
    return true
  }
  run.timer = setInterval(() => {
    remaining -= 1
    if (remaining > 0) {
      sendStatus({ phase: 'countdown', remaining })
      return
    }
    clearInterval(run.timer)
    startTyping(options)
  }, 1000)
  return true
})

ipcMain.handle('type:cancel', () => cancelRun())
ipcMain.handle('clipboard:read', () => clipboard.readText())
ipcMain.handle('window:setAlwaysOnTop', (_event, value) => {
  mainWindow?.setAlwaysOnTop(Boolean(value))
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 640,
    minWidth: 420,
    minHeight: 520,
    title: 'Auto Typer',
    // Packaged builds take the icon from the exe; dev mode needs it set explicitly.
    ...(app.isPackaged ? {} : { icon: join(app.getAppPath(), 'build', 'icon.png') }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Contact links (mailto:, tel:, https:) open in the system default app, never inside this window.
  const openExternal = (url) => {
    if (/^(mailto|tel|https):/i.test(url)) {
      shell.openExternal(url)
    }
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault()
      openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  cancelRun()
  app.quit()
})

app.on('will-quit', () => globalShortcut.unregisterAll())
