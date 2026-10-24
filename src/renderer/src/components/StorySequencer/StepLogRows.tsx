import React from 'react'
import {
  DuelLogCardRef,
  DuelLogEvent,
  DuelStep,
  POSITION_NAMES,
  resolveCounterName
} from '@shared/index'
import { CardThumb } from '../ui/CardThumb'
import { cn } from '../../lib/utils'
import { resolveCardName } from '../../utils/cardNames'
import { MdLocationIcon } from './MdLocationIcon'
import { MDLOG_ASSETS, MDLOG_COLORS, maskStyle } from './mdpro3LogAssets'
import { phaseName, sideName, summonLabel, zoneLabel } from './stepLogFormat'

interface StepLogRowsProps {
  step: DuelStep
  events: DuelLogEvent[]
}

function nameOf(card: DuelLogCardRef, fallback = '卡片'): string {
  return card.name || resolveCardName(card.code) || fallback
}

function LogCardThumb({
  card,
  width = 40,
  height = 58
}: {
  card: DuelLogCardRef
  width?: number
  height?: number
}): React.JSX.Element {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[1px] border border-border bg-muted shadow-sm"
      style={{ width, height }}
      title={nameOf(card)}
    >
      <CardThumb
        code={card.code}
        name={nameOf(card)}
        nameClassName="text-[8px] leading-[9px]"
        className="h-full w-full"
      />
    </div>
  )
}

function ZonePair({
  from,
  to
}: {
  from?: DuelLogCardRef
  to?: DuelLogCardRef
}): React.JSX.Element | null {
  if (!from && !to) return null
  const color =
    (to?.controller ?? from?.controller) === 0 ? MDLOG_COLORS.myArrow : MDLOG_COLORS.opArrow
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1">
      {from && <MdLocationIcon card={from} size={30} />}
      {from && to && (
        <span className="h-[18px] w-[48px]" style={maskStyle(MDLOG_ASSETS.arrow, color)} />
      )}
      {to && <MdLocationIcon card={to} size={30} />}
    </span>
  )
}

function Band({
  children,
  tone,
  chainCount,
  card
}: {
  children: React.ReactNode
  tone: 'chain' | 'solve' | 'end' | 'header' | 'danger'
  chainCount?: number
  card?: DuelLogCardRef
}): React.JSX.Element {
  const background =
    tone === 'header'
      ? 'rgb(241 245 249)'
      : tone === 'end'
        ? 'rgb(248 250 252)'
        : tone === 'danger'
          ? 'rgb(255 241 242)'
          : 'rgb(226 232 240)'
  return (
    <div
      className="flex h-[30px] items-center gap-2 px-2 text-[11px] font-semibold"
      style={{ backgroundColor: background }}
    >
      {(tone === 'chain' || tone === 'solve') && (
        <span className="relative h-[24px] w-[24px] shrink-0">
          <img src={MDLOG_ASSETS.chain} alt="" className="h-full w-full opacity-80 invert" />
          {chainCount !== undefined && chainCount > 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground">
              {chainCount}
            </span>
          )}
        </span>
      )}
      {tone !== 'chain' && tone !== 'solve' && chainCount !== undefined && chainCount > 0 && (
        <span className="shrink-0 text-[13px] font-bold text-foreground">{chainCount}</span>
      )}
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          tone === 'danger'
            ? 'text-rose-600'
            : tone === 'end'
              ? 'text-muted-foreground'
              : 'text-foreground'
        )}
      >
        {children}
      </span>
      {card && <LogCardThumb card={card} width={25} height={32} />}
    </div>
  )
}

function summaryEventIndex(step: DuelStep, events: DuelLogEvent[]): number {
  const cardCode = step.cardCode
  if (!cardCode) return -1
  const matches = (card: DuelLogCardRef): boolean => card.code === cardCode
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (event.kind === 'summon' && matches(event.card)) return i
    if (event.kind === 'set' && matches(event.card)) return i
    if (event.kind === 'activate' && matches(event.card)) return i
    if (event.kind === 'attack' && matches(event.attacker)) return i
    if (event.kind === 'move' && matches(event.move.card)) return i
  }
  return -1
}

export const StepLogRows: React.FC<StepLogRowsProps> = ({ step, events }) => {
  if (events.length === 0) return null
  const summaryIndex = summaryEventIndex(step, events)
  const rows: React.JSX.Element[] = []
  let started = false

  events.forEach((event, index) => {
    if (index === summaryIndex) return
    if (event.kind === 'chain' && step.chainIndex === event.chainCount) return
    if (event.kind === 'phase' && !started) return
    started = true

    if (event.kind === 'turn-start') {
      rows.push(
        <div
          key={`log-${index}`}
          className="flex items-center gap-2 px-2 py-1 text-[10px] text-muted-foreground"
        >
          <span className="h-px flex-1 bg-border" />
          <span className="font-semibold">{sideName(event.player)}回合开始</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )
      return
    }

    if (event.kind === 'phase') {
      rows.push(
        <div
          key={`log-${index}`}
          className="flex items-center gap-2 px-2 py-1 text-[10px] text-muted-foreground"
        >
          <span className="h-px flex-1 bg-border" />
          <span className="font-semibold">{phaseName(event.phase)}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )
      return
    }

    if (event.kind === 'summon' || event.kind === 'set' || event.kind === 'activate') {
      const action =
        event.kind === 'summon'
          ? summonLabel(event.summonKind)
          : event.kind === 'set'
            ? '盖放'
            : '发动'
      rows.push(
        <div
          key={`log-${index}`}
          className="flex h-[64px] items-center gap-2 border-b border-border/30 px-2"
        >
          <LogCardThumb card={event.card} />
          <span className="shrink-0 text-[10px] font-bold text-foreground">{action}</span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground/90">
            {nameOf(event.card)}
          </span>
          <ZonePair from={event.from} to={event.card} />
        </div>
      )
      if (event.kind === 'activate' && event.effectText) {
        rows.push(
          <div
            key={`log-${index}-effect`}
            className="truncate px-2 pb-1 pl-[38px] text-[9px] text-muted-foreground"
            title={event.effectText}
          >
            {event.effectText}
          </div>
        )
      }
      return
    }

    if (event.kind === 'chain') {
      rows.push(
        <Band key={`log-${index}`} tone="chain" chainCount={event.chainCount}>
          连锁
        </Band>
      )
      return
    }

    if (event.kind === 'chain-solving') {
      rows.push(
        <Band key={`log-${index}`} tone="solve" chainCount={event.chainCount} card={event.card}>
          {event.card ? `效果处理 · ${nameOf(event.card)}` : '效果处理'}
        </Band>
      )
      if (event.effectText) {
        rows.push(
          <div
            key={`log-${index}-effect`}
            className="truncate bg-muted/30 px-2 py-1 pl-[38px] text-[9px] text-muted-foreground"
            title={event.effectText}
          >
            {event.effectText}
          </div>
        )
      }
      return
    }

    if (event.kind === 'chain-end') {
      rows.push(
        <Band key={`log-${index}`} tone="end">
          {event.chainCount > 1 ? '连锁结束' : '处理结束'}
        </Band>
      )
      return
    }

    if (event.kind === 'chain-negated') {
      rows.push(
        <Band key={`log-${index}`} tone="danger" card={event.card}>
          {event.disabled ? '效果无效' : '发动无效'}
          {event.card ? ` · ${nameOf(event.card)}` : ''}
        </Band>
      )
      return
    }

    if (event.kind === 'move') {
      const move = event.move
      rows.push(
        <div
          key={`log-${index}`}
          className="flex h-[64px] items-center gap-2 border-b border-border/30 px-2"
        >
          <LogCardThumb card={move.card} />
          <span className="shrink-0 text-[10px] font-bold text-foreground">{move.reasonText}</span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground/90">
            {nameOf(move.card)}
          </span>
          <ZonePair from={move.from} to={move.to} />
        </div>
      )
      return
    }

    if (event.kind === 'target') {
      rows.push(
        <div
          key={`log-${index}-head`}
          className="ml-[56px] mr-2 flex h-[26px] items-center border-y border-border/60 bg-slate-100 px-2 text-[11px] font-bold text-foreground"
        >
          对象
        </div>,
        <div
          key={`log-${index}-body`}
          className="ml-[56px] mr-2 flex flex-col gap-1 border-b border-border/60 bg-slate-50 py-1"
        >
          {event.cards.map((card, cardIndex) => (
            <div key={cardIndex} className="flex min-w-0 items-center gap-2 px-2">
              <LogCardThumb card={card} width={40} height={58} />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground/90">
                {nameOf(card)}
              </span>
              <MdLocationIcon card={card} size={30} />
            </div>
          ))}
        </div>
      )
      return
    }

    if (event.kind === 'attack') {
      rows.push(
        <div
          key={`log-${index}`}
          className="flex h-[64px] items-center gap-2 border-b border-border/30 px-2"
        >
          <LogCardThumb card={event.attacker} />
          <span className="shrink-0 text-[10px] font-bold text-foreground">攻击</span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground/90">
            {nameOf(event.attacker)} → {event.defender ? nameOf(event.defender) : '直接攻击'}
          </span>
          {event.defender ? (
            <ZonePair from={event.attacker} to={event.defender} />
          ) : (
            <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">
              {zoneLabel(event.attacker)}
            </span>
          )}
        </div>
      )
      return
    }

    if (event.kind === 'attack-disabled') {
      rows.push(
        <Band key={`log-${index}`} tone="danger" card={event.card}>
          攻击被无效{event.card ? ` · ${nameOf(event.card)}` : ''}
        </Band>
      )
      return
    }

    if (event.kind === 'draw') {
      const names = event.cards
        .map((card) => (card.code > 0 ? card.name || resolveCardName(card.code) : ''))
        .filter(Boolean)
      rows.push(
        <div key={`log-${index}`} className="flex h-[26px] items-center gap-1.5 px-2 text-[10px]">
          <span
            className={cn('font-bold', event.player === 0 ? 'text-[#63b3ff]' : 'text-[#ff7b7b]')}
          >
            {sideName(event.player)}
          </span>
          <span className="font-bold text-foreground">抽卡 ×{event.cards.length || 1}</span>
          <span className="min-w-0 truncate text-muted-foreground">
            {names.length > 0 ? names.join('、') : '未知卡片'}
          </span>
        </div>
      )
      return
    }

    if (event.kind === 'damage') {
      rows.push(
        <div
          key={`log-${index}`}
          className="flex h-[26px] items-center gap-1.5 px-2 text-[10px] font-semibold"
          style={{ color: MDLOG_COLORS.damage }}
        >
          <span>{sideName(event.player)}受到</span>
          <span className="font-mono text-[12px]">-{event.value}</span>
          <span>LP</span>
          <span className="font-mono text-[10px] text-muted-foreground">→ {event.lp}</span>
        </div>
      )
      return
    }

    if (event.kind === 'recover') {
      rows.push(
        <div
          key={`log-${index}`}
          className="flex h-[26px] items-center gap-1.5 px-2 text-[10px] font-semibold"
          style={{ color: MDLOG_COLORS.recover }}
        >
          <span>{sideName(event.player)}回复</span>
          <span className="font-mono text-[12px]">+{event.value}</span>
          <span>LP</span>
          <span className="font-mono text-[10px] text-muted-foreground">→ {event.lp}</span>
        </div>
      )
      return
    }

    if (event.kind === 'lp-update') {
      rows.push(
        <div
          key={`log-${index}`}
          className="flex h-[26px] items-center gap-1.5 px-2 text-[10px]"
          style={{ color: MDLOG_COLORS.gold }}
        >
          <span>{sideName(event.player)} LP →</span>
          <span className="font-mono text-[12px] font-bold">{event.lp}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            ({event.delta >= 0 ? '+' : ''}
            {event.delta})
          </span>
        </div>
      )
      return
    }

    if (event.kind === 'position') {
      rows.push(
        <div
          key={`log-${index}`}
          className="flex h-[26px] items-center gap-1.5 px-2 text-[10px] text-foreground/75"
        >
          <span className="font-bold text-foreground">{nameOf(event.card)}</span>
          <span>{POSITION_NAMES[event.fromPosition] ?? '？'}</span>
          <span className="text-muted-foreground/60">→</span>
          <span>{POSITION_NAMES[event.toPosition] ?? '？'}</span>
        </div>
      )
      return
    }

    if (event.kind === 'counter') {
      rows.push(
        <div
          key={`log-${index}`}
          className="flex h-[26px] items-center gap-1.5 px-2 text-[10px] text-violet-600"
        >
          <span>{event.remove ? '取除' : '放置'}</span>
          <span className="font-semibold">{resolveCounterName(event.counterType)}</span>
          <span className="font-mono">×{event.count}</span>
          <span className="min-w-0 truncate text-muted-foreground">· {nameOf(event.card)}</span>
        </div>
      )
      return
    }

    if (event.kind === 'reveal') {
      const source =
        event.source === 'hand' ? '公开手牌' : event.source === 'field' ? '公开盖卡' : '公开卡组'
      rows.push(
        <div key={`log-${index}`} className="flex h-[26px] items-center gap-1.5 px-2 text-[10px]">
          <span className="shrink-0 font-bold text-sky-600">{source}</span>
          <span className="min-w-0 truncate text-muted-foreground">
            {event.cards.map((card) => nameOf(card)).join('、')}
          </span>
        </div>
      )
      return
    }

    if (event.kind === 'swap') {
      rows.push(
        <div
          key={`log-${index}`}
          className="flex h-[26px] items-center gap-1.5 px-2 text-[10px] text-muted-foreground"
        >
          <span className="font-bold text-foreground/85">交换</span>
          <span className="min-w-0 truncate">
            {nameOf(event.from)} ↔ {nameOf(event.to)}
          </span>
        </div>
      )
      return
    }

    if (event.kind === 'text') {
      rows.push(
        <Band key={`log-${index}`} tone="header">
          {event.text}
        </Band>
      )
    }
  })

  if (rows.length === 0) return null
  return <div className="flex flex-col">{rows}</div>
}
