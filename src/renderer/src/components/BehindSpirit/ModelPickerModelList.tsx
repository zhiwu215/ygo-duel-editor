import type { JSX, RefObject } from 'react'
import { Check, X } from 'lucide-react'
import type { AgentProviderModelConfig } from '@shared/index'
import {
  PICKER_EMPTY,
  PICKER_HEADING,
  PICKER_OPTION,
  PICKER_SEARCH,
  PICKER_SEARCH_CLEAR
} from './modelPickerStyles'

export interface ModelPickerGroup {
  id: string
  name: string
  models: AgentProviderModelConfig[]
}

interface ModelPickerModelListProps {
  groups: ModelPickerGroup[]
  total: number
  showSearch: boolean
  query: string
  onQueryChange: (value: string) => void
  activeProviderId?: string
  activeModelId: string
  activeIndex: number
  onHighlight: (index: number) => void
  onHover: (index: number, node: HTMLButtonElement) => void
  onPick: (providerId: string, modelId: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  listId: string
  optionIdPrefix: string
}

export function ModelPickerModelList({
  groups,
  total,
  showSearch,
  query,
  onQueryChange,
  activeProviderId,
  activeModelId,
  activeIndex,
  onHighlight,
  onHover,
  onPick,
  searchRef,
  listId,
  optionIdPrefix
}: ModelPickerModelListProps): JSX.Element {
  let index = 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showSearch && (
        <div className="relative mx-0.5 my-0.5 flex-none">
          <input
            ref={searchRef}
            type="text"
            role="searchbox"
            aria-label="搜索模型…"
            aria-controls={listId}
            aria-activedescendant={
              activeIndex >= 0 ? `${optionIdPrefix}-model-${activeIndex}` : undefined
            }
            placeholder="搜索模型…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className={PICKER_SEARCH}
          />
          {query !== '' && (
            <button
              type="button"
              aria-label="清除搜索"
              className={PICKER_SEARCH_CLEAR}
              onClick={() => {
                onQueryChange('')
                searchRef.current?.focus()
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <div className={PICKER_EMPTY} role="status">
          {total === 0 ? '暂无可用模型' : '没有匹配的模型。'}
        </div>
      ) : (
        <div
          id={listId}
          role="menu"
          aria-label="模型"
          className="min-h-0 flex-1 overflow-y-auto py-0.5"
        >
          {groups.map((group) => (
            <div key={group.id} role="group" aria-label={group.name}>
              <div className={PICKER_HEADING}>{group.name}</div>
              {group.models.map((model) => {
                const at = index++
                const selected = activeProviderId === group.id && activeModelId === model.id
                return (
                  <button
                    key={`${group.id}:${model.id}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    id={`${optionIdPrefix}-model-${at}`}
                    tabIndex={showSearch ? -1 : 0}
                    data-highlighted={at === activeIndex ? '' : undefined}
                    onFocus={() => onHighlight(at)}
                    onMouseMove={(event) => {
                      if (at === activeIndex) return
                      onHover(at, event.currentTarget)
                    }}
                    onClick={() => onPick(group.id, model.id)}
                    title={model.name ?? model.id}
                    className={PICKER_OPTION}
                  >
                    <span className="min-w-0 flex-1 truncate">{model.name ?? model.id}</span>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
