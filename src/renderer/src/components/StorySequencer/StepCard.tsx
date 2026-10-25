import React from 'react'
import { ACTION_TYPE_COLORS, DuelLogCardRef, DuelStep, POSITION_NAMES } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { CardThumb } from '../ui/CardThumb'
import { Button } from '../ui/button'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  PlayCircle,
  Shuffle,
  Trash2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { resolveStepCardName } from './stepGrouping'
import { duelActionLabel } from '../../utils/stepLabels'
import { StepLogRows } from './StepLogRows'
import { MdLocationIcon } from './MdLocationIcon'
import { MDLOG_ASSETS, MDLOG_COLORS, maskStyle } from './mdpro3LogAssets'
import { sideName, summonLabel } from './stepLogFormat'
import negatedIcon from '../../assets/textures/negated.png'
import targetedIcon from '../../assets/history/targeted.png'
import { ChainGlyph } from '../common/ChainGlyph'

interface StepCardProps {
  step: DuelStep
  index: number
  stepsLength: number
  isCurrentPlaying: boolean
  isFutureStep: boolean
  stepEngineIndex: number | undefined
  showLpChange?: boolean
  onEdit: (step: DuelStep) => void
  onRestart: (index: number, step: DuelStep) => void
  onClick: (index: number, step: DuelStep) => void
}

function cardFromStep(
  step: DuelStep,
  controller: 0 | 1,
  location: number | undefined,
  sequence: number | undefined
): DuelLogCardRef | undefined {
  if (location === undefined || !step.cardCode) return undefined
  return {
    code: step.cardCode,
    name: step.cardName,
    controller,
    location,
    sequence: sequence ?? 0
  }
}

function summaryActionLabel(step: DuelStep): string {
  const event = (step.logEvents ?? []).find(
    (item) =>
      (item.kind === 'summon' || item.kind === 'set' || item.kind === 'activate') &&
      item.card.code === step.cardCode
  )
  if (event?.kind === 'summon') return summonLabel(event.summonKind)
  if (event?.kind === 'set') return '盖放'
  if (event?.kind === 'activate') return '发动'
  if (step.actionType === 'SET_MONSTER' || step.actionType === 'SET_SPELL_TRAP') return '盖放'
  if (step.actionType === 'ACTIVATE' || step.actionType === 'ACTIVATE_FIELD') return '发动'
  if (step.actionType === 'ATTACK') return '攻击'
  return duelActionLabel(step)
}

export const StepCard: React.FC<StepCardProps> = ({
  step,
  index,
  stepsLength,
  isCurrentPlaying,
  isFutureStep,
  stepEngineIndex,
  showLpChange = true,
  onEdit,
  onRestart,
  onClick
}: StepCardProps) => {
  const setHoveredInstanceId = useDuelStore((state) => state.setHoveredInstanceId)
  const moveStep = useDuelStore((state) => state.moveStep)
  const deleteStep = useDuelStore((state) => state.deleteStep)
  const openScreenplayWithStep = useDuelStore((state) => state.openScreenplayWithStep)
  const duelists = useDuelStore((state) => state.state.duelists)
  const isReplay = useDuelEngineStore((s) => s.replayInfo !== null)
  const engineActive = useDuelEngineStore((s) => s.isInitialized)
  const colorTheme = ACTION_TYPE_COLORS[step.actionType] || ACTION_TYPE_COLORS.NORMAL_SUMMON
  const actionLabel = summaryActionLabel(step)
  const hasBoardSnapshot = Boolean(step.boardAfter && step.boardAfter.length > 0)
  const playableFromHere = hasBoardSnapshot && stepEngineIndex === undefined
  const displayCardName = resolveStepCardName(step)
  const isShuffleStep = step.description?.includes('手牌切洗') ?? false
  const isNegatedStep = step.description?.includes('效果被无效') ?? false
  const actingDuelist =
    duelists?.find((duelist) => duelist.id === step.actionDuelistId) ??
    duelists?.find((duelist) => duelist.team === step.actionPlayer)
  const playerLabel = actingDuelist?.name ?? sideName(step.actionPlayer)
  const chainNumber = step.chainIndex && step.chainIndex > 0 ? step.chainIndex : step.chainBadge
  const fromCard = cardFromStep(
    step,
    step.fromController ?? step.actionPlayer,
    step.fromLocation,
    step.fromSequence
  )
  const toCard = cardFromStep(
    step,
    step.toController ?? step.fromController ?? step.actionPlayer,
    step.toLocation,
    step.toSequence
  )
  const logEvents = step.logEvents ?? []
  const hasLogEvents = logEvents.length > 0
  const summaryActivation = logEvents.find(
    (event): event is Extract<(typeof logEvents)[number], { kind: 'activate' }> =>
      event.kind === 'activate' && event.card.code === step.cardCode
  )
  const chainEffectText = logEvents.some(
    (event) =>
      event.kind === 'chain-solving' &&
      Boolean(event.effectText) &&
      event.card?.code === step.cardCode
  )
  const summaryEffectText = chainEffectText ? undefined : summaryActivation?.effectText
  const attackEvent = logEvents.find(
    (event): event is Extract<(typeof logEvents)[number], { kind: 'attack' }> =>
      event.kind === 'attack' && event.attacker.code === step.cardCode
  )
  const displayFrom = attackEvent?.attacker ?? fromCard
  const displayTo = attackEvent?.defender ?? toCard
  const showToLocation =
    Boolean(displayTo) &&
    (displayTo!.location !== displayFrom?.location || displayTo!.sequence !== displayFrom?.sequence)
  const showMainRow = !(
    step.lpChange &&
    !step.cardCode &&
    (step.actionType === 'DAMAGE' || step.actionType === 'RECOVER')
  )
  const hasPositionPair =
    (step.actionType === 'CHANGE_POS' || step.actionType === 'FLIP_SUMMON') &&
    step.fromPosition !== undefined &&
    step.toPosition !== undefined
  const hasZones = Boolean(displayFrom) || Boolean(displayTo)
  const arrowColor = step.actionPlayer === 0 ? MDLOG_COLORS.myArrow : MDLOG_COLORS.opArrow
  const playerAccent = step.actionPlayer === 0 ? 'text-blue-500' : 'text-rose-500'

  return (
    <div className="flex flex-col">
      <div
        onClick={() => onClick(index, step)}
        onMouseEnter={() => {
          setHoveredInstanceId(step.targetInstanceId ?? step.instanceId ?? null)
        }}
        onMouseLeave={() => setHoveredInstanceId(null)}
        className={cn(
          'group relative cursor-pointer select-none overflow-hidden rounded-lg border bg-card transition-all',
          isCurrentPlaying
            ? 'border-primary/60 ring-1 ring-primary/20 shadow-xs'
            : isFutureStep
              ? 'border-dashed border-border/70 opacity-55 hover:opacity-100'
              : step.actionPlayer === 0
                ? 'border-blue-500/30 hover:border-blue-500/60 hover:shadow-sm'
                : 'border-rose-500/30 hover:border-rose-500/60 hover:shadow-sm'
        )}
      >
        {showMainRow &&
          (step.cardCode ? (
            <div className={cn('relative w-full', hasZones ? 'h-[120px]' : 'h-[86px]')}>
              <div
                className={cn(
                  'absolute left-[15px] overflow-hidden rounded-[2px] border border-border bg-muted shadow-sm',
                  hasZones ? 'top-[36px] h-[78px] w-[52px]' : 'top-[16px] h-[58px] w-[39px]'
                )}
              >
                <CardThumb
                  code={step.cardCode}
                  name={displayCardName}
                  imageClassName="block"
                  className="h-full w-full"
                />
              </div>

              <div
                className={cn(
                  'absolute left-[10px] top-[7px] truncate text-[16px] font-bold leading-tight text-foreground',
                  hasZones ? 'max-w-[112px]' : 'max-w-[150px]'
                )}
              >
                {displayCardName}
              </div>

              <div
                className={cn(
                  'absolute right-[8px] top-[9px] max-w-[74px] truncate text-right text-[9px] font-semibold',
                  playerAccent
                )}
              >
                {playerLabel}
              </div>

              <div
                className={cn(
                  'absolute flex flex-col items-center justify-center gap-0.5',
                  hasZones ? 'left-[126px] top-[34px] w-[68px]' : 'left-[62px] top-[26px] w-[100px]'
                )}
              >
                <span
                  className={cn('text-center text-[15px] font-bold leading-tight', colorTheme.text)}
                >
                  {actionLabel}
                </span>
                {chainNumber && chainNumber > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-500">
                    <ChainGlyph className="h-3 w-3" />C{chainNumber}
                  </span>
                )}
                {hasPositionPair && (
                  <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                    {POSITION_NAMES[step.fromPosition!] ?? '？'} →{' '}
                    {POSITION_NAMES[step.toPosition!] ?? '？'}
                  </span>
                )}
              </div>

              {hasZones && (
                <>
                  <div className="absolute left-[82px] top-[75px]">
                    <MdLocationIcon card={displayFrom} size={35} />
                  </div>
                  {showToLocation && (
                    <>
                      <span
                        className="pointer-events-none absolute left-[126px] top-[80px] h-[25px] w-[68px]"
                        style={maskStyle(MDLOG_ASSETS.arrow, arrowColor)}
                      />
                      <div className="absolute left-[202px] top-[75px]">
                        <MdLocationIcon card={displayTo} size={35} />
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border/50" />
            </div>
          ) : (
            <div className="flex min-h-[34px] items-center gap-2 px-3 py-1.5">
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  step.actionPlayer === 0 ? 'bg-blue-500' : 'bg-rose-500'
                )}
              />
              <span className="shrink-0 text-[13px] font-bold text-foreground">{actionLabel}</span>
              {step.actionType !== 'PHASE_CHANGE' && step.actionType !== 'TURN_CHANGE' && (
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                  {step.description}
                </span>
              )}
              {chainNumber && chainNumber > 0 && (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-amber-500">
                  <ChainGlyph className="h-3 w-3" />C{chainNumber}
                </span>
              )}
            </div>
          ))}

        {summaryEffectText && (
          <div className="truncate bg-muted/30 px-2 py-1 text-[9px] leading-snug text-muted-foreground">
            {summaryEffectText}
          </div>
        )}

        {hasLogEvents && <StepLogRows step={step} events={logEvents} />}

        {!hasLogEvents && step.targetCardName && (
          <div className="mx-[56px] mt-0.5 flex min-w-0 items-center gap-2 border-y border-orange-500/20 bg-orange-500/10 px-2 py-1">
            <img src={targetedIcon} alt="" className="h-3.5 w-3.5 shrink-0 opacity-80" />
            <span className="shrink-0 text-[10px] font-bold text-orange-600">对象</span>
            <span className="min-w-0 truncate text-[10px] text-orange-600/80">
              {step.targetCardName}
            </span>
          </div>
        )}

        {isShuffleStep && (
          <div className="flex items-center gap-1 bg-amber-500/10 px-3 py-0.5 text-[9px] font-medium text-amber-600">
            <Shuffle className="h-3 w-3" />
            <span>手牌切洗</span>
          </div>
        )}

        {isNegatedStep && (
          <div className="flex items-center gap-1 bg-rose-500/10 px-3 py-0.5 text-[9px] font-medium text-rose-600">
            <img src={negatedIcon} alt="" className="h-3.5 w-3.5 object-contain" />
            <span>效果被无效</span>
          </div>
        )}

        {showLpChange && step.lpChange && !hasLogEvents && (
          <div className="flex items-center justify-end gap-1 px-3 py-0.5 text-[10px]">
            <span
              className={
                step.lpChange.newLp < step.lpChange.oldLp ? 'text-rose-500' : 'text-sky-500'
              }
            >
              {sideName(step.lpChange.player)} LP
            </span>
            <span className="font-mono text-foreground/80">
              {step.lpChange.oldLp} → {step.lpChange.newLp}
            </span>
          </div>
        )}

        {!isReplay && (
          <div className="absolute top-1.5 right-1.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background/95 backdrop-blur-sm p-0.5 rounded border border-border shadow-sm">
            {hasBoardSnapshot && playableFromHere && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  onRestart(index, step)
                }}
                className="h-5 w-5 text-emerald-500 hover:text-emerald-400"
              >
                <PlayCircle className="w-3 h-3" />
              </Button>
            )}
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
            {!engineActive && (
              <>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveStep(step.id, 'up')
                  }}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                >
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={index === stepsLength - 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveStep(step.id, 'down')
                  }}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(step)
                  }}
                  className="h-5 w-5 text-blue-500 hover:text-blue-400"
                >
                  <MessageSquare className="w-3 h-3" />
                </Button>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
