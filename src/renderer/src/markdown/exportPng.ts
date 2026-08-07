import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

const PNG_EXPORT_SCALE = 2

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG canvas conversion failed'))
    }, 'image/png')
  })
}

export async function renderPdfToPngPages(
  pdfData: Uint8Array,
  onPage: (pageNumber: number, totalPages: number, png: ArrayBuffer) => Promise<void>
): Promise<void> {
  const loadingTask = getDocument({ data: pdfData })
  const pdf = await loadingTask.promise

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: PNG_EXPORT_SCALE })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)

      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Unable to create PNG export canvas')
      }

      await page.render({ canvas, canvasContext: context, viewport }).promise
      const png = await canvasToPng(canvas)
      const buffer = await png.arrayBuffer()

      await onPage(pageNumber, pdf.numPages, buffer)

      canvas.width = 0
      canvas.height = 0
      await page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }
}
