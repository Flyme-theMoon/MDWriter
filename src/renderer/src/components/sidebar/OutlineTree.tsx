import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { OutlineHeading, OutlineNode } from '../../markdown/outline'

interface OutlineTreeProps {
  nodes: OutlineNode[]
  activeId: string | null
  onSelect: (heading: OutlineHeading) => void
}

interface OutlineBranchProps {
  node: OutlineNode
  depth: number
  activeId: string | null
  collapsedIds: Set<string>
  onToggle: (id: string) => void
  onSelect: (heading: OutlineHeading) => void
}

function OutlineBranch({
  node,
  depth,
  activeId,
  collapsedIds,
  onToggle,
  onSelect
}: OutlineBranchProps) {
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsedIds.has(node.id)

  return (
    <div className="outline-group">
      <div
        className={`outline-row${node.id === activeId ? ' active' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            className="outline-toggle"
            type="button"
            aria-label={isCollapsed ? '展开标题' : '收起标题'}
            onClick={() => onToggle(node.id)}
          >
            <ChevronDown
              className={isCollapsed ? 'collapsed' : ''}
              size={13}
            />
          </button>
        ) : (
          <span className="outline-toggle-spacer" />
        )}
        <button
          className="outline-target"
          type="button"
          onClick={() => onSelect(node)}
        >
          <span className="outline-text">{node.text}</span>
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="outline-children">
          {node.children.map((child) => (
            <OutlineBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function OutlineTree({ nodes, activeId, onSelect }: OutlineTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set()
  )

  const toggle = (id: string): void => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="outline-tree" role="tree" aria-label="当前文档目录">
      {nodes.length === 0 ? (
        <div className="outline-empty">暂无标题</div>
      ) : (
        nodes.map((node) => (
          <OutlineBranch
            key={node.id}
            node={node}
            depth={0}
            activeId={activeId}
            collapsedIds={collapsedIds}
            onToggle={toggle}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  )
}
