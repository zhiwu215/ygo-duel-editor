import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Answer } from '@shared/index'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import {
  usePileActionMenuStore,
  type PileActionMenuTarget
} from '../../stores/usePileActionMenuStore'
import { buildCardEngineActionMap } from '../../utils/cardMenuActions'
import { resolveCardName } from '../../utils/cardNames'
import { resolvePileActions, type PileActionEntry } from '../../utils/pileActions'
import { CardThumb } from '../ui/CardThumb'
import { cn } from '../../lib/utils'
import { X } from 'lucide-react'

type PileActionKind = 'activate' | 'spSummon' | 'summon' | 'set' | 'repos' | 'attack'

interface PileActionCategory {
  kind: PileActionKind
  label: string
  entries: PileActionEntry[]
}

interface EffectChoice {
  label: string
  answer: Answer
}

interface SelectionState {
  target: PileActionMenuTarget
  kind: PileActionKind
}

interface EffectsState {
  target: PileActionMenuTarget
  options: EffectChoice[]
}

const buttonClass = cn(
  'w-full h-[26px] px-2 flex items-center justify-center whitespace-nowrap overflow-hidden font-sans text-xs font-bold tracking-wider cursor-pointer select-none transition-colors border-b last:border-b-0',
  'bg-gradient-to-b from-[#e8e8e8] via-[#d6d6d6] to-[#bebebe] text-neutral-900 border-neutral-400/80',
  'hover:from-[#f5f5f5] hover:via-[#e6e6e6] hover:to-[#cecece]'
)

function selectionTitle(kind: PileActionKind): string {
  if (kind === 'activate') return '选择要发动的卡'
  if (kind === 'spSummon') return '选择要特殊召唤的卡'
  if (kind === 'summon') return '选择要召唤的卡'
  if (kind === 'set') return '选择要盖放的卡'
  if (kind === 'repos') return '选择要变更表示的卡'
  return '选择要攻击的卡'
}

export const PileActionMenu: React.FC = () => {
  const target = usePileActionMenuStore((s) => s.target)
  const closeMenu = usePileActionMenuStore((s) => s.closeMenu)
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const submitAnswer = useDuelEngineStore((s) => s.submitAnswer)
  const menuRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [effects, setEffects] = useState<EffectsState | null>(null)

  const entries = useMemo(
    () => (target ? resolvePileActions(pendingRequest, target.controller, target.location) : []),
    [pendingRequest, target]
  )

  const categories = useMemo<PileActionCategory[]>(() => {
    const result: PileActionCategory[] = []
    const add = (
      kind: PileActionKind,
      label: string,
      predicate: (entry: PileActionEntry) => boolean
    ): void => {
      const matched = entries.filter(predicate)
      if (matched.length > 0) result.push({ kind, label, entries: matched })
    }
    add(
      'activate',
      '发动',
      (entry) => Boolean(entry.actions.chain) || entry.actions.activate.length > 0
    )
    add('spSummon', '特殊召唤', (entry) => Boolean(entry.actions.spSummon))
    add('summon', '召唤', (entry) => Boolean(entry.actions.summon))
    add('set', '盖放', (entry) => Boolean(entry.actions.mset || entry.actions.sset))
    add('repos', '变更表示', (entry) => Boolean(entry.actions.repos))
    add('attack', '攻击', (entry) => Boolean(entry.actions.attack))
    return result
  }, [entries])

  const activeSelection = selection && selection.target === target ? selection : null
  const activeEffects = effects && effects.target === target ? effects : null
  const selectionCategory = activeSelection
    ? categories.find((category) => category.kind === activeSelection.kind)
    : null
  const cardChoices = selectionCategory?.entries ?? []

  useEffect(() => {
    if (!target) return
    const handlePointerDown = (event: PointerEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return
      closeMenu()
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [target, closeMenu])

  const entryOptions = (kind: PileActionKind, entry: PileActionEntry): EffectChoice[] => {
    const map = buildCardEngineActionMap(entry.actions, undefined)
    const result: EffectChoice[] = []
    if (kind === 'activate') {
      if (map.chain) result.push({ label: '发动', answer: map.chain.answer })
      for (const spec of map.activate) result.push({ label: spec.label, answer: spec.answer })
    } else if (kind === 'spSummon' && map.spSummon) {
      result.push({ label: '特殊召唤', answer: map.spSummon.answer })
    } else if (kind === 'summon' && map.summon) {
      result.push({ label: '召唤', answer: map.summon.answer })
    } else if (kind === 'set' && map.set) {
      result.push({ label: map.set.label, answer: map.set.answer })
    } else if (kind === 'repos' && map.repos) {
      result.push({ label: map.repos.label, answer: map.repos.answer })
    } else if (kind === 'attack' && map.attack) {
      result.push({ label: '攻击', answer: map.attack.answer })
    }
    return result
  }

  const submitEntry = (
    kind: PileActionKind,
    entry: PileActionEntry,
    current: PileActionMenuTarget
  ): void => {
    const options = entryOptions(kind, entry)
    if (options.length === 0) return
    if (options.length > 1) {
      setSelection(null)
      setEffects({ target: current, options })
      return
    }
    setSelection(null)
    setEffects(null)
    submitAnswer(options[0].answer)
    closeMenu()
  }

  const handleCategory = (category: PileActionCategory, current: PileActionMenuTarget): void => {
    if (category.entries.length === 1) {
      submitEntry(category.kind, category.entries[0], current)
      return
    }
    setEffects(null)
    setSelection({ target: current, kind: category.kind })
  }

  const menuMode: 'top' | 'cards' | 'effects' = activeSelection
    ? 'cards'
    : activeEffects
      ? 'effects'
      : 'top'

  const itemCount =
    menuMode === 'cards'
      ? cardChoices.length
      : menuMode === 'effects'
        ? (activeEffects?.options.length ?? 0)
        : categories.length

  if (!target || itemCount === 0) return null

  if (menuMode === 'cards' && selectionCategory && activeSelection) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        onClick={closeMenu}
      >
        <div
          ref={menuRef}
          className="flex max-h-[86vh] w-fit max-w-[92vw] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-8 border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold tracking-tight">
              {selectionTitle(activeSelection.kind)}
            </h2>
            <button
              type="button"
              onClick={closeMenu}
              className="p-1 rounded cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 overflow-y-auto p-4">
            {selectionCategory.entries.map((entry) => (
              <button
                key={`${entry.card.code}:${entry.card.sequence}`}
                type="button"
                onClick={() => submitEntry(selectionCategory.kind, entry, activeSelection.target)}
                className="overflow-hidden rounded ring-1 ring-border hover:ring-2 hover:ring-blue-400 transition-all"
              >
                <CardThumb
                  code={entry.card.code}
                  name={resolveCardName(entry.card.code)}
                  showName={false}
                  className="h-[170px] w-[120px]"
                  imageClassName="pointer-events-none"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const menuWidth = 96
  const menuHeight = Math.min(320, itemCount * 26)
  const x = Math.min(
    Math.max(8, target.anchorRect.left + target.anchorRect.width / 2 - menuWidth / 2),
    window.innerWidth - menuWidth - 8
  )
  const y = Math.min(
    Math.max(8, target.anchorRect.top + target.anchorRect.height / 2 - menuHeight / 2),
    window.innerHeight - menuHeight - 8
  )

  return (
    <div
      ref={menuRef}
      style={{ left: `${x}px`, top: `${y}px`, width: `${menuWidth}px` }}
      className="fixed z-50 flex flex-col rounded-sm border border-neutral-500/80 shadow-2xl overflow-y-auto bg-neutral-900/95"
      onClick={(event) => event.stopPropagation()}
    >
      {menuMode === 'top' &&
        categories.map((category) => (
          <button
            key={category.kind}
            type="button"
            onClick={() => handleCategory(category, target)}
            className={buttonClass}
          >
            {category.label}
          </button>
        ))}

      {menuMode === 'effects' && activeEffects
        ? activeEffects.options.map((option, index) => (
            <button
              key={`${option.label}-${index}`}
              type="button"
              onClick={() => {
                submitAnswer(option.answer)
                closeMenu()
              }}
              className={buttonClass}
            >
              {option.label}
            </button>
          ))
        : null}
    </div>
  )
}
