import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  SavePngPagePayload,
  SavePngPageResult
} from '../../shared/types/files'

function sanitizeExportName(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+$/, '')
  return cleaned || 'export'
}

function buildPngFileName(
  baseName: string,
  pageNumber: number,
  totalPages: number
): string {
  const width = Math.max(2, String(totalPages).length)
  return `${sanitizeExportName(baseName)}-${String(pageNumber).padStart(width, '0')}.png`
}

export async function savePngPage(
  payload: SavePngPagePayload
): Promise<SavePngPageResult> {
  if (
    !Number.isInteger(payload.pageNumber) ||
    payload.pageNumber < 1 ||
    !Number.isInteger(payload.totalPages) ||
    payload.totalPages < 1
  ) {
    throw new Error('Invalid PNG export page numbers')
  }

  const target = join(
    payload.directory,
    buildPngFileName(payload.baseName, payload.pageNumber, payload.totalPages)
  )
  await mkdir(payload.directory, { recursive: true })

  try {
    await writeFile(target, Buffer.from(payload.buffer))
  } catch (error) {
    await unlink(target).catch(() => undefined)
    throw error
  }

  return { path: target }
}

export async function removeExportFiles(paths: string[]): Promise<void> {
  await Promise.all(paths.map((path) => unlink(path).catch(() => undefined)))
}
