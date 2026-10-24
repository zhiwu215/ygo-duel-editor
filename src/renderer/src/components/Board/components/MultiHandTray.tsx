import React, { useLayoutEffect, useRef, useState } from 'react'
import { Duelist, FieldCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { resolveViewerDuelist, turnOrderOf } from '../../../utils/duelistNames'
import { DuelistHandStrip } from './DuelistHandStrip'
import { EditableNameChip } from './EditableNameChip'
import { LpInput } from './LpInput'
import { useHorizontalWheelScroll } from '../../../hooks/useHorizontalWheelScroll'
import { useLpCommit } from '../../../hooks/useLpCommit'
import { cn } from '../../../lib/utils'

export const MultiHandTray: React.FC<{
  duelists: Duelist[]
  controller: 0 | 1
  isTop: boolean
  teamHandCards: FieldCard[]
  totalCount: number
}> = ({ duelists, controller, isTop, teamHandCards, totalCount }) => {
  const sharedLp = useDuelStore((s) => s.state.matchConfig?.sharedLp)
  const isTagMode = useDuelStore((s) => s.state.matchConfig?.mode === 'tag')
  const teamLp = useDuelStore((s) => s.state.players[controller]?.lp)
  const expandedDuelistId = useDuelStore((s) => s.expandedDuelistId)
  const setExpandedDuelistId = useDuelStore((s) => s.setExpandedDuelistId)
  const toggleSharedLp = useDuelStore((s) => s.toggleSharedLp)
  const setPlayerLp = useDuelStore((s) => s.setPlayerLp)
  const activeDuelistIds = useDuelStore((s) => s.activeDuelistIds)
  const currentTurn = useDuelStore((s) => s.currentTurn)
  const focusDuelist = useDuelStore((s) => s.focusDuelist)
  const selectedDuelist = resolveViewerDuelist(
    duelists,
    controller,
    activeDuelistIds[controller],
    currentTurn
  )
  const updateDuelist = useDuelStore((s) => s.updateDuelist)
  const orderedDuelists = [...duelists].sort((a, b) => turnOrderOf(a) - turnOrderOf(b))
  const rowScrollRef = useRef<HTMLDivElement>(null)
  const commitLp = useLpCommit()

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState<string>('')

  const [isCrowded, setIsCrowded] = useState(false)
  useLayoutEffect(() => {
    const el = rowScrollRef.current
    if (!el) return
    const measure = (): void => {
      setIsCrowded(el.scrollWidth > el.clientWidth + 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [duelists.length])

  const commitRename = (): void => {
    if (!renamingId) return
    const trimmed = renameDraft.trim()
    if (trimmed) updateDuelist(renamingId, { name: trimmed })
    setRenamingId(null)
  }

  const stripRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollStripIntoView = (duelistId: string): void => {
    const row = rowScrollRef.current
    const strip = stripRefs.current.get(duelistId)
    if (!row || !strip) return
    const target = strip.offsetLeft - row.offsetLeft
    const maxScroll = row.scrollWidth - row.clientWidth
    if (maxScroll <= 0) return
    const clamped = Math.max(0, Math.min(target, maxScroll))
    if (row.scrollLeft === clamped) return
    row.scrollTo({ left: clamped, behavior: 'smooth' })
  }

  useHorizontalWheelScroll(rowScrollRef, { skipWhenNoOverflow: true })

  const activeExpandedDuelist = duelists.find((d) => d.id === expandedDuelistId)
  const isSharedLp = Boolean(sharedLp)

  return (
    <div className="relative z-10 w-full max-w-5xl shrink-0 p-1.5 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs px-1 h-5">
        {orderedDuelists.map((d) => (
          <EditableNameChip
            key={d.id}
            editing={renamingId === d.id}
            draft={renameDraft}
            onDraftChange={setRenameDraft}
            onCommit={commitRename}
            onCancel={() => setRenamingId(null)}
            inputClassName="h-[18px] w-20 px-1 text-[10px] rounded border border-primary bg-background outline-none"
          >
            <button
              type="button"
              onClick={() => {
                focusDuelist(d.id)
                scrollStripIntoView(d.id)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setRenamingId(d.id)
                setRenameDraft(d.name)
              }}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border',
                isTop ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400',
                selectedDuelist?.id === d.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 border-border hover:bg-muted'
              )}
            >
              {d.name}
            </button>
          </EditableNameChip>
        ))}

        <span className="text-[11px] text-muted-foreground font-mono ml-1">
          共 {teamHandCards.length} 张
        </span>

        {!isTagMode && (
          <button
            type="button"
            onClick={toggleSharedLp}
            className={cn(
              'ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border',
              isSharedLp
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {isSharedLp ? '✓ 队伍共用 LP' : '独立 LP'}
          </button>
        )}

        {isSharedLp && (
          <LpInput
            lp={teamLp ?? duelists[0]?.lp ?? 8000}
            label="队伍 LP"
            size="sm"
            player={controller}
            popoverPlacement={isTop ? 'bottom' : 'top'}
            onLpChange={(newLp) => commitLp(controller, newLp, (lp) => setPlayerLp(controller, lp))}
          />
        )}
      </div>

      <div
        ref={rowScrollRef}
        className="w-full flex items-center gap-1.5 overflow-x-auto overflow-y-hidden select-none"
      >
        {orderedDuelists.map((duelist) => {
          const duelistCards = teamHandCards.filter((c) => {
            if (c.duelistId) return c.duelistId === duelist.id
            return duelist.id === duelists[0].id
          })

          const isExpanded = activeExpandedDuelist?.id === duelist.id
          const isCollapsed = Boolean(
            activeExpandedDuelist && activeExpandedDuelist.id !== duelist.id
          )

          return (
            <DuelistHandStrip
              key={duelist.id}
              duelist={duelist}
              controller={controller}
              isTop={isTop}
              cards={duelistCards}
              totalCount={totalCount}
              isExpanded={isExpanded}
              isCollapsed={isCollapsed}
              crowded={isCrowded}
              ref={(el) => {
                if (el) stripRefs.current.set(duelist.id, el)
                else stripRefs.current.delete(duelist.id)
              }}
              onExpand={() => setExpandedDuelistId(duelist.id)}
              onCollapse={() => setExpandedDuelistId(null)}
            />
          )
        })}
      </div>
    </div>
  )
}
