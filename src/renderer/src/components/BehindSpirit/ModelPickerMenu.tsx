import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type JSX,
  type KeyboardEvent
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  AGENT_REASONING_EFFORT_LABELS,
  AgentReasoningEffort,
  agentReasoningLevels,
  isProviderReady,
  resolveAgentReasoningEffort
} from '@shared/index'
import { useAgentStore } from '../../stores/useAgentStore'
import { cn } from '../../lib/utils'
import { rankModels } from '../../utils/rankModels'
import { ModelPickerEffortList } from './ModelPickerEffortList'
import { ModelPickerModelList, type ModelPickerGroup } from './ModelPickerModelList'
import { PICKER_CELL, PICKER_MENU } from './modelPickerStyles'

type Pane = 'root' | 'model' | 'effort'

const MENU_MARGIN = 12

const MENU_ITEM_SELECTOR =
  '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled])'

export function ModelPickerMenu(): JSX.Element {
  const config = useAgentStore((state) => state.config)
  const selectModel = useAgentStore((state) => state.selectModel)
  const setReasoningEffort = useAgentStore((state) => state.setReasoningEffort)

  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<Pane>('root')
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const paneFocus = useRef<'drill' | 'model' | 'effort' | null>(null)
  const previousShowSearch = useRef(false)
  const id = useId()

  const groups = useMemo<ModelPickerGroup[]>(
    () =>
      (config.providers ?? [])
        .filter((provider) => isProviderReady(provider))
        .map((provider) => ({
          id: provider.id,
          name: provider.name,
          models: provider.models
        }))
        .filter((group) => group.models.length > 0),
    [config.providers]
  )
  const total = groups.reduce((sum, group) => sum + group.models.length, 0)
  const showSearch = total > 4
  const effectiveQuery = showSearch ? query : ''
  const activeGroup = groups.find((group) => group.id === config.provider)
  const activeModel = activeGroup?.models.find((model) => model.id === config.model) ?? null
  const effortLevels = agentReasoningLevels(activeModel?.reasoningEfforts)
  const currentEffort = resolveAgentReasoningEffort(
    activeModel?.reasoningEfforts,
    config.reasoningEffort
  )
  const modelLabel = activeModel?.name ?? activeModel?.id ?? ''
  const effortLabel =
    effortLevels.length > 0 && currentEffort
      ? AGENT_REASONING_EFFORT_LABELS[currentEffort]
      : undefined
  const triggerAria = activeModel
    ? effortLabel
      ? `选择模型，当前 ${modelLabel}，推理等级 ${effortLabel}`
      : `选择模型，当前 ${modelLabel}`
    : '请选择模型'

  const filteredGroups = useMemo<ModelPickerGroup[]>(() => {
    const trimmed = effectiveQuery.trim()
    if (!showSearch || trimmed.length === 0) return groups
    return groups
      .map((group) => ({
        ...group,
        models: [
          ...rankModels(group.models, trimmed, (model) => [model.name ?? model.id, model.id])
        ]
      }))
      .filter((group) => group.models.length > 0)
  }, [groups, effectiveQuery, showSearch])

  const visibleModels = useMemo(
    () =>
      filteredGroups.flatMap((group) =>
        group.models.map((model) => ({ providerId: group.id, modelId: model.id }))
      ),
    [filteredGroups]
  )
  const currentVisibleIndex = visibleModels.findIndex(
    (model) => model.providerId === config.provider && model.modelId === config.model
  )
  const activeIndex =
    visibleModels.length === 0
      ? -1
      : Math.min(highlightedIndex ?? Math.max(0, currentVisibleIndex), visibleModels.length - 1)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
      setPane('root')
      setQuery('')
      setHighlightedIndex(null)
      setMenuPos(null)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [open])

  useLayoutEffect(() => {
    const changedSearchMode = previousShowSearch.current !== showSearch
    previousShowSearch.current = showSearch
    const intent = paneFocus.current ?? (changedSearchMode && pane === 'model' ? 'drill' : null)
    paneFocus.current = null
    if (!open || intent === null) return
    if (intent === 'drill') {
      if (pane === 'model' && showSearch) {
        searchRef.current?.focus()
        return
      }
      const checked = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitemradio"][aria-checked="true"]:not([disabled])'
      )
      const first = menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR)
      ;(checked ?? first)?.focus()
      return
    }
    const cells = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
    const cell = cells?.[intent === 'effort' ? 1 : 0]
    cell?.focus()
  }, [open, pane, showSearch])

  useLayoutEffect(() => {
    if (!open || pane !== 'model' || activeIndex < 0) return
    const active = document.getElementById(`${id}-model-${activeIndex}`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [open, pane, activeIndex, filteredGroups, id])

  useLayoutEffect(() => {
    if (!open) return
    const place = (): void => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      if (!trigger) return
      const width = menuRef.current?.offsetWidth ?? 0
      const height = menuRef.current?.offsetHeight ?? 0
      const left = Math.min(
        Math.max(MENU_MARGIN, trigger.right - width),
        window.innerWidth - width - MENU_MARGIN
      )
      const top = Math.min(
        Math.max(MENU_MARGIN, trigger.top - 8 - height),
        window.innerHeight - height - MENU_MARGIN
      )
      setMenuPos({ left, top })
    }
    place()
    const observer =
      typeof ResizeObserver !== 'undefined' && menuRef.current ? new ResizeObserver(place) : null
    if (menuRef.current) observer?.observe(menuRef.current)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, pane, filteredGroups, showSearch])

  const close = (restoreFocus = false): void => {
    setOpen(false)
    setPane('root')
    setQuery('')
    setHighlightedIndex(null)
    setMenuPos(null)
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus())
  }

  const openMenu = (): void => {
    setQuery('')
    setHighlightedIndex(null)
    setMenuPos(null)
    paneFocus.current = activeModel ? null : 'drill'
    setPane(activeModel ? 'root' : 'model')
    setOpen(true)
  }

  const closeAfterSelection = (): void => {
    close(true)
  }

  const drill = (next: Pane): void => {
    setQuery('')
    setHighlightedIndex(null)
    paneFocus.current = 'drill'
    setPane(next)
  }

  const back = (from: Exclude<Pane, 'root'>): void => {
    paneFocus.current = from
    setPane('root')
  }

  const moveFocus = (offset: number): void => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []
    )
    if (items.length === 0) return
    const active = items.findIndex((item) => item === document.activeElement)
    const next =
      active === -1
        ? offset > 0
          ? 0
          : items.length - 1
        : (active + offset + items.length) % items.length
    items[next]?.focus()
  }

  const pickModel = (providerId: string, modelId: string): void => {
    if (providerId === config.provider && modelId === config.model) {
      closeAfterSelection()
      return
    }
    selectModel(providerId, modelId)
    closeAfterSelection()
  }

  const pickEffort = (effort: AgentReasoningEffort): void => {
    if (effort === currentEffort) {
      closeAfterSelection()
      return
    }
    setReasoningEffort(effort)
    closeAfterSelection()
  }

  const changeQuery = (next: string): void => {
    setQuery(next)
    setHighlightedIndex(0)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      if (pane !== 'root' && activeModel) back(pane)
      else close(true)
      return
    }
    if (!open) return

    if (pane === 'model' && showSearch && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      if (visibleModels.length > 0) {
        const direction = event.key === 'ArrowDown' ? 1 : -1
        setHighlightedIndex((activeIndex + direction + visibleModels.length) % visibleModels.length)
        searchRef.current?.focus()
      }
      return
    }

    if (
      pane === 'model' &&
      showSearch &&
      event.target instanceof HTMLInputElement &&
      (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey))
    ) {
      if (event.key === 'Tab' && visibleModels.length === 0) return
      event.preventDefault()
      const highlighted = visibleModels[activeIndex]
      if (highlighted) pickModel(highlighted.providerId, highlighted.modelId)
      return
    }

    if (event.key === 'Tab') {
      if (event.shiftKey) {
        event.preventDefault()
        if (pane !== 'root' && activeModel) back(pane)
        else close(true)
        return
      }
      const focused = document.activeElement
      const rows = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []
      )
      if (focused instanceof HTMLElement && rows.includes(focused)) {
        event.preventDefault()
        focused.click()
        return
      }
      if (focused !== triggerRef.current) return
      event.preventDefault()
      if (pane === 'model' && showSearch) {
        setHighlightedIndex(null)
        searchRef.current?.focus()
        return
      }
      const checked = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitemradio"][aria-checked="true"]:not([disabled])'
      )
      ;(checked ?? rows.find((item) => !item.hasAttribute('disabled')))?.focus()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(event.key === 'ArrowDown' ? 1 : -1)
    }
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget
    if (
      next instanceof Node &&
      (rootRef.current?.contains(next) || menuRef.current?.contains(next))
    ) {
      return
    }
    close()
  }

  const hoverOption = (index: number, node: HTMLButtonElement): void => {
    if (showSearch) setHighlightedIndex(index)
    else node.focus()
  }

  return (
    <div ref={rootRef} className="relative min-w-0" onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(true) : openMenu())}
        aria-label={triggerAria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        className="flex h-7 max-w-[220px] min-w-0 items-center gap-1 rounded-[8px] px-1 pl-2 text-[13px] leading-5 font-normal text-[#61666b] transition-colors hover:bg-[rgba(38,49,72,0.06)] hover:text-[#0f1115] outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:text-[#cfd3d6] dark:hover:bg-[rgba(255,255,255,0.08)] dark:hover:text-[#f9fafb]"
      >
        <span className="min-w-0 truncate">{modelLabel || '请选择模型'}</span>
        {effortLabel && (
          <span className="min-w-0 shrink-[1000] truncate text-[13px] text-[#81858c] dark:text-[#979da6]">
            {effortLabel}
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-[#81858c] transition-transform dark:text-[#979da6]',
            open && 'rotate-180'
          )}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={`${id}-menu`}
            role={pane === 'model' ? 'group' : 'menu'}
            aria-label="模型与推理等级"
            style={{
              left: menuPos?.left ?? 0,
              top: menuPos?.top ?? 0,
              visibility: menuPos ? 'visible' : 'hidden'
            }}
            className={PICKER_MENU}
          >
            {pane === 'root' && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={PICKER_CELL}
                  onClick={() => drill('model')}
                >
                  <span className="shrink-0">模型</span>
                  <span className="min-w-0 flex-1 truncate text-right text-[#81858c] dark:text-[#979da6]">
                    {modelLabel || '未配置'}
                  </span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-[#81858c] dark:text-[#979da6]" />
                </button>
                {effortLevels.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className={PICKER_CELL}
                    onClick={() => drill('effort')}
                  >
                    <span className="shrink-0">推理等级</span>
                    <span className="min-w-0 flex-1 truncate text-right text-[#81858c] dark:text-[#979da6]">
                      {effortLabel}
                    </span>
                    <ChevronRight className="h-3 w-3 shrink-0 text-[#81858c] dark:text-[#979da6]" />
                  </button>
                )}
              </>
            )}

            {pane === 'model' && (
              <ModelPickerModelList
                groups={filteredGroups}
                total={total}
                showSearch={showSearch}
                query={effectiveQuery}
                onQueryChange={changeQuery}
                activeProviderId={config.provider}
                activeModelId={config.model}
                activeIndex={activeIndex}
                onHighlight={setHighlightedIndex}
                onHover={hoverOption}
                onPick={pickModel}
                searchRef={searchRef}
                listId={`${id}-models`}
                optionIdPrefix={id}
              />
            )}

            {pane === 'effort' && (
              <ModelPickerEffortList
                efforts={activeModel?.reasoningEfforts}
                value={currentEffort}
                onPick={pickEffort}
              />
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
