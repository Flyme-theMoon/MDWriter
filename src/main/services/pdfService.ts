import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import type { ExportPdfResult } from '../../shared/types/files'

export async function exportPdf(
  html: string,
  defaultName: string,
  targetPath?: string
): Promise<ExportPdfResult> {
  const owner = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  let filePath = targetPath

  if (!filePath) {
    const options = {
      title: '导出 PDF',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    }
    const result = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options)

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    filePath = result.filePath
  }

  let printWindow: BrowserWindow | null = null
  try {
    printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true
      }
    })
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await printWindow.webContents.executeJavaScript(`
      (async () => {
        await document.fonts.ready
        await Promise.all([
          document.fonts.load('1.21em Lora', '0123456789').catch(() => []),
          document.fonts.load('500 1.21em Newsreader', '0123456789').catch(() => []),
          document.fonts.load('1.21em Geist Mono', '0123456789').catch(() => []),
          document.fonts.load('1.21em KaTeX_Main', '0123456789{}').catch(() => []),
          document.fonts.load('1.21em KaTeX_Size1', '{}').catch(() => []),
          document.fonts.load('1.21em KaTeX_Size2', '{}').catch(() => []),
          document.fonts.load('1.21em KaTeX_Size3', '{}').catch(() => []),
          document.fonts.load('1.21em KaTeX_Size4', '{}').catch(() => [])
        ])
        return true
      })()
    `)
    const pdf = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: true,
      generateDocumentOutline: true,
      generateTaggedPDF: true
    })
    await writeFile(filePath, pdf)
    return { canceled: false, path: filePath }
  } finally {
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.destroy()
    }
  }
}
