import React from 'react'
import { Ban, Shuffle } from 'lucide-react'
import { CardLocation, DuelLogCardRef, Duelist, resolveCounterName } from '@shared/index'
import { CardThumb } from '../ui/CardThumb'
import { cn } from '../../lib/utils'
import { CARD_BACK_IMAGE } from '../../utils/cardImage'
import { resolveTeamLabel } from '../../utils/duelistNames'
import { MdLocationIcon } from './MdLocationIcon'
import { MDLOG_ASSETS, MDLOG_COLORS, maskStyle } from './mdpro3LogAssets'
import { cardLabel, sideName } from './stepLogFormat'
import type {
  StepLogAttackRow,
  StepLogBandRow,
  StepLogCounterRow,
  StepLogLpRow,
  StepLogOpeningDrawRow,
  StepLogRow,
  StepLogSingleRow,
  StepLogTargetRow,
  StepLogTextRow
} from './stepLogItems'
import targetedIcon from '../../assets/log/targeted.png'

interface StepLogRowsProps {
  rows: StepLogRow[]
  duelists: Duelist[] | undefined
}

function sameSlot(a: DuelLogCardRef, b: DuelLogCardRef): boolean {
  return a.controller === b.controller && a.location === b.location && a.sequence === b.sequence
}

function LogCardThumb({
  card,
  width = 34,
  height = 50
}: {
  card: DuelLogCardRef
  width?: number
  height?: number
}): React.JSX.Element {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[2px] border border-border/80 bg-muted shadow-xs"
      style={{ width, height }}
    >
      <CardThumb
        code={card.code > 0 ? card.code : undefined}
        name={cardLabel(card)}
        fallback={card.code > 0 ? undefined : CARD_BACK_IMAGE}
        nameClassName="text-[7px] leading-[8px]"
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
  const arrowOwner = to ?? from
  if (!arrowOwner) return null
  const showFrom = from !== undefined && (to === undefined || !sameSlot(from, to))
  const color = arrowOwner.controller === 0 ? MDLOG_COLORS.myArrow : MDLOG_COLORS.opArrow
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1">
      {showFrom && from && <MdLocationIcon card={from} size={24} />}
      {showFrom && to && (
        <span className="h-[17px] w-[34px]" style={maskStyle(MDLOG_ASSETS.arrow, color)} />
      )}
      {to && <MdLocationIcon card={to} size={24} />}
    </span>
  )
}

function SideBar({ player }: { player: 0 | 1 }): React.JSX.Element {
  return (
    <span
      className={cn(
        'pointer-events-none absolute inset-y-0 left-0 w-[3px]',
        player === 0 ? 'bg-blue-500/80' : 'bg-rose-500/80'
      )}
    />
  )
}

function CardRow({ row }: { row: StepLogSingleRow }): React.JSX.Element {
  const name = cardLabel(row.card)
  const showName = row.card.code > 0 || Boolean(row.card.name)
  const cost = row.variant === 'cost'
  const target = row.variant === 'target'
  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 border-b border-border/40 px-2 py-1.5 transition-colors hover:bg-muted/30',
        row.indented && 'pl-7',
        cost && 'bg-muted/40'
      )}
    >
      {!row.indented && !cost && <SideBar player={row.player} />}
      {showName && (
        <span
          className={cn(
            'truncate leading-tight text-foreground',
            target ? 'text-[10px] font-semibold' : 'text-[11px] font-bold'
          )}
        >
          {name}
        </span>
      )}
      <div className="flex min-w-0 items-end gap-2">
        <LogCardThumb card={row.card} width={target ? 28 : 34} height={target ? 41 : 50} />
        <div className="ml-auto flex min-w-0 flex-col items-end justify-end gap-0.5 pb-0.5">
          {row.label && (
            <span
              className={cn(
                'max-w-full truncate text-right text-[12px] font-bold leading-tight',
                cost ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              {row.label}
            </span>
          )}
          <ZonePair from={row.from} to={row.to} />
        </div>
      </div>
    </div>
  )
}

function AttackRow({
  row,
  duelists
}: {
  row: StepLogAttackRow
  duelists: Duelist[] | undefined
}): React.JSX.Element {
  const defenderName = row.defender
    ? cardLabel(row.defender)
    : (row.targetName ?? resolveTeamLabel({ duelists }, row.targetPlayer, row.turn))
  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 border-b border-border/40 px-2 py-1.5 transition-colors hover:bg-muted/30',
        row.indented && 'pl-7'
      )}
    >
      {!row.indented && <SideBar player={row.player} />}
      <span className="truncate text-[11px] font-bold leading-tight text-foreground">
        {cardLabel(row.attacker)}
      </span>
      <div className="flex min-w-0 items-end gap-2">
        <LogCardThumb card={row.attacker} />
        <div className="ml-auto flex min-w-0 flex-col items-end justify-end gap-0.5 pb-1">
          <span className="text-[12px] font-bold leading-tight text-foreground">攻击</span>
          <span className="max-w-full truncate text-right text-[10px] text-muted-foreground">
            {row.direct ? `直接攻击 · ${defenderName}` : `→ ${defenderName}`}
          </span>
          <ZonePair from={row.attacker} to={row.defender} />
        </div>
      </div>
    </div>
  )
}

function LpRow({
  row,
  duelists
}: {
  row: StepLogLpRow
  duelists: Duelist[] | undefined
}): React.JSX.Element {
  const loss = row.change < 0
  const name = resolveTeamLabel({ duelists }, row.player, row.turn) || sideName(row.player)
  return (
    <div
      className={cn(
        'relative flex items-center gap-1.5 border-b border-border/40 px-2 py-1 text-[10px] transition-colors hover:bg-muted/30',
        row.indented && 'pl-7'
      )}
    >
      {!row.indented && <SideBar player={row.player} />}
      <span className="min-w-0 truncate font-semibold text-foreground/90">{name}</span>
      <span className="shrink-0 text-muted-foreground">{row.reason}</span>
      <span
        className={cn(
          'shrink-0 font-mono text-[12px] font-bold tabular-nums',
          loss ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'
        )}
      >
        {row.change > 0 ? '+' : ''}
        {row.change}
      </span>
      <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        LP {row.total}
      </span>
    </div>
  )
}

function CounterRow({ row }: { row: StepLogCounterRow }): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 border-b border-border/40 px-2 py-1.5 transition-colors hover:bg-muted/30',
        row.indented && 'pl-7'
      )}
    >
      {!row.indented && <SideBar player={row.player} />}
      <span className="truncate text-[11px] font-bold leading-tight text-foreground">
        {cardLabel(row.card)}
      </span>
      <div className="flex min-w-0 items-end gap-2">
        <LogCardThumb card={row.card} width={28} height={41} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 pb-1 text-[10px]">
          <span
            className={cn(
              'font-mono font-bold',
              row.remove
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-violet-600 dark:text-violet-400'
            )}
          >
            {row.remove ? '-' : '+'}
            {row.count}
          </span>
          <span className="truncate">{resolveCounterName(row.counterType)}</span>
        </div>
        <ZonePair to={row.card} />
      </div>
    </div>
  )
}

function TargetRow({ row }: { row: StepLogTargetRow }): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'flex items-center gap-1.5 border-b border-border/50 bg-muted/40 px-2 py-1 text-[10px] font-bold text-foreground',
          row.indented && 'pl-7'
        )}
      >
        <img src={targetedIcon} alt="" className="h-3 w-3 shrink-0 opacity-80" />
        <span>对象</span>
      </div>
      {row.cards.map((card, index) => (
        <CardRow
          key={`${card.code}-${card.controller}-${card.location}-${card.sequence}-${index}`}
          row={{
            kind: 'single',
            card,
            to: card,
            label: '',
            indented: true,
            variant: 'target',
            player: card.controller
          }}
        />
      ))}
    </div>
  )
}

function OpeningDrawRow({ row }: { row: StepLogOpeningDrawRow }): React.JSX.Element {
  const hand: DuelLogCardRef = {
    code: 0,
    controller: row.player,
    location: CardLocation.HAND,
    sequence: 0
  }
  const cards = row.cards.length > 0 ? row.cards : [{ code: 0 }]
  return (
    <div className="border-b border-border/40 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-foreground">抽卡</span>
        <span className="text-[10px] text-muted-foreground">×{cards.length}</span>
        <span className="ml-auto">
          <MdLocationIcon card={hand} size={24} />
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-start gap-1">
        {cards.map((card, index) => (
          <LogCardThumb
            key={`${card.code}-${index}`}
            card={{
              code: card.code,
              name: card.name,
              controller: row.player,
              location: CardLocation.HAND,
              sequence: index
            }}
            width={30}
            height={44}
          />
        ))}
      </div>
    </div>
  )
}

function TextRow({ row }: { row: StepLogTextRow }): React.JSX.Element {
  const danger = row.tone === 'danger'
  const targeted = row.text.startsWith('对象')
  const shuffle = row.text.includes('手牌切洗')
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 border-b border-border/40 px-2 py-1 text-[10px]',
        row.indented && 'pl-7',
        danger ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
      )}
    >
      {targeted && <img src={targetedIcon} alt="" className="h-3 w-3 shrink-0 opacity-80" />}
      {shuffle && <Shuffle className="h-3 w-3 shrink-0" />}
      {danger && <Ban className="h-3 w-3 shrink-0" />}
      <span className="min-w-0 truncate">{row.text}</span>
    </div>
  )
}

function ChainBand({ row }: { row: StepLogBandRow }): React.JSX.Element {
  return (
    <div className="flex h-[30px] items-center gap-2 border-b border-border/40 bg-muted/70 px-2 text-[10px] font-semibold text-foreground">
      <span className="relative h-[22px] w-[22px] shrink-0">
        <img
          src={MDLOG_ASSETS.chain}
          alt=""
          className="h-full w-full opacity-80 invert dark:invert-0"
        />
        {row.count !== undefined && row.count > 0 && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
            {row.count}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{row.text}</span>
      {row.card && <LogCardThumb card={row.card} width={22} height={28} />}
    </div>
  )
}

function BandRow({ row }: { row: StepLogBandRow }): React.JSX.Element {
  if (row.tone === 'chain' || row.tone === 'solve') return <ChainBand row={row} />
  const cost = row.tone === 'cost'
  return (
    <div
      className={cn(
        'flex h-[26px] items-center gap-2 border-b border-border/40 px-2 text-[10px] font-semibold',
        cost ? 'bg-muted/50 text-muted-foreground' : 'bg-muted/30 text-muted-foreground'
      )}
    >
      <span className="min-w-0 flex-1 truncate">{row.text}</span>
    </div>
  )
}

export const StepLogRows: React.FC<StepLogRowsProps> = ({ rows, duelists }) => (
  <div className="flex flex-col">
    {rows.map((row, index) => {
      if (row.kind === 'single') return <CardRow key={index} row={row} />
      if (row.kind === 'attack') {
        return <AttackRow key={index} row={row} duelists={duelists} />
      }
      if (row.kind === 'lp') return <LpRow key={index} row={row} duelists={duelists} />
      if (row.kind === 'counter') return <CounterRow key={index} row={row} />
      if (row.kind === 'target') return <TargetRow key={index} row={row} />
      if (row.kind === 'opening-draw') return <OpeningDrawRow key={index} row={row} />
      if (row.kind === 'text') return <TextRow key={index} row={row} />
      return <BandRow key={index} row={row} />
    })}
  </div>
)
