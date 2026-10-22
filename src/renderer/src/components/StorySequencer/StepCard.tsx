import React from 'react'
import { ACTION_TYPE_COLORS, DuelActionType, DuelStep, POSITION_NAMES } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { CardImage } from '../ui/CardImage'
import { Button } from '../ui/button'
import { BookOpen, ChevronDown, ChevronUp, MessageSquare, PlayCircle, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { duelActionLabel, resolveStepCardName } from './stepGrouping'
import { StepLpChange } from './StepLpChange'
import { StepLocationLabel } from './StepLocationLabel'
import arrowIcon from '../../assets/history/arrow.svg'
import attackIcon from '../../assets/history/attack.png'
import effectIcon from '../../assets/history/effect.png'
import setIcon from '../../assets/history/set.png'
import summonIcon from '../../assets/history/summon.png'
import targetedIcon from '../../assets/history/targeted.png'

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

const OP_ICONS: Partial<Record<DuelActionType, string>> = {
  NORMAL_SUMMON: summonIcon,
  SPECIAL_SUMMON: summonIcon,
  FLIP_SUMMON: summonIcon,
  XYZ_SUMMON: summonIcon,
  FUSION_SUMMON: summonIcon,
  SYNCHRO_SUMMON: summonIcon,
  LINK_SUMMON: summonIcon,
  RITUAL_SUMMON: summonIcon,
  SET_MONSTER: setIcon,
  SET_SPELL_TRAP: setIcon,
  SET_PENDULUM: setIcon,
  ACTIVATE: effectIcon,
  ACTIVATE_FIELD: effectIcon,
  CHAIN: effectIcon,
  RESOLVE_CHAIN: effectIcon,
  ATTACK: attackIcon,
  DAMAGE: attackIcon,
  DRAW: arrowIcon,
  SEARCH: arrowIcon,
  SALVAGE: arrowIcon,
  TO_GRAVE: arrowIcon,
  SEND_TO_GRAVE: arrowIcon,
  BANISH: arrowIcon,
  TO_HAND: arrowIcon,
  TO_DECK: arrowIcon,
  PLACE: arrowIcon,
  CHANGE_POS: arrowIcon,
  DETACH_MATERIAL: arrowIcon
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
  const { setHoveredInstanceId, moveStep, deleteStep, openScreenplayWithStep } = useDuelStore()
  const isReplay = useDuelEngineStore((s) => s.replayInfo !== null)
  const colorTheme = ACTION_TYPE_COLORS[step.actionType] || ACTION_TYPE_COLORS.NORMAL_SUMMON
  const actionLabel = duelActionLabel(step)
  const hasBoardSnapshot = Boolean(step.boardAfter && step.boardAfter.length > 0)
  const playableFromHere = hasBoardSnapshot && stepEngineIndex === undefined
  const displayCardName = resolveStepCardName(step)
  const opIcon = OP_ICONS[step.actionType] ?? arrowIcon
  const showToLocation = step.toLocation !== undefined && step.toLocation !== step.fromLocation
  const showMainRow = !(
    step.lpChange &&
    !step.cardCode &&
    (step.actionType === 'DAMAGE' || step.actionType === 'RECOVER')
  )
  const hasPositionPair =
    (step.actionType === 'CHANGE_POS' || step.actionType === 'FLIP_SUMMON') &&
    step.fromPosition !== undefined &&
    step.toPosition !== undefined
  const positionPair = hasPositionPair ? (
    <div className="flex items-center justify-center gap-1 min-w-0">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        {POSITION_NAMES[step.fromPosition!] ?? '？'}
      </span>
      <img src={arrowIcon} alt="" className="w-7 h-auto shrink-0 pointer-events-none" />
      <span className="text-[10px] font-semibold text-foreground/90 whitespace-nowrap">
        {POSITION_NAMES[step.toPosition!] ?? '？'}
      </span>
    </div>
  ) : null

  const playerBadgeClass = cn(
    'text-[9px] font-bold px-1 rounded leading-none py-0.5 shrink-0',
    step.actionPlayer === 0 ? 'text-blue-400 bg-blue-500/10' : 'text-rose-400 bg-rose-500/10'
  )

  const metaBadges = (
    <>
      {step.chainIndex && step.chainIndex > 0 && (
        <span className="bg-teal-500/20 text-teal-400 font-bold px-1 rounded text-[9px] shrink-0">
          C{step.chainIndex}
        </span>
      )}
      {isFutureStep && (
        <span className="text-[9px] font-bold px-1 rounded border border-dashed border-muted-foreground/40 text-muted-foreground shrink-0">
          未来步
        </span>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onClick={() => onClick(index, step)}
        onMouseEnter={() => {
          setHoveredInstanceId(step.targetInstanceId ?? step.instanceId ?? null)
        }}
        onMouseLeave={() => setHoveredInstanceId(null)}
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
        {showMainRow &&
          (!step.cardCode ? (
            <div className="flex items-center gap-1.5 text-[11px] leading-snug min-w-0">
              <span className={playerBadgeClass}>{step.actionPlayer === 0 ? '我方' : '对方'}</span>
              <span className={cn('font-semibold shrink-0', colorTheme.text)}>{actionLabel}</span>
              <span className="text-muted-foreground/80 truncate">{step.description}</span>
              <span className="flex items-center gap-1 ml-auto">{metaBadges}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-14 rounded overflow-hidden border border-border/80 bg-black/60 shrink-0 shadow-sm relative">
                <CardImage
                  code={step.cardCode}
                  small
                  alt={displayCardName}
                  className="w-full h-auto block"
                />
                <span
                  className={cn(
                    'absolute inset-x-0 bottom-0 text-center text-[8px] font-bold leading-none py-0.5',
                    step.actionPlayer === 0
                      ? 'bg-blue-950/80 text-blue-300'
                      : 'bg-rose-950/80 text-rose-300'
                  )}
                >
                  {step.actionPlayer === 0 ? '我方' : '对方'}
                </span>
              </div>

              <StepLocationLabel
                player={step.fromController ?? step.actionPlayer}
                location={step.fromLocation}
                sequence={step.fromSequence}
                className="w-16 shrink-0"
              />

              <div className="flex-1 flex flex-col items-center justify-center gap-1 min-w-0 px-0.5">
                <span className={cn('text-[11px] font-bold leading-none', colorTheme.text)}>
                  {actionLabel}
                </span>
                {positionPair ?? (
                  <img src={opIcon} alt="" className="w-9 h-auto pointer-events-none" />
                )}
                {(step.chainIndex && step.chainIndex > 0) || isFutureStep ? (
                  <span className="flex items-center gap-1">{metaBadges}</span>
                ) : null}
              </div>

              {showToLocation && (
                <StepLocationLabel
                  player={step.toController ?? step.fromController ?? step.actionPlayer}
                  location={step.toLocation}
                  sequence={step.toSequence}
                  className="w-16 shrink-0"
                />
              )}

              {step.targetCardName && (
                <div className="flex flex-col items-center gap-0.5 min-w-0 max-w-[72px] shrink-0">
                  <img src={targetedIcon} alt="" className="w-4 h-4 pointer-events-none" />
                  <span className="text-[10px] text-orange-400/90 break-all leading-tight text-center">
                    {step.targetCardName}
                  </span>
                </div>
              )}
            </div>
          ))}

        {showLpChange && step.lpChange && (
          <StepLpChange lpChange={step.lpChange} turn={step.turn} />
        )}
        {!showMainRow && step.description && (
          <div className="text-[10px] leading-snug text-muted-foreground/80">
            {step.description}
          </div>
        )}

        {(step.dialogue || step.speaker || step.innerThoughts) && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              openScreenplayWithStep(step.id)
            }}
            className="mt-0.5 p-1.5 rounded bg-background/80 hover:bg-background border border-border/50 hover:border-foreground/30 cursor-pointer text-[11px] leading-relaxed flex flex-col gap-0.5 transition-colors"
          >
            {step.speaker && (
              <span className="font-bold text-[10px] text-foreground">【{step.speaker}】:</span>
            )}
            {step.dialogue && <span className="text-foreground/90 italic">“{step.dialogue}”</span>}
            {step.innerThoughts && (
              <span className="text-sky-400/90 text-[10px] italic">
                （心理：{step.innerThoughts}）
              </span>
            )}
          </div>
        )}

        {!isReplay && (
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background/90 backdrop-blur-xs p-0.5 rounded border border-border shadow-sm">
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
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={index === stepsLength - 1}
              onClick={(e) => {
                e.stopPropagation()
                moveStep(step.id, 'down')
              }}
              className="h-5 w-5"
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
          </div>
        )}
      </div>
    </div>
  )
}
