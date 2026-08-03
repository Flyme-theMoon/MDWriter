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
