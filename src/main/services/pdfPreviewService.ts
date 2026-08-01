import { BrowserWindow } from 'electron'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { OpenPathResult } from '../../shared/types/files'

const pdfWindows = new Set<BrowserWindow>()

export async function openPdfPreview(
  filePath: string
): Promise<OpenPathResult> {
  const previewWindow = new BrowserWindow({
    width: 980,
    height: 820,
    title: basename(filePath),
    backgroundColor: '#faf9f5',
    autoHideMenuBar: true,
    webPreferences: {
      plugins: true,
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  pdfWindows.add(previewWindow)
  previewWindow.on('closed', () => pdfWindows.delete(previewWindow))

  try {
    await previewWindow.loadURL(pathToFileURL(filePath).toString())
    return { error: null }
  } catch (error) {
    if (!previewWindow.isDestroyed()) {
      previewWindow.destroy()
    }
    return {
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
