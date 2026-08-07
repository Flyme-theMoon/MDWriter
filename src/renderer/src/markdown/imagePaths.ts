// Keep Markdown portable: files store relative image paths, while rendering
// resolves them to file:// URLs for this app.

function encodePath(filePath: string): string {
  return encodeURI(filePath)
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function unwrapMarkdownPath(value: string): string {
  return value.startsWith('<') && value.endsWith('>')
    ? value.slice(1, -1)
    : value
}

function isAbsoluteLocalPath(value: string): boolean {
  const path = unwrapMarkdownPath(value)
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)
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
  // Convert a local filesystem path to an absolute file:// URL for the renderer.
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = encodePath(normalized)
  return normalized.startsWith('/')
    ? `file://${encoded}`
    : `file:///${encoded}`
}

export function fileUrlToPath(fileUrl: string): string {
  // Reverse file:// URLs, including Windows drive paths, back to local paths.
  const path = fileUrl.replace(/^file:\/\//i, '')
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    // Keep malformed file URLs as-is so image fallback can fail gracefully.
  }
  return /^\/[A-Za-z]:\//.test(decoded) ? decoded.slice(1) : decoded
}

export function resolveImagePaths(content: string, filePath?: string | null): string {
  // Resolve relative image paths against the current Markdown file.
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
      if (isAbsoluteLocalPath(rawPath)) {
        const path = decodeSafely(unwrapMarkdownPath(rawPath))
        return `![${alt}](${toFileUrl(path)}${titleGroup ?? ''})`
      }
      const path = unwrapMarkdownPath(rawPath)
      return `![${alt}](${toFileUrl(`${fileDir}/${decodeSafely(path)}`)}${titleGroup ?? ''})`
    }
  )
}

export function relativizeImagePaths(content: string, filePath?: string | null): string {
  // Normalize absolute local image URLs back to relative Markdown paths before saving.
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
