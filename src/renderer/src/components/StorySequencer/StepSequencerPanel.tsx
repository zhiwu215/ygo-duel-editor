import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useState } from 'react'
import {
  DuelStep,
  DuelPhase,
  DuelActionType,
  PHASE_NAMES,
  PHASE_SHORT_NAMES,
  ACTION_TYPE_NAMES,
  ACTION_TYPE_COLORS,
  CardLocation
} from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { confirmDialog } from '../../stores/useDialogStore'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  MessageSquare,
  BookOpen,
  Film,
  ArrowRight,
  Crosshair,
  Layers,
  X,
  RotateCcw,
  PlayCircle
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { StepGroupHeader, StepGroupKind } from './StepGroupHeader'

const ALL_PHASES: DuelPhase[] = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP']

const ALL_ACTIONS: DuelActionType[] = [
  'NORMAL_SUMMON',
  'SPECIAL_SUMMON',
  'ACTIVATE',
  'SET_SPELL_TRAP',
  'SET_MONSTER',
  'DRAW',
  'ATTACK',
  'TO_GRAVE',
  'BANISH',
  'TO_HAND',
  'CHANGE_POS',
  'DAMAGE',
  'CHAIN',
  'DIALOGUE'
]

const COMMONLY_USED_LOCATIONS: { loc: number; name: string }[] = [
  { loc: CardLocation.HAND, name: '手牌' },
  { loc: CardLocation.MZONE, name: '怪兽区' },
  { loc: CardLocation.SZONE, name: '魔陷区' },
  { loc: CardLocation.GRAVE, name: '墓地' },
  { loc: CardLocation.DECK, name: '主卡组' },
  { loc: CardLocation.EXTRA, name: '额外卡组' },
  { loc: CardLocation.REMOVED, name: '除外区' },
  { loc: CardLocation.FZONE, name: '场地魔法区' },
  { loc: CardLocation.PZONE, name: '灵摆区' }
]

function getLocationDisplayName(loc?: number, seq?: number): string {
  if (loc === undefined) return ''
  if (loc === CardLocation.MZONE && (seq === 5 || seq === 6)) {
    return `EX怪兽区${seq === 5 ? '1' : '2'}`
  }
  const match = COMMONLY_USED_LOCATIONS.find((l) => l.loc === loc)
  if (match) return match.name
  return '未知区域'
}

function getDamageValue(damage: DuelStep): number | null {
  if (damage.lpChange) return damage.lpChange.newLp - damage.lpChange.oldLp
  const description = damage.description?.trim()
  if (!description) return null

  const lpPair = description.match(/LP[^\d]*(-?\d+)\s*(?:→|->|=>)\s*(-?\d+)/i)
  if (lpPair) return Number(lpPair[2]) - Number(lpPair[1])

  const explicit = description.match(/(-?\d+)\s*(?:点|LP|生命值?|伤害)/i)
  if (explicit) return -Math.abs(Number(explicit[1]))

  const nearby = description.match(/(?:受到|造成|扣(?:除|减)?|损失|伤害)[^\d-]{0,8}(-?\d+)/)
  if (nearby) return -Math.abs(Number(nearby[1]))

  const fallback = description.match(/-?\d+/)
  return fallback ? -Math.abs(Number(fallback[0])) : null
}

function getAttackDamageText(attack: DuelStep, damage?: DuelStep): string | undefined {
  if (!damage) return undefined
  const value = getDamageValue(damage)
  if (value === null || value === 0) return undefined
  const targetPlayer = damage.lpChange?.player ?? (attack.actionPlayer === 0 ? 1 : 0)
  const targetName = targetPlayer === 0 ? '我方' : '对方'
  return value < 0 ? `${targetName}受到 -${Math.abs(value)}` : `${targetName}回复 +${value}`
}

interface StepSelectOption {
  value: string
  label: string
}

function StepSelect({
  value,
  onValueChange,
  options
}: {
  value: string
  onValueChange: (value: string | null) => void
  options: StepSelectOption[]
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-7 w-full bg-background font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface StepEntry {
  step: DuelStep
  index: number
}

interface StepGroup {
  kind: 'single' | StepGroupKind
  key: string
  entries: StepEntry[]
}

type StepListItem =
  | { kind: 'separator'; key: string; label: string; turnPlayer: 0 | 1 }
  | { kind: 'group'; group: StepGroup }

function buildGroups(entries: StepEntry[]): StepGroup[] {
  const groups: StepGroup[] = []
  let cursor = 0

  while (cursor < entries.length) {
    const current = entries[cursor]

    if ((current.step.chainIndex ?? 0) > 0) {
      let end = cursor + 1
      while (
        end < entries.length &&
        (entries[end].step.chainIndex ?? 0) > (entries[end - 1].step.chainIndex ?? 0)
      ) {
        end++
      }
      groups.push({
        kind: 'chain',
        key: current.step.id,
        entries: entries.slice(cursor, end)
      })
      cursor = end
      continue
    }

    const next = entries[cursor + 1]
    if (current.step.actionType === 'ATTACK' && next?.step.actionType === 'DAMAGE') {
      groups.push({
        kind: 'attack',
        key: current.step.id,
        entries: entries.slice(cursor, cursor + 2)
      })
      cursor += 2
      continue
    }

    if (
      current.step.actionType !== 'DIALOGUE' &&
      next &&
      next.step.actionType === current.step.actionType &&
      next.step.cardCode === current.step.cardCode
    ) {
      let end = cursor + 1
      while (
        end < entries.length &&
        entries[end].step.actionType === current.step.actionType &&
        entries[end].step.cardCode === current.step.cardCode
      ) {
        end++
      }
      groups.push({
        kind: 'repeat',
        key: current.step.id,
        entries: entries.slice(cursor, end)
      })
      cursor = end
      continue
    }

    groups.push({ kind: 'single', key: current.step.id, entries: [current] })
    cursor++
  }

  return groups
}

function buildStepList(steps: DuelStep[]): StepListItem[] {
  const items: StepListItem[] = []
  let lastGroupKey: string | null = null
  let pending: StepEntry[] = []

  const flush = (): void => {
    if (pending.length === 0) return
    const first = pending[0]
    const groupKey = `${first.step.turn}|${first.step.turnPlayer}|${first.step.phase}`
    const playerName = first.step.turnPlayer === 0 ? '我方' : '对方'
    const phaseName = PHASE_SHORT_NAMES[first.step.phase] || first.step.phase
    items.push({
      kind: 'separator',
      key: `separator_${first.index}_${groupKey}`,
      label: `第 ${first.step.turn} 回合 ${playerName} · ${phaseName}`,
      turnPlayer: first.step.turnPlayer
    })
    buildGroups(pending).forEach((group) => items.push({ kind: 'group', group }))
    pending = []
  }

  steps.forEach((step, index) => {
    const groupKey = `${step.turn}|${step.turnPlayer}|${step.phase}`
    if (groupKey !== lastGroupKey) {
      flush()
      lastGroupKey = groupKey
    }
    if (step.actionType !== 'PHASE_CHANGE' && step.actionType !== 'TURN_CHANGE') {
      pending.push({ step, index })
    }
  })

  flush()

  return items
}

export const StepSequencerPanel: React.FC = () => {
  const {
    state,
    currentStepIndex,
    currentTurn,
    currentPhase,
    currentChain,
    activeTurnPlayer,
    isAutoRecording,
    setCurrentPhase,
    resetChain,
    nextPhase,
    nextTurn,
    setActiveTurnPlayer,
    setIsAutoRecording,
    previewStepBoard,
    setHoveredInstanceId,
    addStep,
    updateStep,
    deleteStep,
    moveStep,
    clearSteps,
    hoveredCard,
    openScreenplayWithStep,
    previewReturn,
    exitPreview
  } = useDuelStore()

  const steps = state.steps || []
  const stepList = React.useMemo(() => buildStepList(steps), [steps])

  const previewIndex = currentStepIndex
  const previewStep = previewIndex !== null ? steps[previewIndex] : undefined
  const isPreviewing = previewReturn !== null && previewIndex !== null && Boolean(previewStep)

  const engineActive = useDuelEngineStore((s) => s.isInitialized)
  const engineTimeline = useDuelEngineStore((s) => s.timeline)
  const engineCurrentStepId = useDuelEngineStore((s) => s.currentStepId)
  const engineIndexById = React.useMemo(() => {
    const map = new Map<string, number>()
    engineTimeline.forEach((node, index) => map.set(node.id, index))
    return map
  }, [engineTimeline])
  const engineCursor = React.useMemo(() => {
    if (!engineActive || !engineCurrentStepId) return -1
    return engineIndexById.get(engineCurrentStepId) ?? -1
  }, [engineActive, engineCurrentStepId, engineIndexById])
  const futureStepCount = React.useMemo(() => {
    if (engineCursor < 0) return 0
    return stepList.reduce((count, item) => {
      if (item.kind !== 'group') return count
      return (
        count +
        item.group.entries.filter(({ step }) => {
          const stepIndex = step.actId ? engineIndexById.get(step.actId) : undefined
          return stepIndex !== undefined && stepIndex > engineCursor
        }).length
      )
    }, 0)
  }, [stepList, engineCursor, engineIndexById])

  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())

  const latestStep = steps[steps.length - 1]
  const [formTurn, setFormTurn] = useState<number>(latestStep?.turn || 1)
  const [formTurnPlayer, setFormTurnPlayer] = useState<0 | 1>(latestStep?.turnPlayer ?? 0)
  const [formPhase, setFormPhase] = useState<DuelPhase>(latestStep?.phase || 'M1')
  const [formActionPlayer, setFormActionPlayer] = useState<0 | 1>(latestStep?.actionPlayer ?? 0)
  const [formActionType, setFormActionType] = useState<DuelActionType>('NORMAL_SUMMON')
  const [formCardCode, setFormCardCode] = useState<string>(
    hoveredCard ? String(hoveredCard.id) : ''
  )
  const [formCardName, setFormCardName] = useState<string>(hoveredCard?.name || '')
  const [formFromLoc, setFormFromLoc] = useState<number>(CardLocation.HAND)
  const [formFromSeq, setFormFromSeq] = useState<number>(0)
  const [formToLoc, setFormToLoc] = useState<number>(CardLocation.MZONE)
  const [formToSeq, setFormToSeq] = useState<number>(2)
  const [formChain, setFormChain] = useState<number>(0)
  const [formDesc, setFormDesc] = useState<string>('')

  const handleOpenAdd = (): void => {
    setEditingStepId(null)
    const last = steps[steps.length - 1]
    if (last) {
      setFormTurn(last.turn)
      setFormTurnPlayer(last.turnPlayer)
      setFormPhase(last.phase)
      setFormActionPlayer(last.actionPlayer)
    } else {
      setFormTurn(1)
      setFormTurnPlayer(0)
      setFormPhase('M1')
      setFormActionPlayer(0)
    }

    if (hoveredCard) {
      setFormCardCode(String(hoveredCard.id))
      setFormCardName(hoveredCard.name)
    } else {
      setFormCardCode('')
      setFormCardName('')
    }
    setFormActionType('NORMAL_SUMMON')
    setFormFromLoc(CardLocation.HAND)
    setFormToLoc(CardLocation.MZONE)
    setFormChain(0)
    setFormDesc('')
    setShowAddModal(true)
  }

  const handleOpenEdit = (step: DuelStep): void => {
    setEditingStepId(step.id)
    setFormTurn(step.turn)
    setFormTurnPlayer(step.turnPlayer)
    setFormPhase(step.phase)
    setFormActionPlayer(step.actionPlayer)
    setFormActionType(step.actionType)
    setFormCardCode(step.cardCode ? String(step.cardCode) : '')
    setFormCardName(step.cardName || '')
    setFormFromLoc(step.fromLocation ?? CardLocation.HAND)
    setFormFromSeq(step.fromSequence ?? 0)
    setFormToLoc(step.toLocation ?? CardLocation.MZONE)
    setFormToSeq(step.toSequence ?? 0)
    setFormChain(step.chainIndex ?? 0)
    setFormDesc(step.description || '')
    setShowAddModal(true)
  }

  const handleSaveStep = (e: React.FormEvent): void => {
    e.preventDefault()
    const codeNum = parseInt(formCardCode, 10)
    const validCode = !isNaN(codeNum) && codeNum > 0 ? codeNum : undefined
    const existingStep = editingStepId ? steps.find((s) => s.id === editingStepId) : null

    const stepPayload = {
      turn: formTurn,
      turnPlayer: formTurnPlayer,
      phase: formPhase,
      actionPlayer: formActionPlayer,
      actionType: formActionType,
      cardCode: validCode,
      cardName: formCardName.trim() || undefined,
      fromLocation: formFromLoc,
      fromSequence: formFromSeq,
      toLocation: formToLoc,
      toSequence: formToSeq,
      chainIndex: formChain > 0 ? formChain : undefined,
      speaker: existingStep?.speaker,
      dialogue: existingStep?.dialogue,
      innerThoughts: existingStep?.innerThoughts,
      description: formDesc.trim() || existingStep?.description
    }

    if (editingStepId) {
      updateStep(editingStepId, stepPayload)
    } else {
      addStep(stepPayload)
    }
    setShowAddModal(false)
  }

  const handlePrevStep = (): void => {
    if (useDuelEngineStore.getState().isInitialized) {
      void useDuelEngineStore.getState().undo()
    } else {
      if (currentStepIndex === null) {
        previewStepBoard(steps.length - 1)
      } else if (currentStepIndex > 0) {
        previewStepBoard(currentStepIndex - 1)
      }
    }
  }

  const handleNextStep = (): void => {
    if (useDuelEngineStore.getState().isInitialized) {
      void useDuelEngineStore.getState().redo()
    } else {
      if (currentStepIndex === null) {
        previewStepBoard(0)
      } else if (currentStepIndex < steps.length - 1) {
        previewStepBoard(currentStepIndex + 1)
      }
    }
  }

  const handleResetPlayback = (): void => {
    if (useDuelEngineStore.getState().isInitialized) {
      const first = useDuelEngineStore.getState().timeline[0]
      if (first) void useDuelEngineStore.getState().jumpToStep(first.id)
    } else {
      previewStepBoard(null)
    }
  }

  const handleStepClick = (index: number, step: DuelStep): void => {
    const engine = useDuelEngineStore.getState()
    const actId = step.actId
    if (engine.isInitialized && actId && engine.timeline.some((n) => n.id === actId)) {
      void engine.jumpToStep(actId)
      return
    }
    previewStepBoard(index)
  }

  const handleRestartFromStep = (index: number, step: DuelStep): void => {
    const label = step.cardName || ACTION_TYPE_NAMES[step.actionType] || '这一步'
    const engine = useDuelEngineStore.getState()
    void confirmDialog({
      title: engine.isInitialized ? '以这一步为起点继续编排' : '以这一步为起点开始编排',
      description: engine.isInitialized
        ? `将以「${label}」的场面重建引擎会话，当前操作流结束（步骤列表保留，可继续添加新操作）。`
        : `将以「${label}」的场面启动引擎，之后的操作会作为新步骤记录。`
    }).then((ok) => {
      if (!ok) return
      previewStepBoard(index)
      void useDuelEngineStore.getState().startEngine()
    })
  }

  const toggleGroup = (key: string): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const resolveStepCardName = (step: DuelStep): string =>
    step.cardName ||
    (step.cardCode
      ? state.cards.find((c) => c.code === step.cardCode)?.card?.name || String(step.cardCode)
      : '剧情事件')

  const isCurrentStepOf = (step: DuelStep, index: number): boolean => {
    if (engineCursor < 0) return currentStepIndex === index
    const stepIndex = step.actId ? engineIndexById.get(step.actId) : undefined
    return stepIndex === engineCursor
  }

  const renderStepCard = (step: DuelStep, index: number): React.JSX.Element => {
    const colorTheme = ACTION_TYPE_COLORS[step.actionType] || ACTION_TYPE_COLORS.NORMAL_SUMMON
    const actionLabel = ACTION_TYPE_NAMES[step.actionType] || step.actionType
    const stepEngineIndex = step.actId ? engineIndexById.get(step.actId) : undefined
    const isFutureStep =
      engineCursor >= 0 && stepEngineIndex !== undefined && stepEngineIndex > engineCursor
    const isCurrentPlaying =
      engineCursor >= 0 ? stepEngineIndex === engineCursor : currentStepIndex === index
    const hasBoardSnapshot = Boolean(step.boardAfter && step.boardAfter.length > 0)
    const playableFromHere = hasBoardSnapshot && stepEngineIndex === undefined
    const stepCardName = resolveStepCardName(step)
    const fromName = getLocationDisplayName(step.fromLocation, step.fromSequence)
    const toName = getLocationDisplayName(step.toLocation, step.toSequence)

    return (
      <div key={step.id} className="flex flex-col gap-1.5">
        <div
          onClick={() => handleStepClick(index, step)}
          onMouseEnter={() => {
            setHoveredInstanceId(step.targetInstanceId ?? step.instanceId ?? null)
          }}
          onMouseLeave={() => setHoveredInstanceId(null)}
          title={isFutureStep ? '未来步：点击前进到这一步' : undefined}
          className={cn(
            'group relative flex flex-col gap-1.5 p-2 rounded-lg border transition-all cursor-pointer select-none',
            isCurrentPlaying
              ? 'border-primary/60 ring-2 ring-primary/25 bg-card/90 shadow-md'
              : isFutureStep
                ? 'border-dashed border-border/70 bg-muted/10 opacity-55 hover:opacity-100 hover:border-primary/40'
                : step.actionPlayer === 0
                  ? 'border-blue-500/30 bg-muted/20 hover:border-blue-500/60 hover:bg-muted/30'
                  : 'border-rose-500/30 bg-muted/20 hover:border-rose-500/60 hover:bg-muted/30'
          )}
        >
          <div className="flex items-center gap-2">
            {step.cardCode ? (
              <div className="w-9 h-[52px] rounded overflow-hidden border border-border/80 bg-black/60 shrink-0 shadow-sm relative">
                <img
                  src={getCardImageUrl(step.cardCode, true)}
                  alt={stepCardName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = UNKNOWN_CARD_IMAGE
                  }}
                />
              </div>
            ) : (
              <div className="w-9 h-[52px] rounded border border-dashed border-border/70 flex items-center justify-center shrink-0 text-muted-foreground/50">
                <Layers className="w-4 h-4" />
              </div>
            )}

            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 truncate">
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1 rounded truncate',
                      step.actionPlayer === 0
                        ? 'text-blue-400 bg-blue-500/10'
                        : 'text-rose-400 bg-rose-500/10'
                    )}
                  >
                    {step.actionPlayer === 0 ? '我方' : '对方'}
                  </span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="font-bold text-xs text-foreground truncate">
                          {stepCardName}
                        </span>
                      }
                    />
                    <TooltipContent>{stepCardName}</TooltipContent>
                  </Tooltip>
                </div>

                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0',
                    colorTheme.bg,
                    colorTheme.text,
                    colorTheme.border
                  )}
                >
                  {actionLabel}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                {fromName && toName && (
                  <span className="flex items-center gap-1 truncate">
                    <span>{fromName}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/60" />
                    <span className="text-foreground/90 font-semibold">{toName}</span>
                  </span>
                )}
                {step.chainIndex && step.chainIndex > 0 && (
                  <span className="bg-teal-500/20 text-teal-400 font-bold px-1 rounded ml-auto">
                    C{step.chainIndex}
                  </span>
                )}
                {isFutureStep && (
                  <span
                    className={cn(
                      'text-[9px] font-bold px-1 rounded border border-dashed border-muted-foreground/40 text-muted-foreground',
                      !step.chainIndex || step.chainIndex <= 0 ? 'ml-auto' : ''
                    )}
                  >
                    未来步
                  </span>
                )}
              </div>

              {step.targetCardName && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <Crosshair className="w-2.5 h-2.5 shrink-0 text-cyan-400/80" />
                  <span className="truncate">
                    目标：
                    <span className="text-foreground/90 font-semibold">{step.targetCardName}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {(step.dialogue || step.speaker || step.innerThoughts) && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      openScreenplayWithStep(step.id)
                    }}

                    className="mt-0.5 p-1.5 rounded bg-background/80 hover:bg-background border border-border/50 hover:border-foreground/30 cursor-pointer text-[11px] leading-relaxed flex flex-col gap-0.5 transition-colors"
                  >
                    {step.speaker && (
                      <span className="font-bold text-[10px] text-foreground">
                        【{step.speaker}】:
                      </span>
                    )}
                    {step.dialogue && (
                      <span className="text-foreground/90 italic">“{step.dialogue}”</span>
                    )}
                    {step.innerThoughts && (
                      <span className="text-sky-400/90 text-[10px] italic">
                        （心理：{step.innerThoughts}）
                      </span>
                    )}
                  </div>
                }
              />
              <TooltipContent>点击进入大屏决斗台本工作台精修台词与剧情</TooltipContent>
            </Tooltip>
          )}

          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background/90 backdrop-blur-xs p-0.5 rounded border border-border shadow-sm">
            {hasBoardSnapshot && playableFromHere && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRestartFromStep(index, step)
                      }}
                      className="h-5 w-5 text-emerald-500 hover:text-emerald-400"
                    >
                      <PlayCircle className="w-3 h-3" />
                    </Button>
                  }
                />
                <TooltipContent>
                  {engineActive
                    ? '以这一步的场面重开引擎，从这里继续编排'
                    : '以这一步的场面启动引擎，从这里继续编排'}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      openScreenplayWithStep(step.id)
                    }}

                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  >
                    <BookOpen className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>在决斗台本工作台中精修台词与剧情</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveStep(step.id, 'up')
                    }}

                    className="h-5 w-5"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>上移此步骤</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    disabled={index === steps.length - 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveStep(step.id, 'down')
                    }}

                    className="h-5 w-5"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>下移此步骤</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenEdit(step)
                    }}

                    className="h-5 w-5 text-blue-500 hover:text-blue-400"
                  >
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>编辑此步骤</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteStep(step.id)
                    }}

                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                }
              />
              <TooltipContent>删除此步骤</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col shrink-0 select-none overflow-hidden text-xs">
      <div className="p-2.5 border-b border-border/60 bg-muted/10 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
            <Film className="w-3.5 h-3.5 text-muted-foreground" />
            <span>对局剧情编排</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            共 {steps.length} 步 · {new Set(steps.map((s) => s.turn)).size || 1} 回合
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => openScreenplayWithStep()}
                  className="h-7 px-2 text-xs font-semibold gap-1 border-border text-foreground hover:bg-muted"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>台本</span>
                </Button>
              }
            />
            <TooltipContent>打开大屏决斗台本工作台，沉浸式编写角色台词与剧情</TooltipContent>
          </Tooltip>

          <Button
            size="xs"
            variant="default"
            onClick={handleOpenAdd}
            className="h-7 px-2.5 text-xs font-semibold gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加步骤</span>
          </Button>

          {steps.length > 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => {
                      void confirmDialog({
                        title: '清空步骤',
                        description: '确定要清空全部编排动作步骤吗？此操作可使用 Ctrl+Z 撤销。'
                      }).then((ok) => {
                        if (ok) clearSteps()
                      })
                    }}

                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                }
              />
              <TooltipContent>清空全部步骤</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="p-2 border-b border-border/60 bg-muted/20 flex flex-col gap-2 shrink-0 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs text-foreground">第 {currentTurn} 回合</span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge
                    variant="outline"
                    onClick={() => setActiveTurnPlayer(activeTurnPlayer === 0 ? 1 : 0)}
                    className={cn(
                      'text-[10px] px-1.5 py-0 cursor-pointer font-bold transition-colors',
                      activeTurnPlayer === 0
                        ? 'border-blue-500/50 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
                        : 'border-rose-500/50 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
                    )}
                  >
                    {activeTurnPlayer === 0 ? '我方行动' : '对方行动'}
                  </Badge>
                }
              />
              <TooltipContent>点击切换当前行动方 (我方 / 对方)</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1">
            {currentChain > 0 ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-[10px] font-bold text-teal-300">
                <span className="animate-pulse">⛓ Chain {currentChain}</span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={resetChain}
                        className="ml-0.5 text-[9px] px-1 py-0 bg-teal-500/30 hover:bg-teal-500/50 text-teal-200 rounded font-semibold cursor-pointer"
                      >
                        结算
                      </button>
                    }
                  />
                  <TooltipContent>结算并重置连锁序号</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 font-mono">C0 (无连锁)</span>
            )}

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => setIsAutoRecording(!isAutoRecording)}
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer',
                      isAutoRecording
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                        : 'bg-muted border-border text-muted-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isAutoRecording ? 'bg-rose-500 animate-pulse' : 'bg-muted-foreground'
                      )}
                    />
                    <span>{isAutoRecording ? '记谱中' : '暂停'}</span>
                  </button>
                }
              />
              <TooltipContent>
                {isAutoRecording
                  ? '自动记谱开启中：在决斗盘拖拽或右键操作将自动记录动作步骤与连锁'
                  : '自动记谱已暂停：仅摆放卡片，不自动写入步骤流'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5 bg-background/80 p-0.5 rounded-md border border-border/70 flex-1">
            {ALL_PHASES.map((p) => {
              const isActive = currentPhase === p
              return (
                <Tooltip key={p}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => setCurrentPhase(p)}
                        className={cn(
                          'flex-1 text-[10px] font-extrabold py-0.5 rounded transition-all text-center cursor-pointer',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        {p}
                      </button>
                    }
                  />
                  <TooltipContent>{`切换到 ${PHASE_NAMES[p] || p}`}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={nextPhase}
                    className="h-6 px-1.5 text-[10px] font-bold gap-0.5 border-border"
                  >
                    <span>下阶段</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </Button>
                }
              />
              <TooltipContent>推进到下一个决斗阶段 (DP → SP → M1 → BP → M2 → EP)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={nextTurn}
                    className="h-6 px-1.5 text-[10px] font-bold text-foreground/90"
                  >
                    <span>下回合</span>
                  </Button>
                }
              />
              <TooltipContent>回合结束，推进到下一回合并切换回合方</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 flex flex-col gap-2 select-text">
          {isPreviewing ? (
            <div className="flex flex-col gap-1.5 px-2 py-1.5 rounded-md border border-sky-500/40 bg-sky-500/5 text-[10px] leading-relaxed text-sky-600 dark:text-sky-400">
              <span>
                正在预览第 {previewIndex! + 1}{' '}
                步的场面（引擎当前局面没有改变；做任何引擎操作会自动退出预览）。
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => exitPreview()}
                  className="h-6 px-2 text-[10px]"
                >
                  <X className="w-3 h-3" />
                  <span>退出预览</span>
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleRestartFromStep(previewIndex!, previewStep!)}
                  className="h-6 px-2 text-[10px]"
                >
                  <PlayCircle className="w-3 h-3" />
                  <span>以这一步继续编排</span>
                </Button>
              </div>
            </div>
          ) : (
            futureStepCount > 0 && (
              <div className="px-2 py-1.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
                已回退到当前步：之后 {futureStepCount}{' '}
                步保留在列表里（虚线「未来步」），点击可前进；
                若直接在此处展开新操作，它们会被丢弃。
              </div>
            )
          )}
          {steps.length === 0 ? (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none">
              <Film className="w-10 h-10 text-muted-foreground/30 mb-2.5 animate-pulse" />
              <p className="font-semibold text-foreground/80">暂无编排动作步骤</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed max-w-[220px]">
                点击右上角「添加步骤」开始规划回合、阶段、动作与角色台词，打造生动决斗故事！
              </p>
              <div className="flex items-center gap-2 mt-3.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenAdd}
                  className="h-7 text-xs font-semibold gap-1 border-border text-foreground hover:bg-muted"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新建第 1 步</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openScreenplayWithStep()}
                  className="h-7 text-xs font-semibold gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>决斗台本工作台</span>
                </Button>
              </div>
            </div>
          ) : (
            stepList.map((item) => {
              if (item.kind === 'separator') {
                return (
                  <div
                    key={item.key}
                    className="flex w-full items-center gap-1.5 px-1 pt-1 select-none text-[11px] font-semibold text-muted-foreground/80"
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        item.turnPlayer === 0 ? 'bg-blue-500/70' : 'bg-rose-500/70'
                      )}
                    />
                    <span className="shrink-0">{item.label}</span>
                    <div className="flex-1 h-px bg-border/50 ml-1" />
                  </div>
                )
              }

              const { group } = item
              const firstEntry = group.entries[0]

              if (group.kind === 'single') {
                return renderStepCard(firstEntry.step, firstEntry.index)
              }

              const expanded = expandedGroups.has(group.key)
              const names = group.entries.map(({ step }) => resolveStepCardName(step))
              const isCurrentPlaying = group.entries.some(({ step, index }) =>
                isCurrentStepOf(step, index)
              )
              const damageText =
                group.kind === 'attack'
                  ? getAttackDamageText(firstEntry.step, group.entries[1]?.step)
                  : undefined

              return (
                <div key={group.key} className="flex flex-col gap-1.5">
                  <StepGroupHeader
                    summary={{
                      kind: group.kind,
                      player: firstEntry.step.actionPlayer,
                      cardCode: firstEntry.step.cardCode,
                      cardName: names[0],
                      actionType: firstEntry.step.actionType,
                      names,
                      chainNumber: firstEntry.step.chainIndex,
                      damageText,
                      count: group.entries.length,
                      expanded,
                      isCurrentPlaying,
                      onToggle: () => toggleGroup(group.key)
                    }}
                  />
                  {expanded && (
                    <div
                      className={cn(
                        'flex flex-col gap-2 pl-2 ml-1 border-l',
                        group.kind === 'chain' ? 'border-teal-500/30' : 'border-border/60'
                      )}
                    >
                      {group.entries.map(({ step, index }) => renderStepCard(step, index))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border/60 bg-muted/20 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={handleResetPlayback}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              }
            />
            <TooltipContent>复位至开场</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={steps.length === 0 || currentStepIndex === 0}
                  onClick={handlePrevStep}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
              }
            />
            <TooltipContent>上一步</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={steps.length === 0 || currentStepIndex === steps.length - 1}
                  onClick={handleNextStep}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              }
            />
            <TooltipContent>下一步</TooltipContent>
          </Tooltip>
        </div>

        <span className="text-[11px] font-mono font-medium text-muted-foreground">
          {currentStepIndex !== null
            ? `第 ${currentStepIndex + 1} / ${steps.length} 步`
            : '初始局面'}
        </span>
      </div>

      {showAddModal && (
        <Dialog open={showAddModal} onOpenChange={(next) => !next && setShowAddModal(false)}>
          <DialogContent
            showCloseButton={false}
            className="!flex !flex-col !gap-3 !bg-card !text-card-foreground !max-w-[360px] border border-border shadow-2xl rounded-xl p-4 w-full max-h-[90vh] overflow-y-auto select-none"
          >
            <DialogHeader className="!flex !flex-row items-center justify-between border-b border-border/60 pb-2 space-y-0">
              <DialogTitle className="font-bold text-sm flex items-center gap-1.5">
                <Film className="w-4 h-4 text-muted-foreground" />
                <span>{editingStepId ? '编辑对局步骤' : '添加对局新步骤'}</span>
              </DialogTitle>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setShowAddModal(false)}
                className="h-6 w-6 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogHeader>

            <form onSubmit={handleSaveStep} className="flex flex-col gap-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">回合数</label>
                  <Input
                    type="number"
                    min={1}
                    value={formTurn}
                    onChange={(e) => setFormTurn(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-7 text-xs font-mono font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    决斗阶段
                  </label>
                  <StepSelect
                    value={formPhase}
                    onValueChange={(v) => setFormPhase(v as DuelPhase)}
                    options={ALL_PHASES.map((p) => ({ value: p, label: PHASE_NAMES[p] }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">回合方</label>
                  <StepSelect
                    value={String(formTurnPlayer)}
                    onValueChange={(v) => setFormTurnPlayer(Number(v) as 0 | 1)}
                    options={[
                      { value: '0', label: '我方回合 (Player 0)' },
                      { value: '1', label: '对方回合 (Player 1)' }
                    ]}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    动作发起人
                  </label>
                  <StepSelect
                    value={String(formActionPlayer)}
                    onValueChange={(v) => setFormActionPlayer(Number(v) as 0 | 1)}
                    options={[
                      { value: '0', label: '我方发起 (Player 0)' },
                      { value: '1', label: '对方发起 (Player 1)' }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    动作类型
                  </label>
                  <StepSelect
                    value={formActionType}
                    onValueChange={(v) => setFormActionType(v as DuelActionType)}
                    options={ALL_ACTIONS.map((act) => ({
                      value: act,
                      label: ACTION_TYPE_NAMES[act]
                    }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    连锁序号 (Chain)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={formChain}
                    onChange={(e) => setFormChain(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0 为无连锁"
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    卡密 (密码)
                  </label>
                  <Input
                    type="text"
                    value={formCardCode}
                    onChange={(e) => setFormCardCode(e.target.value)}
                    placeholder="8位卡片密码"
                    className="h-7 text-xs font-mono font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    卡片名称
                  </label>
                  <Input
                    type="text"
                    value={formCardName}
                    onChange={(e) => setFormCardName(e.target.value)}
                    placeholder="卡片名称"
                    className="h-7 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    来源区域
                  </label>
                  <StepSelect
                    value={String(formFromLoc)}
                    onValueChange={(v) => setFormFromLoc(Number(v))}
                    options={COMMONLY_USED_LOCATIONS.map((loc) => ({
                      value: String(loc.loc),
                      label: loc.name
                    }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    移动至区域
                  </label>
                  <StepSelect
                    value={String(formToLoc)}
                    onValueChange={(v) => setFormToLoc(Number(v))}
                    options={COMMONLY_USED_LOCATIONS.map((loc) => ({
                      value: String(loc.loc),
                      label: loc.name
                    }))}
                  />
                </div>
              </div>

              <DialogFooter className="!flex !flex-row !border-t !bg-transparent !p-0 items-center justify-end gap-2 pt-2 border-border/60">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                  className="h-7 text-xs"
                >
                  取消
                </Button>
                <Button type="submit" size="sm" className="h-7 px-4 text-xs font-bold">
                  {editingStepId ? '保存修改' : '确认添加'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
