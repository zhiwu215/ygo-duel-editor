import React from 'react'
import { ACTION_TYPE_COLORS, DuelActionType } from '@shared/index'
import { ArrowRight, ChevronRight, Link2 } from 'lucide-react'
import { CardImage } from '../ui/CardImage'
import { cn } from '../../lib/utils'

export type StepGroupKind = 'chain' | 'attack' | 'draw'

export interface StepGroupSummary {
  kind: StepGroupKind
  player: 0 | 1
  playerName?: string
  cardCode?: number
  cardName: string
  actionType: DuelActionType
  names: string[]
  cardCodes?: (number | undefined)[]
  chainNumber?: number
  damageText?: string
  count: number
  expanded: boolean
  isCurrentPlaying: boolean
  onToggle: () => void
}

const CardThumb: React.FC<{ code?: number; name: string }> = ({ code, name }) => {
  if (!code) {
    return null
  }

  return (
    <div className="w-7 h-10 rounded overflow-hidden border border-border/80 bg-black/60 shrink-0 shadow-sm">
      <CardImage code={code} small alt={name} className="w-full h-full object-cover" />
    </div>
  )
}

const PLAYER_BADGE_STYLES = [
  'text-blue-600 dark:text-blue-400 bg-blue-500/10',
  'text-rose-600 dark:text-rose-400 bg-rose-500/10'
] as const

const GROUP_HEADER_STYLES = (player: 0 | 1, isCurrentPlaying: boolean): string =>
  cn(
    'group flex flex-col gap-1.5 p-2 rounded-lg border transition-all cursor-pointer select-none',
    isCurrentPlaying
      ? 'border-primary/60 ring-2 ring-primary/25 bg-card/90 shadow-md'
      : player === 0
        ? 'border-blue-500/30 bg-muted/20 hover:border-blue-500/60 hover:bg-muted/30'
        : 'border-rose-500/30 bg-muted/20 hover:border-rose-500/60 hover:bg-muted/30'
  )

export const StepGroupHeader: React.FC<{ summary: StepGroupSummary }> = ({ summary }) => {
  const colorTheme = ACTION_TYPE_COLORS[summary.actionType] || ACTION_TYPE_COLORS.NORMAL_SUMMON
  const chainNames = summary.names.map((name) => `【${name}】`)
  const chainText =
    chainNames.length > 2 ? `${chainNames.slice(0, 2).join(' → ')} …` : chainNames.join(' → ')
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      summary.onToggle()
    }
  }

  if (summary.kind === 'draw') {
    const codes = summary.cardCodes ?? []
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={summary.onToggle}
        onKeyDown={onKeyDown}
        className={GROUP_HEADER_STYLES(summary.player, summary.isCurrentPlaying)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronRight
            className={cn(
              'w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform',
              summary.expanded && 'rotate-90'
            )}
          />
          <span
            className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded leading-none shrink-0',
              PLAYER_BADGE_STYLES[summary.player]
            )}
          >
            {summary.playerName ?? (summary.player === 0 ? '我方' : '对方')}
          </span>
          <span className="text-[11px] font-bold text-blue-500 dark:text-blue-400">抽卡</span>
          <span className="text-[10px] font-bold text-muted-foreground">×{summary.count}</span>
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {summary.expanded ? '收起' : '展开'}
          </span>
        </div>

        <div className="flex items-end gap-1 pl-5">
          {codes.slice(0, 5).map((code, index) => (
            <div
              key={index}
              className="w-7 h-10 rounded overflow-hidden border border-border/80 bg-black/60 shrink-0 shadow-sm"
            >
              <CardImage
                code={code}
                small
                alt={summary.names[index] ?? '抽卡'}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {codes.length > 5 && (
            <span className="text-[10px] font-bold text-muted-foreground pb-0.5">
              +{codes.length - 5}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={summary.onToggle}
      onKeyDown={onKeyDown}
      className={GROUP_HEADER_STYLES(summary.player, summary.isCurrentPlaying)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <ChevronRight
          className={cn(
            'w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform',
            summary.expanded && 'rotate-90'
          )}
        />

        {summary.kind === 'attack' ? (
          <CardThumb code={summary.cardCode} name={summary.cardName} />
        ) : null}

        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {summary.kind === 'chain' ? (
            <>
              <span className="flex items-center gap-0.5 shrink-0 text-[10px] font-bold px-1 py-0.5 rounded bg-teal-500/15 text-teal-400 border border-teal-500/30">
                <Link2 className="w-2.5 h-2.5" />
                <span>连锁 #{summary.chainNumber ?? 1}</span>
              </span>
              <span className="text-[10px] text-muted-foreground/50 shrink-0">·</span>
              <span className="text-[11px] font-semibold text-foreground truncate">
                {chainText}
              </span>
            </>
          ) : (
            <>
              <span className="font-bold text-xs text-foreground truncate">
                【{summary.cardName}】
              </span>
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0',
                  colorTheme.bg,
                  colorTheme.text,
                  colorTheme.border
                )}
              >
                攻击
              </span>
              {summary.damageText && (
                <>
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
                  <span className="text-[11px] font-bold text-amber-500 truncate">
                    {summary.damageText}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        <span className="shrink-0 text-[10px] text-muted-foreground">
          {summary.expanded ? '收起' : '展开'}
        </span>
      </div>
    </div>
  )
}
