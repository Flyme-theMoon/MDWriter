function encodePath(filePath: string): string {
  return encodeURI(filePath)
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

function decodeSafely(value: string): string {
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}

function unwrapMarkdownPath(value: string): string {
  return value.startsWith('<') && value.endsWith('>')
    ? value.slice(1, -1)
    : value
}

const markdownImageUrlPattern =
  /!\[([^\]]*)\]\((<[^>\n]*>|[^)\s]+)(\s+(["'][^"']*["'])\s*)?\)/g

function encodeMarkdownPath(value: string): string {
  const normalized = value.replace(/\\/g, '/')
  const decoded = decodeSafely(normalized)
  const unwrapped = unwrapMarkdownPath(decoded)
  const escaped = unwrapped.replace(/#/g, '%23').replace(/\?/g, '%3F')
  if (/[\s<>()]/.test(escaped)) {
    return `<${escaped.replace(/</g, '%3C').replace(/>/g, '%3E')}>`
  }
  return escaped
}

function encodeMarkdownImagePaths(content: string): string {
  return content.replace(
    markdownImageUrlPattern,
    (match, alt, rawPath, titleGroup) => {
      if (
        rawPath.startsWith('http://') ||
        rawPath.startsWith('https://') ||
        rawPath.startsWith('file://') ||
        rawPath.startsWith('data:')
      ) {
        return match
      }
      return `![${alt}](${encodeMarkdownPath(rawPath)}${titleGroup ?? ''})`
    }
  )
}

export function toFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = encodePath(normalized)
  return normalized.startsWith('/')
    ? `file://${encoded}`
    : `file:///${encoded}`
}

export function fileUrlToPath(fileUrl: string): string {
  const path = fileUrl.replace(/^file:\/\//i, '')
  const decoded = decodeURI(path)
  return /^\/[A-Za-z]:\//.test(decoded) ? decoded.slice(1) : decoded
}

export function resolveImagePaths(content: string, filePath?: string | null): string {
  if (!filePath) return content

  const fileDir = filePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
  return content.replace(
    markdownImageUrlPattern,
    (match, alt, rawPath, titleGroup) => {
      if (
        rawPath.startsWith('http://') ||
        rawPath.startsWith('https://') ||
        rawPath.startsWith('file://') ||
        rawPath.startsWith('data:')
      ) {
        return match
      }
      const path = unwrapMarkdownPath(rawPath)
      return `![${alt}](${toFileUrl(`${fileDir}/${decodeSafely(path)}`)}${titleGroup ?? ''})`
    }
  )
}

export function relativizeImagePaths(content: string, filePath?: string | null): string {
  if (!filePath) return content

  const fileDir = filePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
  const encodedDir = encodePath(fileDir)
  const prefix = fileDir.startsWith('/')
    ? `file://${encodedDir}/`
    : `file:///${encodedDir}/`
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const result = content.replace(
    new RegExp(`${escapedPrefix}([^)\\s]+)`, 'g'),
    (_match, rest: string) => encodeMarkdownPath(rest)
  )
  return encodeMarkdownImagePaths(result)
}
