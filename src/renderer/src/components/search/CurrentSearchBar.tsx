import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import type { ReactElement, Ref } from 'react'

interface CurrentSearchBarProps {
  query: string
  matchIndex: number
  matchTotal: number
  inputRef: Ref<HTMLInputElement>
  onQueryChange: (query: string) => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

export function CurrentSearchBar({
  query,
  matchIndex,
  matchTotal,
  inputRef,
  onQueryChange,
  onPrev,
  onNext,
  onClose
}: CurrentSearchBarProps): ReactElement {
  return (
    <div className="current-search-bar" role="search" aria-label="当前文档搜索">
      <Search size={13} />
      <input
        ref={inputRef}
        value={query}
        placeholder="搜索当前文档"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (event.shiftKey) onPrev()
            else onNext()
          }
          if (event.key === 'Escape') onClose()
        }}
      />
      <span className="current-search-count">
        {matchTotal === 0 ? '0 / 0' : `${matchIndex + 1} / ${matchTotal}`}
      </span>
      <button
        className="current-search-button"
        type="button"
        aria-label="上一条"
        disabled={matchTotal === 0}
        onClick={onPrev}
      >
        <ChevronUp size={14} />
      </button>
      <button
        className="current-search-button"
        type="button"
        aria-label="下一条"
        disabled={matchTotal === 0}
        onClick={onNext}
      >
        <ChevronDown size={14} />
      </button>
      <button
        className="current-search-button"
        type="button"
        aria-label="关闭搜索"
        onClick={onClose}
      >
        <X size={14} />
      </button>
    </div>
  )
}
