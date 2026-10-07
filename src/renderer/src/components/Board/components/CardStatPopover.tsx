import React, { useState, useEffect, useRef } from 'react'
import {
  FieldCard,
  CardUtils,
  CardLocation,
  resolveCounterName,
  COUNTER_DEFINITIONS,
  isInfiniteVal,
  INFINITY_VALUE
} from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { deduceSuggestedCounters } from '../../../utils/counterDeduce'
import {
  parseLpExpression,
  detectCurrentOp,
  switchOperator,
  LpOperator
} from '../../../utils/lpMath'
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
import {
  Plus,
  Minus,
  RotateCcw,
  Trash2,
  X,
  Pencil,
  Swords,
  Shield,
  GripHorizontal,
  Loader2
} from 'lucide-react'
import { useTokenStore, matchTokensByDesc } from '../../../stores/useTokenStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../../utils/cardImage'
import { cn } from '../../../lib/utils'

/** 四则运算与直接修改按钮配置 (与生命值输入面板完全一致) */
const OP_BUTTONS: {
  op: LpOperator
  label: string
  activeClass: string
}[] = [
  { op: '-', label: '- 减', activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm' },
  { op: '+', label: '+ 加', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm' },
  { op: '/', label: '÷ 除', activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm' },
  { op: '*', label: '× 乘', activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm' },
  {
    op: '=',
    label: '= 改',
    activeClass: 'border-border bg-background text-foreground'
  },
  {
    op: 'inf',
    label: '无限',
    activeClass:
      'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900 border-transparent shadow-sm'
  }
]

/**
 * 单项攻守数值输入组件 (与生命值输入器完全一致)：
 * - 纯净数字输入框，聚焦时浮出与生命值相同的加减乘除四则运算面板，支持设为无限
 * - 包含运算符选择条 [- 减] [+ 加] [÷ 除] [× 乘] [= 改] [无限]
 * - 包含实时算式解析状态与计算预览 (如 直接设为 1500 → 1500 ATK，或 → 无限 ATK)
 * - 独立单项复原原本数值按钮 (纯刷新小图标，无冗余文字，不重叠)
 * - 无任何多余固定数值按钮
 */
interface StatCalculatorRowProps {
  label: 'ATK' | 'DEF'
  icon: React.ReactNode
  origVal: number
  currentVal: number
  isModified: boolean
  onCommit: (val: number | undefined) => void
}

const StatCalculatorRow: React.FC<StatCalculatorRowProps> = ({
  label,
  icon,
  origVal,
  currentVal,
  isModified,
  onCommit
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isCommittingRef = useRef(false)

  const isInf = isInfiniteVal(currentVal)
  const diff = isModified ? (isInf ? Infinity : currentVal - origVal) : 0
  const displayValue = isFocused ? text : isInf ? '无限' : String(currentVal)
  const parseResult = parseLpExpression(displayValue, currentVal)
  const activeOp = detectCurrentOp(displayValue)

  // 保证 textRef 始终同步最新的 displayValue，防止闭包陈旧
  const textRef = useRef(displayValue)
  useEffect(() => {
    textRef.current = displayValue
  }, [displayValue])

  const commitValue = (targetVal: number | undefined): void => {
    if (isCommittingRef.current) return
    isCommittingRef.current = true

    onCommit(targetVal)
    setIsFocused(false)
    inputRef.current?.blur()

    setTimeout(() => {
      isCommittingRef.current = false
    }, 120)
  }

  const handleCommit = (): void => {
    if (isCommittingRef.current) return
    const parsed = parseLpExpression(textRef.current, currentVal)
    if (parsed.valid) {
      const nextVal = Math.max(0, parsed.result)
      commitValue(nextVal === origVal ? undefined : nextVal)
    } else {
      setIsFocused(false)
      inputRef.current?.blur()
    }
  }

  const handleCancel = (): void => {
    setIsFocused(false)
    inputRef.current?.blur()
  }

  return (
    <div className="relative flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30 border border-border/50">
      {/* 左侧：标签、图标与变动差值 (独立区域，避免与右侧按钮挤压) */}
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

      {/* 右侧：单项独立一键复原按钮 (纯刷新图标，不带文字) + 纯净四则运算输入框 */}
      <div className="flex items-center gap-1.5 relative shrink-0">
        {/* 单独一键复原该属性原本数值 (仅恢复当前这一项) */}
        {isModified && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => commitValue(undefined)}
            title={`恢复原本${label} (${origVal === -2 ? '?' : origVal})`}
            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* 纯净数字输入框 */}
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          value={displayValue}
          onFocus={(e) => {
            setIsFocused(true)
            const initialText = isInf ? '无限' : String(currentVal)
            setText(initialText)
            textRef.current = initialText
            e.currentTarget.select()
          }}
          onBlur={() => {
            handleCommit()
          }}
          onChange={(e) => {
            setText(e.target.value)
            textRef.current = e.target.value
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCommit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              handleCancel()
            }
          }}
          className={cn(
            'w-16 h-6 rounded border border-border/70 bg-background text-right font-mono font-bold text-xs px-1.5 select-all text-foreground',
            'focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors',
            isInf && !isFocused && 'font-bold text-xs',
            isFocused &&
              parseResult.valid &&
              parseResult.result !== currentVal &&
              'border-blue-400/80 bg-blue-500/5'
          )}
          title={`点击修改${label}：当前为 ${isInf ? '无限' : currentVal}。直接输入数值或四则运算 (如 +500, /2, *2, inf, 无限)`}
        />

        {/* 聚焦时浮出的四则运算选择面板与实时算式预览 (与生命值输入完全一致) */}
        {isFocused && (
          <div
            onMouseDown={(e) => e.preventDefault()} // 阻止失焦，允许连贯点击运算符
            className="absolute top-full right-0 mt-1 z-50 bg-popover/95 text-popover-foreground border border-border/80 shadow-2xl rounded-lg p-2.5 flex flex-col gap-2 backdrop-blur-md min-w-[264px] select-none animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {/* 四则运算选择条 (减 / 加 / 除 / 乘 / 直接改 / 无限) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium px-0.5">
                <span>选择运算模式</span>
                <span>输入数值或键入 inf</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {OP_BUTTONS.map((btn) => (
                  <button
                    key={btn.op}
                    type="button"
                    onClick={() => {
                      if (btn.op === 'inf') {
                        setText('无限')
                        textRef.current = '无限'
                        commitValue(INFINITY_VALUE)
                        return
                      } else {
                        const nextText = switchOperator(displayValue, btn.op, currentVal)
                        setText(nextText)
                        textRef.current = nextText
                      }
                      inputRef.current?.focus()
                      setTimeout(() => {
                        if (inputRef.current) {
                          const len = inputRef.current.value.length
                          inputRef.current.setSelectionRange(len, len)
                        }
                      }, 0)
                    }}
                    className={cn(
                      'py-1 text-[11px] font-mono font-semibold rounded border transition-colors flex items-center justify-center whitespace-nowrap',
                      activeOp === btn.op
                        ? btn.activeClass
                        : 'border-border/60 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                    title={`切换为 ${btn.label} 模式`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 实时算式解析状态 */}
            <div className="flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded bg-muted/60 border border-border/40">
              <span
                className="text-muted-foreground truncate max-w-[125px]"
                title={parseResult.formula}
              >
                {parseResult.formula}
              </span>
              <span
                className={cn(
                  'font-bold shrink-0 ml-1.5',
                  parseResult.valid ? 'text-foreground' : 'text-muted-foreground text-[11px]'
                )}
              >
                {parseResult.valid
                  ? `→ ${isInfiniteVal(parseResult.result) ? '无限' : parseResult.result} ${label}`
                  : '等待输入'}
              </span>
            </div>

            {/* 交互提示与快捷操作按钮 */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-2">
              <span className="text-[10px] text-muted-foreground/75 truncate">
                输入后按 Enter 或点击确定
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-2 py-0.5 text-[10px] rounded border border-border/60 hover:bg-muted text-muted-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={!parseResult.valid}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-bold rounded shadow-xs transition-colors',
                    parseResult.valid
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                  )}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 棋盘全局独立实战属性与指示物自由拖拽操作面板
 * - 独立单例：挂载于顶层，无论卡片在棋盘上如何拖动移动，面板均保持独立稳定，绝不随卡牌乱跳！
 * - 极致流畅手感：采用 GPU translate3d + requestAnimationFrame 调度，零顿挫感
 * - 指示物选择器：全智能推荐，场上不存在的指示物不显示
 * - 攻守数值：与生命值面板完全相同的加减乘除四则运算，无固定数值干扰，支持单项独立刷新图标复原
 */
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

  // 依据当前激活的卡片 ID 动态查找卡片信息 (卡片移动时数据依然实时同步)
  const card: FieldCard | undefined = state.cards.find(
    (c) => c.instanceId === activeStatPopoverCardId
  )

  const panelRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0
  })
  const currentDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const rafIdRef = useRef<number | null>(null)
  const [userSelectedCounterId, setUserSelectedCounterId] = useState<number | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customText, setCustomText] = useState('')
  const [customSuggestOpen, setCustomSuggestOpen] = useState(false)
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showCustomInput) customInputRef.current?.focus()
  }, [showCustomInput])

  const loadTokenCatalog = useTokenStore((s) => s.loadCatalog)
  const tokenCatalog = useTokenStore((s) => s.catalog)
  const isTokenCatalogLoading = useTokenStore((s) => s.isCatalogLoading)
  const pendingToken = useTokenStore((s) => s.pendingToken)
  const armToken = useTokenStore((s) => s.armToken)
  const cancelPendingToken = useTokenStore((s) => s.cancelPending)

  useEffect(() => {
    void loadTokenCatalog()
  }, [loadTokenCatalog])

  // 默认视口居中偏右位置
  const pos = statPopoverPosition || {
    x: Math.max(16, window.innerWidth / 2 + 100),
    y: Math.max(16, window.innerHeight / 2 - 150)
  }

  // 硬件加速拖拽处理 (requestAnimationFrame 调度，零 React re-render 损耗)
  const handleHeaderMouseDown = (e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest('button, input, select')) return
    e.preventDefault()
    e.stopPropagation()

    isDraggingRef.current = true
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y
    }
    currentDeltaRef.current = { dx: 0, dy: 0 }

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      if (!isDraggingRef.current) return
      moveEvent.preventDefault()
      const dx = moveEvent.clientX - dragStartRef.current.startX
      const dy = moveEvent.clientY - dragStartRef.current.startY
      currentDeltaRef.current = { dx, dy }

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        if (panelRef.current) {
          panelRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
        }
      })
    }

    const handleMouseUp = (): void => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)

      const finalX = Math.max(
        12,
        Math.min(dragStartRef.current.initX + currentDeltaRef.current.dx, window.innerWidth - 260)
      )
      const finalY = Math.max(
        12,
        Math.min(dragStartRef.current.initY + currentDeltaRef.current.dy, window.innerHeight - 380)
      )

      if (panelRef.current) {
        panelRef.current.style.transform = ''
      }
      setStatPopoverPosition({ x: finalX, y: finalY })

      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // 按 Esc 键关闭面板；有待放置衍生物时优先取消放置
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (useTokenStore.getState().pendingToken) cancelPendingToken()
        else closeStatPopover()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeStatPopover, cancelPendingToken])

  // 若无激活卡片，或卡片不在场上有效区域，则不渲染
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
  const cardName = cdb?.name || (card.code ? String(card.code) : '未知卡片')

  // 依本体卡效果文本推断可召唤的衍生物
  const suggestedTokens = tokenCatalog && cdb ? matchTokensByDesc(tokenCatalog, cdb) : []

  // 攻守数值定义
  const origAtk = cdb?.atk === -2 || !cdb ? 0 : cdb.atk
  const origDef = cdb?.def === -2 || !cdb ? 0 : cdb.def
  const effectiveAtk = card.customAtk !== undefined ? card.customAtk : origAtk
  const effectiveDef = card.customDef !== undefined ? card.customDef : origDef

  // 本场相关指示物智能提取 + 已注册的自定义指示物，合并为「可添加」候选 (排除本卡已挂载的)
  const customCounters = state.customCounters || {}
  const suggestedCounters = deduceSuggestedCounters(state)
  const activeCounterIds = new Set(
    Object.entries(card.counters || {})
      .filter(([, count]) => count > 0)
      .map(([id]) => Number(id))
  )
  const counterCandidates = [
    ...suggestedCounters,
    ...Object.entries(customCounters)
      .map(([idStr, name]) => ({
        id: Number(idStr),
        hex: `0x${Number(idStr).toString(16)}`,
        name
      }))
      .filter((c) => !suggestedCounters.some((s) => s.id === c.id))
  ].filter((c) => !activeCounterIds.has(c.id))

  const defaultCounterId = counterCandidates.length > 0 ? counterCandidates[0].id : null
  const selectedCounterId =
    userSelectedCounterId && counterCandidates.some((c) => c.id === userSelectedCounterId)
      ? userSelectedCounterId
      : defaultCounterId

  const currentSelectedDef = counterCandidates.find((c) => c.id === selectedCounterId)
  const currentSelectedName =
    currentSelectedDef?.name ||
    (selectedCounterId !== null
      ? resolveCounterName(selectedCounterId, customCounters)
      : '请选择指示物')

  // 指示物操作
  const activeCounters = Object.entries(card.counters || {})
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({
      id: Number(id),
      name: resolveCounterName(Number(id), customCounters),
      count
    }))

  const handleAddCounterById = (id: number | null): void => {
    if (id === null) return
    const current = (card.counters && card.counters[id]) || 0
    setCardCounter(card.instanceId, id, current + 1)
  }

  const customQuery = customText.trim()
  const customMatches = customSuggestOpen
    ? COUNTER_DEFINITIONS.filter((d) => d.name.includes(customQuery)).slice(0, 20)
    : []

  const handleAddCustom = (): void => {
    const name = customQuery
    if (!name) return
    const exact = COUNTER_DEFINITIONS.find((d) => d.name === name)
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
      {/* 1. 顶栏：可拖拽标题栏、卡名与关闭按钮 */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="flex items-center justify-between border-b border-border/60 pb-1.5 cursor-grab active:cursor-grabbing group/header"
        title="按住鼠标左键可随意拖动此面板位置"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/header:text-primary transition-colors shrink-0" />
          <Swords className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="font-bold text-xs truncate" title={cardName}>
            {cardName}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => closeStatPopover()}
          title="关闭 (Esc)"
          className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* 2. 攻守数值四则运算调节 (仅怪兽，与生命值调整完全一致，带单独一键复原，无固定数值) */}
      {isMonster && (
        <div className="flex flex-col gap-1.5">
          {/* ATK 调节 */}
          <StatCalculatorRow
            label="ATK"
            icon={<Swords className="w-3 h-3 text-rose-500 shrink-0" />}
            origVal={origAtk}
            currentVal={effectiveAtk}
            isModified={card.customAtk !== undefined}
            onCommit={(val) => setCardCustomStats(card.instanceId, val, card.customDef)}
          />

          {/* DEF 调节 (非连接怪兽) */}
          {!isLink && (
            <StatCalculatorRow
              label="DEF"
              icon={<Shield className="w-3 h-3 text-blue-500 shrink-0" />}
              origVal={origDef}
              currentVal={effectiveDef}
              isModified={card.customDef !== undefined}
              onCommit={(val) => setCardCustomStats(card.instanceId, card.customAtk, val)}
            />
          )}
        </div>
      )}

      {/* 3. 当前已挂载指示物列表 */}
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
                <span
                  className="font-semibold text-xs text-foreground truncate max-w-[110px]"
                  title={item.name}
                >
                  {item.name}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => setCardCounter(card.instanceId, item.id, item.count - 1)}
                    title="-1 指示物"
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
                    title="+1 指示物"
                    className="h-5 w-5"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeCardCounter(card.instanceId, item.id)}
                    title="移除该指示物"
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

        {/* 4. 添加指示物候选栏目 (智能推荐 + 自定义输入) */}
        <div className="flex items-center gap-1.5 mt-1">
          {counterCandidates.length > 1 ? (
            <Select
              value={String(selectedCounterId)}
              onValueChange={(val) => val && setUserSelectedCounterId(Number(val))}
            >
              <SelectTrigger size="sm" className="h-6 text-xs flex-1 bg-background">
                <SelectValue>{currentSelectedName}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
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
            title={selectedCounterId === null ? '暂无待添加指示物，请用右侧按钮自定义' : '添加该指示物'}
          >
            <Plus className="w-3 h-3" />
            <span>添加</span>
          </Button>

          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => setShowCustomInput((v) => !v)}
            className="h-6 w-6 shrink-0"
            title="自定义指示物（动漫卡等无官方代码者）"
          >
            <Pencil className="w-3 h-3" />
          </Button>
        </div>

        {/* 4b. 自定义指示物输入：标准指示物名称自动补全，其余自动分配 ID */}
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

      {/* 5. 衍生物布置：按本体卡效果文本智能推荐，点击后进入待放置态再点棋盘空怪兽区 */}
      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] text-foreground/90">
            <span>衍生物</span>
          </span>
          {pendingToken && (
            <Button
              variant="ghost"
              size="xs"
              onClick={cancelPendingToken}
              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive gap-1"
            >
              <X className="w-2.5 h-2.5" />
              <span>取消放置</span>
            </Button>
          )}
        </div>

        {isTokenCatalogLoading ? (
          <div className="h-6 flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>载入中...</span>
          </div>
        ) : suggestedTokens.length > 0 ? (
          <>
            {pendingToken && (
              <div className="text-[10px] text-emerald-500 px-0.5 leading-tight">
                已选中「{pendingToken.name}」，点击棋盘上的空怪兽区放下 (Esc 取消)
              </div>
            )}
            <div className="flex flex-col gap-1 max-h-[168px] overflow-y-auto">
              {suggestedTokens.map((token) => {
                const isArmed = pendingToken?.id === token.id
                return (
                  <button
                    key={token.id}
                    type="button"
                    onClick={() => armToken(token)}
                    className={cn(
                      'flex items-center gap-1.5 p-1 rounded border text-left transition-colors cursor-pointer',
                      isArmed
                        ? 'border-emerald-400/70 bg-emerald-500/10'
                        : 'border-border/50 bg-muted/40 hover:border-emerald-400/50 hover:bg-emerald-500/5'
                    )}
                  >
                    <img
                      src={getCardImageUrl(token.id, true)}
                      alt={token.name}
                      loading="lazy"
                      className="w-[22px] h-[32px] object-cover rounded shrink-0 border border-border/60 bg-black/40"
                      onError={(e) => {
                        const target = e.currentTarget
                        if (target.src !== CARD_BACK_IMAGE) target.src = CARD_BACK_IMAGE
                      }}
                    />
                    <span
                      className={cn(
                        'text-[11px] font-medium truncate',
                        isArmed ? 'text-emerald-500' : 'text-foreground/90'
                      )}
                    >
                      {token.name}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground/80 shrink-0">
                      {token.atk ?? 0}/{token.def ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="text-[10px] text-muted-foreground/70 py-0.5 italic">
            该卡效果文本未提及衍生物
          </div>
        )}
      </div>
    </div>
  )
}
