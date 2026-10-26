import React, { useState, useEffect, useRef } from 'react'
import { FieldCard, CardUtils, CardLocation } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import {
  buildCounterCandidates,
  findCounterDefinitionByName,
  listActiveCounters,
  matchCounterDefinitions,
  pickSelectedCounter
} from '../../../utils/counterDeduce'
import { getEffectiveStats } from '../../../utils/cardStats'
import { useDraggablePanel } from '../../../hooks/useDraggablePanel'
import { resolveCardName } from '../../../utils/cardNames'
import { Button } from '../../ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '../../ui/select'
import { Plus, Minus, Trash2, X, Pencil, Swords, Shield, GripHorizontal } from 'lucide-react'
import { useTokenStore } from '../../../stores/useTokenStore'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { cn } from '../../../lib/utils'
import { CalculatorInput } from './CalculatorInput'
import { TokenSuggestSection } from './TokenSuggestSection'

const StatCalculatorRow: React.FC<{
  label: 'ATK' | 'DEF'
  icon: React.ReactNode
  value: number
  origVal: number
  isModified: boolean
  isInf: boolean
  diff: number
  onCommit: (val: number | undefined) => void
}> = ({ label, icon, value, origVal, isModified, isInf, diff, onCommit }) => (
  <div className="relative flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30 border border-border/50">
    <div className="flex items-center gap-1.5 min-w-0 mr-2">
      {icon}
      <span className="font-bold text-xs tracking-wider">{label}</span>
      {isModified && (
        <span
          className={cn(
            'text-[10px] font-mono font-bold px-1 rounded truncate',
            isInf || diff > 0
              ? 'text-emerald-500 bg-emerald-500/10'
              : 'text-rose-500 bg-rose-500/10'
          )}
        >
          {isInf ? '+无限' : diff > 0 ? `+${diff}` : diff}
        </span>
      )}
    </div>
    <div className="flex items-center gap-1.5 relative shrink-0">
      <CalculatorInput
        unit={label}
        value={value}
        origVal={origVal}
        isModified={isModified}
        onCommit={onCommit}
      />
    </div>
  </div>
)

export const CardStatPopover: React.FC = () => {
  const {
    state,
    activeStatPopoverCardId,
    statPopoverPosition,
    setStatPopoverPosition,
    closeStatPopover,
    setCardCustomStats,
    setCardCounter,
    removeCardCounter,
    registerCustomCounter
  } = useDuelStore()

  const card: FieldCard | undefined = state.cards.find(
    (c) => c.instanceId === activeStatPopoverCardId
  )

  const pos = statPopoverPosition || {
    x: Math.max(16, window.innerWidth / 2 + 100),
    y: Math.max(16, window.innerHeight / 2 - 150)
  }

  const { panelRef, handleHeaderMouseDown } = useDraggablePanel({
    position: pos,
    onPositionChange: setStatPopoverPosition,
    bounds: { min: 12, right: 260, bottom: 380 }
  })

  const [userSelectedCounterId, setUserSelectedCounterId] = useState<number | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customText, setCustomText] = useState('')
  const [customSuggestOpen, setCustomSuggestOpen] = useState(false)
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showCustomInput) customInputRef.current?.focus()
  }, [showCustomInput])

  const cancelPendingToken = useTokenStore((s) => s.cancelPending)
  const loadTokenCatalog = useTokenStore((s) => s.loadCatalog)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)

  useEffect(() => {
    if (!isEngineActive) void loadTokenCatalog()
  }, [isEngineActive, loadTokenCatalog])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (useTokenStore.getState().pending) cancelPendingToken()
        else closeStatPopover()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeStatPopover, cancelPendingToken])

  if (!activeStatPopoverCardId || !card) return null
  const isValidZone =
    card.location === CardLocation.MZONE ||
    card.location === CardLocation.SZONE ||
    card.location === CardLocation.FZONE ||
    card.location === CardLocation.PZONE
  if (!isValidZone) return null

  const cdb = card.card
  const isMonster = cdb ? CardUtils.isMonster(cdb.type) : card.location === CardLocation.MZONE
  const isLink = cdb ? CardUtils.isLink(cdb.type) : false
  const cardName = resolveCardName(card.code)

  const stats = getEffectiveStats(card)
  const customCounters = state.customCounters || {}
  const counterCandidates = buildCounterCandidates(state, card)
  const { id: selectedCounterId, name: currentSelectedName } = pickSelectedCounter(
    counterCandidates,
    userSelectedCounterId,
    customCounters
  )
  const activeCounters = listActiveCounters(card, customCounters)

  const handleAddCounterById = (id: number | null): void => {
    if (id === null) return
    const current = (card.counters && card.counters[id]) || 0
    setCardCounter(card.instanceId, id, current + 1)
  }

  const customQuery = customText.trim()
  const customMatches = customSuggestOpen ? matchCounterDefinitions(customQuery) : []

  const handleAddCustom = (): void => {
    const name = customQuery
    if (!name) return
    const exact = findCounterDefinitionByName(name)
    const id = exact ? exact.id : registerCustomCounter(name)
    handleAddCounterById(id)
    setUserSelectedCounterId(id)
    setCustomText('')
    setCustomSuggestOpen(false)
  }

  return (
    <div
      ref={panelRef}
      draggable={false}
      onDragStart={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`
      }}
      className={cn(
        'fixed z-[55] w-[264px] bg-card/95 text-card-foreground border border-border/90 rounded-xl shadow-2xl backdrop-blur-md p-3 flex flex-col gap-2.5 text-xs select-none animate-in fade-in zoom-in-95 duration-75 will-change-transform'
      )}
    >
      <div
        onMouseDown={handleHeaderMouseDown}
        className="flex items-center justify-between border-b border-border/60 pb-1.5 cursor-grab active:cursor-grabbing group/header"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/header:text-primary transition-colors shrink-0" />
          <span className="font-bold text-xs truncate">{cardName}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            cancelPendingToken()
            closeStatPopover()
          }}
          className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isMonster && (
        <div className="flex flex-col gap-1.5">
          <StatCalculatorRow
            label="ATK"
            icon={<Swords className="w-3 h-3 text-rose-500 shrink-0" />}
            value={stats.atk}
            origVal={stats.origAtk}
            isModified={card.customAtk !== undefined}
            isInf={stats.isAtkInf}
            diff={stats.atkDiff}
            onCommit={(val) =>
              setCardCustomStats(
                card.instanceId,
                val === stats.origAtk ? undefined : val,
                card.customDef
              )
            }
          />

          {!isLink && (
            <StatCalculatorRow
              label="DEF"
              icon={<Shield className="w-3 h-3 text-blue-500 shrink-0" />}
              value={stats.def}
              origVal={stats.origDef}
              isModified={card.customDef !== undefined}
              isInf={stats.isDefInf}
              diff={stats.defDiff}
              onCommit={(val) =>
                setCardCustomStats(
                  card.instanceId,
                  card.customAtk,
                  val === stats.origDef ? undefined : val
                )
              }
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] text-foreground/90">
            <span>当前指示物</span>
          </span>
        </div>

        {activeCounters.length > 0 ? (
          <div className="flex flex-col gap-1">
            {activeCounters.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-1 rounded bg-muted/40 border border-border/50"
              >
                <span className="font-semibold text-xs text-foreground truncate max-w-[110px]">
                  {item.name}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => setCardCounter(card.instanceId, item.id, item.count - 1)}
                    className="h-5 w-5"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </Button>

                  <span className="font-mono font-bold text-xs min-w-[20px] text-center text-amber-500 dark:text-amber-400">
                    {item.count}
                  </span>

                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => setCardCounter(card.instanceId, item.id, item.count + 1)}
                    className="h-5 w-5"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeCardCounter(card.instanceId, item.id)}
                    className="h-5 w-5 text-muted-foreground hover:text-destructive ml-0.5"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/70 py-0.5 italic">暂无放置指示物</div>
        )}

        <div className="flex items-center gap-1.5 mt-1">
          {counterCandidates.length > 1 ? (
            <Select
              value={String(selectedCounterId)}
              onValueChange={(val) => val && setUserSelectedCounterId(Number(val))}
            >
              <SelectTrigger size="sm" className="h-6 text-xs flex-1 bg-background">
                <SelectValue>{currentSelectedName}</SelectValue>
              </SelectTrigger>
              <SelectContent positionerClassName="z-[60]" className="max-h-[200px]">
                <SelectGroup>
                  <SelectLabel className="text-[10px] text-muted-foreground font-bold">
                    可选指示物
                  </SelectLabel>
                  {counterCandidates.map((c) => (
                    <SelectItem key={`counter_${c.id}`} value={String(c.id)} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : counterCandidates.length === 1 ? (
            <div className="h-6 flex-1 px-2 flex items-center rounded border border-border/60 bg-muted/40 text-[11px] font-medium text-foreground/90 truncate">
              {counterCandidates[0].name}
            </div>
          ) : (
            <div className="h-6 flex-1 px-2 flex items-center rounded border border-border/50 bg-muted/40 text-[11px] text-muted-foreground italic select-none">
              暂无可添加指示物
            </div>
          )}

          <Button
            variant="secondary"
            size="xs"
            disabled={selectedCounterId === null}
            onClick={() => {
              if (selectedCounterId !== null) {
                handleAddCounterById(selectedCounterId)
                setUserSelectedCounterId(null)
              }
            }}
            className="h-6 px-2 text-[11px] font-semibold gap-1 shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span>添加</span>
          </Button>

          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => setShowCustomInput((v) => !v)}
            className="h-6 w-6 shrink-0"
          >
            <Pencil className="w-3 h-3" />
          </Button>
        </div>

        {showCustomInput && (
          <div className="flex flex-col gap-1 p-1.5 rounded border border-border/60 bg-muted/30">
            <div className="flex items-center gap-1.5">
              <input
                ref={customInputRef}
                type="text"
                value={customText}
                placeholder="输入指示物名称"
                onChange={(e) => {
                  setCustomText(e.target.value)
                  setCustomSuggestOpen(e.target.value.trim().length > 0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustom()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setShowCustomInput(false)
                    setCustomText('')
                    setCustomSuggestOpen(false)
                  }
                }}
                className="flex-1 h-6 rounded border border-border/70 bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
              <Button
                variant="secondary"
                size="xs"
                disabled={!customText.trim()}
                onClick={handleAddCustom}
                className="h-6 px-2 text-[11px] font-semibold shrink-0"
              >
                添加
              </Button>
            </div>

            {customSuggestOpen && customMatches.length > 0 && (
              <div className="max-h-[128px] overflow-y-auto rounded border border-border/60 bg-popover">
                {customMatches.map((def) => (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => {
                      handleAddCounterById(def.id)
                      setCustomText('')
                      setCustomSuggestOpen(false)
                    }}
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] text-left hover:bg-muted transition-colors"
                  >
                    <span className="truncate text-foreground/90">{def.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0 ml-2">
                      {def.hex}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {customSuggestOpen && customText.trim() && customMatches.length === 0 && (
              <div className="text-[10px] text-muted-foreground/70 px-1 leading-tight">
                回车将作为自定义指示物创建
              </div>
            )}
          </div>
        )}
      </div>

      {!isEngineActive && <TokenSuggestSection sourceCard={cdb} />}
    </div>
  )
}
