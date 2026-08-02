import { ArrowLeft, Search } from 'lucide-react'
import {
  useEffect,
  useRef,
  type ReactElement
} from 'react'

interface GlobalSearchBarProps {
  query: string
  loading: boolean
  onQueryChange: (query: string) => void
  onSearch: (query: string) => void
  onBack: () => void
}

export function GlobalSearchBar({
  query,
  loading,
  onQueryChange,
  onSearch,
  onBack
}: GlobalSearchBarProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="global-search-bar">
      <button
        className="global-search-back"
        type="button"
        aria-label="返回文件列表"
        onClick={onBack}
      >
        <ArrowLeft size={15} />
      </button>
      <div className="global-search-field">
        <Search size={13} />
        <input
          ref={inputRef}
          value={query}
          placeholder="搜索项目内容"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSearch(query)
            }
            if (event.key === 'Escape') onBack()
          }}
        />
        {loading && <span className="global-search-loading-dot" />}
      </div>
    </div>
  )
}
