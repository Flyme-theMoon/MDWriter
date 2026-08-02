import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import type { FileNode, GlobalSearchMatch } from '../../shared/types/files'

const ignoredDirectories = new Set(['.git', 'node_modules', 'out', 'dist', 'build'])
const ignoredFiles = new Set(['.DS_Store'])
const searchableTextExtensions = new Set([
  '.md',
  '.markdown'
])
const maxGlobalSearchMatches = 500

export async function listDirectory(directory: string, depth = 4): Promise<FileNode[]> {
  if (depth <= 0) return []

  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes = await Promise.all(
    entries
      .filter((entry) => !ignoredDirectories.has(entry.name) && !ignoredFiles.has(entry.name))
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1
        }
        return left.name.localeCompare(right.name)
      })
      .map(async (entry) => {
        const path = join(directory, entry.name)

        if (entry.isDirectory()) {
          const node: FileNode = {
            name: entry.name,
            path,
            type: 'directory',
            children: await listDirectory(path, depth - 1)
          }
          return node
        }

        const lowerName = entry.name.toLowerCase()
        if (lowerName.endsWith('.md')) {
          const node: FileNode = {
            name: entry.name,
            path,
            type: 'file',
            kind: 'markdown'
          }
          return node
        }

        if (lowerName.endsWith('.pdf')) {
          const node: FileNode = {
            name: entry.name,
            path,
            type: 'file',
            kind: 'pdf'
          }
          return node
        }

        return null
      })
  )

  return nodes.filter((node): node is FileNode => node !== null)
}

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8')
}

function fuzzyMatchRange(
  text: string,
  query: string
): { start: number; end: number } | null {
  if (!query) return null

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) return null
  return { start: index, end: index + lowerQuery.length }
}

async function collectSearchMatches(
  directory: string,
  query: string,
  matches: GlobalSearchMatch[]
): Promise<void> {
  if (matches.length >= maxGlobalSearchMatches) return

  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (
      matches.length >= maxGlobalSearchMatches ||
      ignoredDirectories.has(entry.name) ||
      ignoredFiles.has(entry.name)
    ) {
      continue
    }

    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectSearchMatches(path, query, matches)
      continue
    }

    if (!searchableTextExtensions.has(extname(entry.name).toLowerCase())) {
      continue
    }

    let content: string
    try {
      content = await readFile(path, 'utf8')
    } catch {
      continue
    }

    const lines = content.split(/\r?\n/)
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      if (matches.length >= maxGlobalSearchMatches) break

      const lineText = lines[lineNumber]
      const match = fuzzyMatchRange(lineText, query)
      if (!match) continue

      const firstVisible = lineText.search(/\S/)
      if (firstVisible < 0) continue
      const snippet = lineText.slice(firstVisible)
      matches.push({
        path,
        name: basename(path),
        line: lineNumber + 1,
        start: Math.max(0, match.start - firstVisible),
        end: Math.max(0, match.end - firstVisible),
        snippet
      })
    }
  }
}

export async function searchDirectory(
  directory: string,
  query: string
): Promise<GlobalSearchMatch[]> {
  const matches: GlobalSearchMatch[] = []
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return matches
  await collectSearchMatches(directory, normalizedQuery, matches)
  return matches
}

export async function saveTextFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, 'utf8')
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function uniquePath(candidate: string): Promise<string> {
  if (!(await pathExists(candidate))) return candidate

  const directory = dirname(candidate)
  const extension = extname(candidate)
  const stem = basename(candidate, extension)

  for (let index = 1; ; index += 1) {
    const next = join(directory, `${stem} ${index}${extension}`)
    if (!(await pathExists(next))) return next
  }
}

export async function createMarkdownFile(
  directory: string,
  name = '新建 Markdown.md',
  content = ''
): Promise<string> {
  const safeName = name.replace(/[\\/]/g, '-')
  const fileName = safeName.toLowerCase().endsWith('.md')
    ? safeName
    : `${safeName}.md`
  const target = await uniquePath(join(directory, fileName))
  await writeFile(target, content, 'utf8')
  return target
}

export async function createDirectory(
  directory: string,
  name = '新建文件夹'
): Promise<string> {
  const target = await uniquePath(join(directory, name.replace(/[\\/]/g, '-')))
  await mkdir(target)
  return target
}

export async function copyFileToDirectory(
  sourcePath: string,
  destinationDirectory: string
): Promise<string> {
  const target = await uniquePath(
    join(destinationDirectory, basename(sourcePath))
  )
  await copyFile(sourcePath, target)
  return target
}

export async function renameEntry(
  sourcePath: string,
  name: string
): Promise<{ path: string; name: string }> {
  const directory = dirname(sourcePath)
  const safeName = name.trim().replace(/[\\/]/g, '-') || basename(sourcePath)
  const sourceExtension = extname(sourcePath)
  const targetName = extname(safeName) ? safeName : `${safeName}${sourceExtension}`
  const target = await uniquePath(join(directory, targetName))

  if (target === sourcePath) {
    return { path: sourcePath, name: basename(sourcePath) }
  }

  await rename(sourcePath, target)
  return { path: target, name: basename(target) }
}

export async function deleteFile(filePath: string): Promise<void> {
  const stats = await stat(filePath)
  if (stats.isDirectory()) {
    await rm(filePath, { recursive: true, force: true })
  } else {
    await unlink(filePath)
  }
}
