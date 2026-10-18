import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ATTRIBUTE_NAMES,
  CardPosition,
  CdbCard,
  COUNTER_DEFINITIONS,
  LOCATION_NAMES,
  RACE_NAMES
} from '@shared/index'
import type { Answer, EngineRequest, RequestCard, RequestData } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useSelectionStore } from '../../stores/useSelectionStore'
import {
  cancelSelection,
  deriveSelection,
  requestCardKey,
  submitSelection
} from '../../utils/duelSelection'
import { fetchCardDataByCodes } from '../../utils/cardData'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Minus,
  Plus,
  Search,
  Sparkles,
  Swords,
  X
} from 'lucide-react'

type DataOf<K extends RequestData['kind']> = Extract<RequestData, { kind: K }>

/** ygopro-core 攻击宣言：可直接攻击且场上存在可选目标时，先询问 SelectYesNo(desc=31) */
const DIRECT_ATTACK_YESNO_DESC = 31

function submitAnswer(answer: Answer): void {
  void useDuelEngineStore.getState().submitAnswer(answer)
}

/**
 * 卡密 → cdb 卡片数据。
 * 优先使用棋盘上已有的同 code 卡（零 IPC）；找不到的再用 getCardsByIds 批量补。
 */
function useCardMeta(cards: RequestCard[]): Record<number, CdbCard> {
  const storeCards = useDuelStore((s) => s.state.cards)
  const codes = useMemo(
    () => Array.from(new Set(cards.map((c) => c.code).filter((code) => code > 0))),
    [cards]
  )
  const localMap = useMemo(() => {
    const map: Record<number, CdbCard> = {}
    for (const code of codes) {
      const hit = storeCards.find((c) => c.code === code && c.card)
      if (hit?.card) map[code] = hit.card
    }
    return map
  }, [codes, storeCards])

  const requestedRef = useRef<Set<number>>(new Set())
  const [remoteMap, setRemoteMap] = useState<Record<number, CdbCard>>({})

  useEffect(() => {
    const missing = codes.filter((code) => !localMap[code] && !requestedRef.current.has(code))
    if (missing.length === 0) return
    for (const code of missing) requestedRef.current.add(code)
    let cancelled = false
    fetchCardDataByCodes(missing)
      .then((map) => {
        if (cancelled) return
        setRemoteMap((prev) => {
          const next = { ...prev }
          let changed = false
          for (const code of missing) {
            if (map[code] && !next[code]) {
              next[code] = map[code]
              changed = true
            }
          }
          return changed ? next : prev
        })
      })
      .catch(() => {
        for (const code of missing) requestedRef.current.delete(code)
      })
    return () => {
      cancelled = true
    }
  }, [codes, localMap])

  return useMemo(() => ({ ...remoteMap, ...localMap }), [remoteMap, localMap])
}

function cardNameOf(meta: Record<number, CdbCard>, code: number): string {
  return meta[code]?.name ?? (code > 0 ? `#${code}` : '未知卡片')
}

// ------------------------------------------------------------------ 通用外壳

interface RequestModalShellProps {
  title: string
  subtitle?: string
  width?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

const RequestModalShell: React.FC<RequestModalShellProps> = ({
  title,
  subtitle,
  width = 'max-w-md',
  children,
  footer
}) => (
  <div
    className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45 p-4 select-none animate-in fade-in"
    role="dialog"
    aria-modal="true"
  >
    <div
      className={cn(
        'flex max-h-[86vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 duration-100',
        width
      )}
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-border/70 bg-muted/40 px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="break-words text-sm font-bold leading-snug">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      {footer && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/70 bg-muted/30 px-3 py-2.5">
          {footer}
        </div>
      )}
    </div>
  </div>
)

// ------------------------------------------------------------------ 卡图选择

interface RequestCardTileProps {
  card: RequestCard
  meta: Record<number, CdbCard>
  selected?: boolean
  disabled?: boolean
  badge?: string
  onClick?: () => void
}

const RequestCardTile: React.FC<RequestCardTileProps> = ({
  card,
  meta,
  selected = false,
  disabled = false,
  badge,
  onClick
}) => {
  const name = cardNameOf(meta, card.code)
  const locationName = LOCATION_NAMES[card.location]
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      title={name}
      onClick={onClick}
      className={cn(
        'group flex w-[86px] shrink-0 flex-col items-center gap-1 rounded-lg border bg-background/60 p-1.5 text-center transition-all',
        onClick ? 'cursor-pointer' : 'cursor-default',
        selected
          ? 'border-primary ring-2 ring-primary/50 shadow-md'
          : 'border-border/70 hover:border-primary/60 hover:shadow-md',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <div className="relative h-[112px] w-[80px] overflow-hidden rounded border border-border/60 bg-black/30">
        <img
          src={getCardImageUrl(card.code, true)}
          alt={name}
          className="h-full w-full object-cover pointer-events-none"
          onError={(e) => {
            if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
              e.currentTarget.src = UNKNOWN_CARD_IMAGE
            }
          }}
        />
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/25">
            <Check className="h-6 w-6 text-primary-foreground drop-shadow" />
          </div>
        )}
        {badge && (
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <span className="w-full truncate text-[10px] leading-tight text-foreground/90">{name}</span>
      {locationName && (
        <span className="w-full truncate text-[9px] leading-none text-muted-foreground">
          {locationName}
        </span>
      )}
    </button>
  )
}

// ------------------------------------------------------------------ yesno

const YesNoRequestModal: React.FC<{ request: EngineRequest; data: DataOf<'yesno'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.card ? [data.card] : [])
  const card = data.card && data.card.code > 0 ? data.card : null
  const cardData = card ? meta[card.code] : undefined
  // 攻击宣言的「要直接攻击吗」：yes = 直接攻击，no = 进入攻击目标选择（card + descHint 549）
  const isDirectAttackPrompt = data.desc === DIRECT_ATTACK_YESNO_DESC

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle}
      width="max-w-sm"
      footer={
        isDirectAttackPrompt ? (
          <>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => submitAnswer({ kind: 'yesno', yes: false })}
            >
              <Crosshair />
              选择攻击对象
            </Button>
            <Button disabled={loading} onClick={() => submitAnswer({ kind: 'yesno', yes: true })}>
              <Swords />
              直接攻击
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => submitAnswer({ kind: 'yesno', yes: false })}
            >
              <X />否
            </Button>
            <Button disabled={loading} onClick={() => submitAnswer({ kind: 'yesno', yes: true })}>
              <Check />是
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {card && (
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/20 p-2">
            <img
              src={getCardImageUrl(card.code, true)}
              alt={cardNameOf(meta, card.code)}
              className="h-[106px] w-[76px] shrink-0 rounded border border-border/60 object-cover"
              onError={(e) => {
                if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                  e.currentTarget.src = UNKNOWN_CARD_IMAGE
                }
              }}
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground">{cardNameOf(meta, card.code)}</div>
              {cardData?.desc && (
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[10px] leading-relaxed text-muted-foreground">
                  {cardData.desc}
                </p>
              )}
            </div>
          </div>
        )}
        <p className="text-center text-xs font-medium text-foreground/90">
          {isDirectAttackPrompt
            ? '对方场上存在怪兽：直接攻击玩家，或选择一只怪兽作为攻击对象。'
            : '是否执行上述效果 / 操作？'}
        </p>
      </div>
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ option

const OptionRequestModal: React.FC<{ request: EngineRequest; data: DataOf<'option'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  return (
    <RequestModalShell title={request.title} subtitle={request.subtitle} width="max-w-lg">
      <div className="flex flex-col gap-2">
        {data.options.map((option, index) => (
          <Button
            key={`${option.code}-${index}`}
            variant="outline"
            disabled={loading}
            className="h-auto w-full justify-start whitespace-normal py-2.5 text-left text-xs leading-relaxed"
            onClick={() => submitAnswer({ kind: 'option', index })}
          >
            <span className="mr-1.5 shrink-0 font-bold text-muted-foreground">{index + 1}.</span>
            <span>{option.text ?? `选项 ${index + 1}（#${option.code}）`}</span>
          </Button>
        ))}
        {data.options.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">没有可选项</p>
        )}
      </div>
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ position

const POSITION_LABELS: Record<number, string> = {
  [CardPosition.FACEUP_ATTACK]: '表侧攻击',
  [CardPosition.FACEUP_DEFENSE]: '表侧守备',
  [CardPosition.FACEDOWN_DEFENSE]: '里侧守备',
  [CardPosition.FACEDOWN_ATTACK]: '里侧攻击'
}

const PositionRequestModal: React.FC<{
  request: EngineRequest
  data: DataOf<'position'>
}> = ({ request, data }) => {
  const loading = useDuelEngineStore((s) => s.loading)
  return (
    <RequestModalShell title={request.title} subtitle={request.subtitle} width="max-w-sm">
      <div className="grid grid-cols-2 gap-2">
        {data.positions.map((position) => (
          <Button
            key={position}
            variant="outline"
            disabled={loading}
            className="h-12 text-xs font-bold"
            onClick={() => submitAnswer({ kind: 'position', position })}
          >
            {POSITION_LABELS[position] ?? `表示形式 #${position}`}
          </Button>
        ))}
      </div>
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ announce

const ANNOUNCE_REQUIRED = 1

const AnnounceRequestModal: React.FC<{
  request: EngineRequest
  data: DataOf<'announce'>
}> = ({ request, data }) => {
  const loading = useDuelEngineStore((s) => s.loading)

  // race / attrib
  const [mask, setMask] = useState(0)
  // number
  const [number, setNumber] = useState<number | null>(null)
  // card
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<CdbCard[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [pickedCard, setPickedCard] = useState<CdbCard | null>(null)

  const requiredCount = Math.max(data.count || 0, ANNOUNCE_REQUIRED)

  const maskOptions = useMemo(() => {
    if (data.announceType !== 'race' && data.announceType !== 'attrib') return []
    const table = data.announceType === 'race' ? RACE_NAMES : ATTRIBUTE_NAMES
    const available = data.availableMask ?? 0
    return Object.entries(table)
      .map(([bit, label]) => ({ value: Number(bit), label }))
      .filter((entry) => available === 0 || (available & entry.value) !== 0)
  }, [data.announceType, data.availableMask])

  const selectedMaskOptions = maskOptions.filter((entry) => (mask & entry.value) !== 0)

  const toggleMask = (value: number): void => {
    setMask((current) => {
      if ((current & value) !== 0) return current & ~value
      const selectedCount = maskOptions.filter((entry) => (current & entry.value) !== 0).length
      if (selectedCount >= requiredCount) return current
      return current | value
    })
  }

  const doSearch = async (): Promise<void> => {
    const query = keyword.trim()
    if (!query || searching) return
    setSearching(true)
    setSearchError(null)
    try {
      const res = /^\d+$/.test(query)
        ? await window.api.searchCards({ code: Number(query) })
        : await window.api.searchCards({ keyword: query, searchDesc: true })
      setResults(res.cards.slice(0, 30))
    } catch {
      setResults([])
      setSearchError('搜索失败，请重试')
    } finally {
      setSearching(false)
    }
  }

  let canConfirm = false
  let announceValue = 0
  if (data.announceType === 'race' || data.announceType === 'attrib') {
    canConfirm = selectedMaskOptions.length === requiredCount
    announceValue = mask
  } else if (data.announceType === 'number') {
    canConfirm = number !== null
    announceValue = number ?? 0
  } else {
    canConfirm = pickedCard !== null
    announceValue = pickedCard?.id ?? 0
  }

  const confirmLabel =
    data.announceType === 'race'
      ? '宣言种族'
      : data.announceType === 'attrib'
        ? '宣言属性'
        : data.announceType === 'number'
          ? `宣言 ${number ?? ''}`
          : `宣言 ${pickedCard?.name ?? ''}`

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle}
      width={data.announceType === 'card' ? 'max-w-2xl' : 'max-w-lg'}
      footer={
        <Button
          disabled={loading || !canConfirm}
          onClick={() => submitAnswer({ kind: 'announce', value: announceValue })}
        >
          <Check />
          {confirmLabel}
        </Button>
      }
    >
      {(data.announceType === 'race' || data.announceType === 'attrib') && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-muted-foreground">
            已选 {selectedMaskOptions.length} / {requiredCount} 种
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {maskOptions.map((entry) => {
              const selected = (mask & entry.value) !== 0
              return (
                <Button
                  key={entry.value}
                  variant={selected ? 'default' : 'outline'}
                  disabled={loading}
                  className="h-9 text-xs"
                  onClick={() => toggleMask(entry.value)}
                >
                  {entry.label}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {data.announceType === 'number' && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {(data.numbers ?? []).map((value) => (
            <Button
              key={value}
              variant={number === value ? 'default' : 'outline'}
              disabled={loading}
              className="h-9 text-xs font-mono"
              onClick={() => setNumber(value)}
            >
              {value}
            </Button>
          ))}
          {(data.numbers ?? []).length === 0 && (
            <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
              引擎没有提供候选数字
            </p>
          )}
        </div>
      )}

      {data.announceType === 'card' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={keyword}
              placeholder="输入卡名 / 关键字搜索（纯数字按卡密搜索）"
              className="h-8 text-xs"
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doSearch()
              }}
            />
            <Button
              size="sm"
              className="h-8 shrink-0 text-xs"
              disabled={loading || searching || !keyword.trim()}
              onClick={() => void doSearch()}
            >
              <Search />
              {searching ? '搜索中' : '搜索'}
            </Button>
          </div>
          {(data.count || 1) > 1 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              引擎要求宣言 {data.count} 张卡，当前简化版一次只提交 1 张。
            </p>
          )}
          {searchError && <p className="text-[11px] text-destructive">{searchError}</p>}
          <div className="flex flex-wrap gap-2">
            {results.map((card) => {
              const selected = pickedCard?.id === card.id
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={loading}
                  onClick={() => setPickedCard(card)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border p-1.5 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                      : 'border-border/70 bg-background/60 hover:border-primary/60 hover:bg-muted/40'
                  )}
                >
                  <img
                    src={getCardImageUrl(card.id, true)}
                    alt={card.name}
                    className="h-14 w-10 shrink-0 rounded border border-border/60 object-cover"
                    onError={(e) => {
                      if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                        e.currentTarget.src = UNKNOWN_CARD_IMAGE
                      }
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-foreground">
                      {card.name}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-muted-foreground">
                      {card.desc}
                    </span>
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              )
            })}
            {!searching && results.length === 0 && !searchError && (
              <p className="w-full py-6 text-center text-xs text-muted-foreground">
                输入关键词搜索后选择要宣言的卡片
              </p>
            )}
          </div>
        </div>
      )}
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ counter

const CounterRequestModal: React.FC<{
  request: EngineRequest
  data: DataOf<'counter'>
}> = ({ request, data }) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.cards)
  const [counts, setCounts] = useState<number[]>(() => data.cards.map(() => 0))
  const total = counts.reduce((sum, count) => sum + count, 0)
  const counterName =
    COUNTER_DEFINITIONS.find((entry) => entry.id === data.counterType)?.name ??
    `指示物 #${data.counterType}`

  const maxOf = (index: number): number => {
    const own = data.cards[index]?.counterCount
    return Math.max(0, Math.min(own ?? data.counterCount, data.counterCount))
  }

  const setCount = (index: number, value: number): void => {
    setCounts((prev) => {
      const others = prev.reduce((sum, count, i) => (i === index ? sum : sum + count), 0)
      const capacity = Math.max(0, data.counterCount - others)
      const next = [...prev]
      next[index] = Math.max(0, Math.min(Math.trunc(value) || 0, maxOf(index), capacity))
      return next
    })
  }

  return (
    <RequestModalShell
      title={request.title}
      subtitle={`${counterName} · ${data.counterCount} 个`}
      width="max-w-xl"
      footer={
        <>
          <span className="mr-auto text-[11px] text-muted-foreground">
            已取除 {total} / {data.counterCount}
          </span>
          <Button
            disabled={loading || total !== data.counterCount}
            onClick={() =>
              submitAnswer({
                kind: 'counter',
                counters: data.cards
                  .map((card, index) => ({ card, count: counts[index] ?? 0 }))
                  .filter((entry) => entry.count > 0)
              })
            }
          >
            <Check />
            确认取除
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {data.cards.map((card, index) => {
          const max = maxOf(index)
          const count = counts[index] ?? 0
          return (
            <div
              key={`${card.controller}-${card.location}-${card.sequence}-${card.code}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/60 p-2"
            >
              <img
                src={getCardImageUrl(card.code, true)}
                alt={cardNameOf(meta, card.code)}
                className="h-[72px] w-[52px] shrink-0 rounded border border-border/60 object-cover"
                onError={(e) => {
                  if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                    e.currentTarget.src = UNKNOWN_CARD_IMAGE
                  }
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{cardNameOf(meta, card.code)}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">可取除 {max} 个</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={loading || count <= 0}
                  onClick={() => setCount(index, count - 1)}
                  aria-label="减少"
                >
                  <Minus />
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={max}
                  value={count}
                  disabled={loading}
                  className="h-8 w-14 text-center text-xs"
                  onChange={(e) => setCount(index, Number(e.target.value))}
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={loading || count >= max || total >= data.counterCount}
                  onClick={() => setCount(index, count + 1)}
                  aria-label="增加"
                >
                  <Plus />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ sum

const SumRequestModal: React.FC<{ request: EngineRequest; data: DataOf<'sum'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const allCards = useMemo(() => [...data.mustSelect, ...data.cards], [data.mustSelect, data.cards])
  const meta = useCardMeta(allCards)
  // S3：勾选状态与场上点选共用 useSelectionStore（请求切换时自动清空）
  const selectedKeys = useSelectionStore((s) => s.selectedKeys)
  const toggleSelected = useSelectionStore((s) => s.toggle)
  const derived = useMemo(() => deriveSelection(request), [request])

  const min = Math.max(0, data.min)
  const max = data.max > 0 ? data.max : data.cards.length
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const selectedCards = useMemo(
    () => data.cards.filter((card) => selectedKeySet.has(requestCardKey(card))),
    [data.cards, selectedKeySet]
  )
  const selectedSum = selectedCards.reduce((sum, card) => sum + (card.opParam ?? 0), 0)
  const mustSum = data.mustSelect.reduce((sum, card) => sum + (card.opParam ?? 0), 0)
  const hasOpParam = allCards.some((card) => card.opParam !== undefined)

  const ready = selectedCards.length >= min && selectedCards.length <= max

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle}
      width="max-w-2xl"
      footer={
        <>
          <span className="mr-auto text-[11px] text-muted-foreground">
            已选 {selectedCards.length} / {min === max ? min : `${min}~${max}`} 张
            {hasOpParam && ` · 合计 ${mustSum + selectedSum} / 目标 ${data.sumVal}`}
          </span>
          <Button
            disabled={loading || !ready}
            onClick={() => {
              if (derived) submitSelection(derived, selectedCards)
            }}
          >
            <Check />
            确认
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {data.mustSelect.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-muted-foreground">必定选择</span>
            <div className="flex flex-wrap gap-2">
              {data.mustSelect.map((card, index) => (
                <RequestCardTile
                  key={`must-${index}-${card.code}`}
                  card={card}
                  meta={meta}
                  badge="必选"
                  selected
                />
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {data.cards.map((card, index) => (
            <RequestCardTile
              key={`${card.controller}-${card.location}-${card.sequence}-${card.code}-${index}`}
              card={card}
              meta={meta}
              selected={selectedKeySet.has(requestCardKey(card))}
              disabled={loading}
              onClick={() => toggleSelected(card)}
            />
          ))}
        </div>
        {data.cards.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">没有可选择的卡片</p>
        )}
      </div>
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ sort

const SortRequestModal: React.FC<{ request: EngineRequest; data: DataOf<'sort'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.cards)
  const [order, setOrder] = useState<number[]>(() => data.cards.map((_, index) => index))

  const move = (position: number, delta: number): void => {
    const target = position + delta
    if (target < 0 || target >= order.length) return
    setOrder((current) => {
      const next = [...current]
      const [item] = next.splice(position, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle ?? '从上到下为返回顺序'}
      width="max-w-lg"
      footer={
        <>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => submitAnswer({ kind: 'sort', cards: null })}
          >
            不排序
          </Button>
          <Button
            disabled={loading}
            onClick={() =>
              submitAnswer({
                kind: 'sort',
                cards: order.map((index) => data.cards[index])
              })
            }
          >
            <Check />
            确认顺序
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        {order.map((cardIndex, position) => {
          const card = data.cards[cardIndex]
          return (
            <div
              key={`${cardIndex}-${card.code}-${card.controller}-${card.location}-${card.sequence}`}
              className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/60 p-1.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                {position + 1}
              </span>
              <img
                src={getCardImageUrl(card.code, true)}
                alt={cardNameOf(meta, card.code)}
                className="h-11 w-8 shrink-0 rounded border border-border/60 object-cover"
                onError={(e) => {
                  if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                    e.currentTarget.src = UNKNOWN_CARD_IMAGE
                  }
                }}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                {cardNameOf(meta, card.code)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={loading || position === 0}
                  onClick={() => move(position, -1)}
                  aria-label="上移"
                >
                  <ChevronUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={loading || position === order.length - 1}
                  onClick={() => move(position, 1)}
                  aria-label="下移"
                >
                  <ChevronDown />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ rps

const RPS_OPTIONS = [
  { hand: 'rock', label: '石头', emoji: '✊' },
  { hand: 'scissors', label: '剪刀', emoji: '✌️' },
  { hand: 'paper', label: '布', emoji: '✋' }
] as const

const RpsRequestModal: React.FC<{ request: EngineRequest }> = ({ request }) => {
  const loading = useDuelEngineStore((s) => s.loading)
  return (
    <RequestModalShell title={request.title} subtitle={request.subtitle} width="max-w-sm">
      <div className="grid grid-cols-3 gap-2">
        {RPS_OPTIONS.map((option) => (
          <Button
            key={option.hand}
            variant="outline"
            disabled={loading}
            className="h-24 flex-col gap-1.5 text-sm font-bold"
            onClick={() => submitAnswer({ kind: 'rps', hand: option.hand })}
          >
            <span className="text-3xl leading-none">{option.emoji}</span>
            {option.label}
          </Button>
        ))}
      </div>
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ chain

const ChainRequestModal: React.FC<{ request: EngineRequest; data: DataOf<'chain'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.chains)
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle ?? (data.forced ? '存在必须发动的效果' : '选择要连锁发动的卡')}
      width="max-w-lg"
      footer={
        <>
          <Button
            variant="destructive"
            disabled={loading || data.forced}
            title={data.forced ? '存在强制发动的效果，不能放弃连锁' : undefined}
            onClick={() => submitAnswer({ kind: 'chain', card: null })}
          >
            放弃连锁
          </Button>
          <Button
            disabled={loading || selected === null}
            onClick={() =>
              selected !== null && submitAnswer({ kind: 'chain', card: data.chains[selected] })
            }
          >
            <Check />
            发动连锁
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        {data.chains.map((card, index) => {
          const active = selected === index
          return (
            <button
              key={`${card.controller}-${card.location}-${card.sequence}-${card.code}-${card.desc ?? '0'}-${index}`}
              type="button"
              disabled={loading}
              onClick={() => setSelected(index)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border p-1.5 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                  : 'border-border/70 bg-background/60 hover:border-primary/60 hover:bg-muted/40'
              )}
            >
              <img
                src={getCardImageUrl(card.code, true)}
                alt={cardNameOf(meta, card.code)}
                className="h-[72px] w-[52px] shrink-0 rounded border border-border/60 object-cover"
                onError={(e) => {
                  if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                    e.currentTarget.src = UNKNOWN_CARD_IMAGE
                  }
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">
                  {cardNameOf(meta, card.code)}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {LOCATION_NAMES[card.location] ?? '未知区域'}
                </span>
              </span>
              {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          )
        })}
        {data.chains.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">没有可以连锁发动的卡片</p>
        )}
      </div>
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ card / tribute

const CardSelectRequestModal: React.FC<{
  request: EngineRequest
  data: DataOf<'card'> | DataOf<'tribute'>
}> = ({ request, data }) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.cards)
  // S3：勾选状态与场上点选共用 useSelectionStore（请求切换时自动清空）
  const selectedKeys = useSelectionStore((s) => s.selectedKeys)
  const toggleSelected = useSelectionStore((s) => s.toggle)
  const derived = useMemo(() => deriveSelection(request), [request])

  const min = Math.max(0, data.min)
  const max = data.max > 0 ? data.max : data.cards.length
  const unit = data.kind === 'tribute' ? '只' : '张'
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const selectedCards = useMemo(
    () => data.cards.filter((card) => selectedKeySet.has(requestCardKey(card))),
    [data.cards, selectedKeySet]
  )
  const ready = selectedCards.length >= min && selectedCards.length <= max

  const submit = (): void => {
    if (derived && derived.kind !== 'unselect') submitSelection(derived, selectedCards)
  }

  const cancel = (): void => {
    if (derived) cancelSelection(derived)
  }

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle ?? `请选择 ${min === max ? min : `${min}~${max}`} ${unit}`}
      width="max-w-3xl"
      footer={
        <>
          <span className="mr-auto text-[11px] text-muted-foreground">
            已选 {selectedCards.length} / {min === max ? min : `${min}~${max}`} {unit}
          </span>
          {data.cancelable && (
            <Button variant="destructive" disabled={loading} onClick={cancel}>
              取消
            </Button>
          )}
          <Button disabled={loading || !ready} onClick={submit}>
            <Check />
            {data.kind === 'tribute' ? '确认解放' : '确认'}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {data.cards.map((card, index) => (
          <RequestCardTile
            key={`${card.controller}-${card.location}-${card.sequence}-${card.code}-${index}`}
            card={card}
            meta={meta}
            selected={selectedKeySet.has(requestCardKey(card))}
            disabled={loading}
            onClick={() => toggleSelected(card)}
          />
        ))}
        {data.cards.length === 0 && (
          <p className="w-full py-8 text-center text-xs text-muted-foreground">没有可选择的卡片</p>
        )}
      </div>
    </RequestModalShell>
  )
}

// ------------------------------------------------------------------ 分发

/**
 * 引擎问答分发：一次只根据当前 pendingRequest 渲染一个交互面板。
 * idle/battle/place/disfield/unselect 由场上点选与底部条负责，这里不处理。
 */
export const DuelRequestModals: React.FC = () => {
  const request = useDuelEngineStore((s) => s.pendingRequest)
  if (!request) return null

  const data = request.data
  const key = request.id

  switch (data.kind) {
    case 'yesno':
      return <YesNoRequestModal key={key} request={request} data={data} />
    case 'option':
      return <OptionRequestModal key={key} request={request} data={data} />
    case 'position':
      return <PositionRequestModal key={key} request={request} data={data} />
    case 'announce':
      return <AnnounceRequestModal key={key} request={request} data={data} />
    case 'counter':
      return <CounterRequestModal key={key} request={request} data={data} />
    case 'sum': {
      // S3：候选全在场上/手牌 → 让位给场上点选 + DuelSelectionBar
      if (deriveSelection(request)?.mode === 'point') return null
      return <SumRequestModal key={key} request={request} data={data} />
    }
    case 'sort':
      return <SortRequestModal key={key} request={request} data={data} />
    case 'rps':
      return <RpsRequestModal key={key} request={request} />
    case 'chain':
      return <ChainRequestModal key={key} request={request} data={data} />
    case 'card':
    case 'tribute': {
      // S3：候选全在场上/手牌 → 让位给场上点选 + DuelSelectionBar
      if (deriveSelection(request)?.mode === 'point') return null
      return <CardSelectRequestModal key={key} request={request} data={data} />
    }
    case 'idle':
    case 'battle':
    case 'place':
    case 'disfield':
    case 'unselect':
      return null
  }
}
