import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  start: (options) => ipcRenderer.invoke('type:start', options),
  cancel: () => ipcRenderer.invoke('type:cancel'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:setAlwaysOnTop', value),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('type:status', listener)
    return () => ipcRenderer.removeListener('type:status', listener)
  }
})
