import { FileText } from 'lucide-react'
import type { ReactElement } from 'react'
import type { GlobalSearchMatch } from '@shared/types/files'

interface GlobalSearchResultsProps {
  results: GlobalSearchMatch[]
  query: string
  onSelect: (match: GlobalSearchMatch) => void
}

function HighlightedSnippet({
  snippet,
  start,
  end
}: {
  snippet: string
  start: number
  end: number
}): ReactElement {
  const safeStart = Math.max(0, Math.min(start, snippet.length))
  const safeEnd = Math.max(safeStart, Math.min(end, snippet.length))

  return (
    <>
      {snippet.slice(0, safeStart)}
      <mark>{snippet.slice(safeStart, safeEnd)}</mark>
      {snippet.slice(safeEnd)}
    </>
  )
}

export function GlobalSearchResults({
  results,
  onSelect
}: GlobalSearchResultsProps): ReactElement {
  return (
    <div className="global-search-results">
      <div className="global-search-summary">{results.length} 个匹配</div>
      {results.map((result) => (
        <button
          className="global-search-result"
          key={`${result.path}:${result.line}:${result.start}`}
          type="button"
          onClick={() => onSelect(result)}
        >
          <span className="global-search-result-title">
            <FileText size={13} />
            <span>{result.name}</span>
            <span className="global-search-result-line">:{result.line}</span>
          </span>
          <span className="global-search-snippet">
            <HighlightedSnippet
              snippet={result.snippet}
              start={result.start}
              end={result.end}
            />
          </span>
        </button>
      ))}
    </div>
  )
}
