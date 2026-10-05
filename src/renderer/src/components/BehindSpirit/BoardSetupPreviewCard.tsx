import type { JSX } from 'react'
import { AlertTriangle, Check, Eraser, Heart, LayoutGrid, Loader2, MapPin, X } from 'lucide-react'
import {
  AGENT_BOARD_FACING_NAMES,
  AGENT_BOARD_ZONE_NAMES,
  AgentBoardSetupProposal,
  isDiscreteAgentZone
} from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'

export interface BoardSetupPreviewCardProps {
  setup: AgentBoardSetupProposal
  applied: boolean
  applying: boolean
  error: string | null
  onApply: () => void
  onDismiss: () => void
}

/**
 * AI 复盘场面的待确认预览卡
 *
 * 只读展示 + 明确的确认动作：布局提案本身不碰决斗场，
 * 一切都等用户点「应用到决斗场」后才写入。
 */
export function BoardSetupPreviewCard({
  setup,
  applied,
  applying,
  error,
  onApply,
  onDismiss
}: BoardSetupPreviewCardProps): JSX.Element {
  const cards = setup.cards ?? []
  const lpTargets = setup.lp ?? []

  const p0Cards = cards.filter((c) => c.side === 0)
  const p1Cards = cards.filter((c) => c.side === 1)

  return (
    <div className="rounded-lg border border-border bg-background/60 p-2.5 space-y-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-foreground flex items-center gap-1 min-w-0">
          <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">待确认场面布局</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {setup.clearExisting && !applied && (
            <Button
              size="xs"
              variant="ghost"
              onClick={onDismiss}
              disabled={applying}
              title="放弃该布局，不改动决斗场"
              className="h-6 px-1.5 text-[10px] gap-1"
            >
              <X className="w-3 h-3" />
              <span>放弃</span>
            </Button>
          )}
          <Button
            size="xs"
            onClick={onApply}
            disabled={applied || applying}
            className="h-6 px-1.5 text-[10px] gap-1 font-bold"
          >
            {applying ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>应用中</span>
              </>
            ) : applied ? (
              <>
                <Check className="w-3 h-3" />
                <span>已应用</span>
              </>
            ) : (
              <>
                <Eraser className="w-3 h-3" />
                <span>{setup.clearExisting ? '清空并重建盘面' : '应用到决斗场'}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {setup.summary && (
        <p className="text-[11px] text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
          {setup.summary}
        </p>
      )}

      {setup.clearExisting && !applied && (
        <div className="flex items-start gap-1.5 rounded bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>应用会先清空当前盘面与步骤基线，再按下面的布局重新摆放。</span>
        </div>
      )}

      {lpTargets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {lpTargets.map((t, i) => (
            <span
              key={`${t.side}-${t.duelistName ?? i}`}
              className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-rose-600 dark:text-rose-400"
            >
              <Heart className="w-3 h-3" />
              <span>
                {t.duelistName ? `${t.duelistName} LP` : `${t.side === 0 ? '我方' : '对方'} LP`}{' '}
                {t.lp}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <SideColumn label="我方" cards={p0Cards} />
        <SideColumn label="对方" cards={p1Cards} />
      </div>

      {setup.warnings.length > 0 && (
        <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2 space-y-0.5">
          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            <span>已跳过 {setup.warnings.length} 处无效落位</span>
          </div>
          {setup.warnings.map((w, i) => (
            <p
              key={i}
              className="text-[10px] text-amber-700/90 dark:text-amber-400/90 leading-relaxed break-words [overflow-wrap:anywhere]"
            >
              {w}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive break-words [overflow-wrap:anywhere]">
          {error}
        </p>
      )}
    </div>
  )
}

interface SideColumnProps {
  label: string
  cards: AgentBoardSetupProposal['cards']
}

function SideColumn({ label, cards }: SideColumnProps): JSX.Element | null {
  if (cards.length === 0) return null
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className="space-y-0.5">
        {cards.map((c, i) => (
          <PlacementRow key={`${c.code}-${i}`} placement={c} />
        ))}
      </div>
    </div>
  )
}

function PlacementRow({
  placement
}: {
  placement: AgentBoardSetupProposal['cards'][number]
}): JSX.Element {
  const zoneName = AGENT_BOARD_ZONE_NAMES[placement.location]
  const discrete = isDiscreteAgentZone(placement.location)
  const facingName = placement.position
    ? AGENT_BOARD_FACING_NAMES[placement.position]
    : placement.location === 'SZONE' || placement.location === 'HAND'
      ? AGENT_BOARD_FACING_NAMES.FACEDOWN
      : AGENT_BOARD_FACING_NAMES.FACEUP_ATTACK
  const hasCustomStat = placement.customAtk !== undefined || placement.customDef !== undefined

  return (
    <div className="flex items-center gap-1.5 rounded bg-muted/40 px-1.5 py-1 min-w-0">
      <img
        src={getCardImageUrl(placement.code, true)}
        alt={placement.cardName ?? String(placement.code)}
        className="w-6 h-8 object-cover rounded-sm shrink-0 bg-black/10"
        onError={(e) => {
          e.currentTarget.src = CARD_BACK_IMAGE
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-foreground truncate">
          {placement.cardName ?? `卡密 ${placement.code}`}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5" />
            {zoneName}
            {discrete ? ` ${placement.sequence + 1}` : ''}
          </span>
          {placement.isUnknown && (
            <>
              <span className="text-border">·</span>
              <span className="text-amber-600 dark:text-amber-400">未指定是哪张</span>
            </>
          )}
          <span className="text-border">·</span>
          <span>{facingName}</span>
          {placement.duelistName && (
            <>
              <span className="text-border">·</span>
              <span>{placement.duelistName}</span>
            </>
          )}
        </div>
      </div>
      {hasCustomStat && (
        <span className="shrink-0 rounded bg-violet-500/15 px-1 py-0.5 text-[10px] font-mono font-semibold text-violet-600 dark:text-violet-400">
          {placement.customAtk !== undefined ? `攻${placement.customAtk}` : ''}
          {placement.customAtk !== undefined && placement.customDef !== undefined ? ' ' : ''}
          {placement.customDef !== undefined ? `守${placement.customDef}` : ''}
        </span>
      )}
    </div>
  )
}
