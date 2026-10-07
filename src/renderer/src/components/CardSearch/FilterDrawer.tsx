import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React from 'react'
import { SlidersHorizontal, RotateCcw, CheckSquare, Square, Search, Loader2 } from 'lucide-react'
import {
  CardType,
  CardAttribute,
  ATTRIBUTE_NAMES,
  CardRace,
  RACE_NAMES,
  CardPoolFilter,
  CardSearchFilterOptions,
  LimitFilter,
  LINK_MARKERS,
  NumericCompareOp
} from '@shared/index'
import { CardSearchFilters, useCardSearchStore } from '../../stores/useCardSearchStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { LinkMarkerPopover } from './LinkMarkerPopover'
import { EffectCategoryPopover } from './EffectCategoryPopover'
import { SORT_OPTIONS } from './sortOptions'
import { cn } from '../../lib/utils'

const NONE_LABEL = '（无）'

const MAIN_TYPES = [
  { label: NONE_LABEL, value: 0 },
  { label: '怪兽', value: CardType.MONSTER },
  { label: '魔法', value: CardType.SPELL },
  { label: '陷阱', value: CardType.TRAP }
]

/** 使用 YGOPro 的细分类型值：怪兽按位包含筛选，魔法/陷阱按完整类型精确匹配。 */
const MONSTER_SUB_TYPES = [
  { label: NONE_LABEL, value: 0 },
  { label: '通常怪兽', value: CardType.MONSTER | CardType.NORMAL },
  { label: '效果怪兽', value: CardType.MONSTER | CardType.EFFECT },
  { label: '融合怪兽', value: CardType.MONSTER | CardType.FUSION },
  { label: '仪式怪兽', value: CardType.MONSTER | CardType.RITUAL },
  { label: '同调怪兽', value: CardType.MONSTER | CardType.SYNCHRO },
  { label: '超量怪兽', value: CardType.MONSTER | CardType.XYZ },
  { label: '灵摆怪兽', value: CardType.MONSTER | CardType.PENDULUM },
  { label: '连接怪兽', value: CardType.MONSTER | CardType.LINK },
  { label: '特殊召唤怪兽', value: CardType.MONSTER | CardType.SPECIAL_SUMMON },
  { label: '调整', value: CardType.MONSTER | CardType.TUNER },
  { label: '通常调整', value: CardType.MONSTER | CardType.NORMAL | CardType.TUNER },
  { label: '通常灵摆', value: CardType.MONSTER | CardType.NORMAL | CardType.PENDULUM },
  { label: '同调调整', value: CardType.MONSTER | CardType.SYNCHRO | CardType.TUNER },
  { label: '灵摆调整', value: CardType.MONSTER | CardType.PENDULUM | CardType.TUNER },
  { label: '灵摆效果怪兽', value: CardType.MONSTER | CardType.PENDULUM | CardType.EFFECT },
  { label: '翻转怪兽', value: CardType.MONSTER | CardType.FLIP },
  { label: '灵摆翻转怪兽', value: CardType.MONSTER | CardType.PENDULUM | CardType.FLIP },
  { label: '灵魂怪兽', value: CardType.MONSTER | CardType.SPIRIT },
  { label: '同盟怪兽', value: CardType.MONSTER | CardType.UNION },
  { label: '二重怪兽', value: CardType.MONSTER | CardType.GEMINI },
  { label: '卡通怪兽', value: CardType.MONSTER | CardType.TOON },
  { label: '衍生物', value: CardType.MONSTER | CardType.TOKEN }
]

const SPELL_SUB_TYPES = [
  { label: NONE_LABEL, value: 0 },
  { label: '通常魔法', value: CardType.SPELL },
  { label: '速攻魔法', value: CardType.SPELL | CardType.QUICKPLAY },
  { label: '永续魔法', value: CardType.SPELL | CardType.CONTINUOUS },
  { label: '装备魔法', value: CardType.SPELL | CardType.EQUIP },
  { label: '场地魔法', value: CardType.SPELL | CardType.FIELD },
  { label: '仪式魔法', value: CardType.SPELL | CardType.RITUAL }
]

const TRAP_SUB_TYPES = [
  { label: NONE_LABEL, value: 0 },
  { label: '通常陷阱', value: CardType.TRAP },
  { label: '永续陷阱', value: CardType.TRAP | CardType.CONTINUOUS },
  { label: '反击陷阱', value: CardType.TRAP | CardType.COUNTER }
]

const OP_PREFIX: Record<NumericCompareOp, string> = {
  eq: '',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  unknown: '?'
}

const PREFIX_TO_OP: Record<string, NumericCompareOp> = {
  '>=': 'gte',
  '<=': 'lte',
  '>': 'gt',
  '<': 'lt',
  '=': 'eq'
}

function filterText(value: number | undefined, op: NumericCompareOp): string {
  if (op === 'unknown') return '?'
  if (value === undefined || Number.isNaN(value)) return ''
  return `${OP_PREFIX[op]}${value}`
}

function parseFilterText(
  text: string,
  allowUnknown: boolean
): { value: number | undefined; op: NumericCompareOp } {
  const raw = text.trim()
  if (raw === '') return { value: undefined, op: 'eq' }
  if (raw === '?') return { value: undefined, op: allowUnknown ? 'unknown' : 'eq' }
  const matched = /^(>=|<=|>|<|=)?\s*(-?\d+)$/.exec(raw)
  if (!matched) return { value: undefined, op: 'eq' }
  return { value: parseInt(matched[2], 10), op: PREFIX_TO_OP[matched[1] ?? '='] }
}

const LIMIT_OPTIONS: Array<{ value: LimitFilter; label: string }> = [
  { value: 0, label: '不限' },
  { value: 1, label: '禁止' },
  { value: 2, label: '限制' },
  { value: 3, label: '准限制' }
]

const NONE_VALUE = '__none__'
const LIMIT_VALUE_PREFIX = 'limit:'

/**
 * 赛区卡池选项。
 * ocg/tcg 判「可用」，ocgOnly/tcgOnly 判「独有」（对齐 YGOPro 的下拉四项）；
 * anime/rush/tf 按所属卡库标记判定，未加载对应标记的附加库时该项不显示。
 */
interface CardPoolOptionItem {
  value: CardPoolFilter
  label: string
  tag?: string
}

const CARD_POOL_OPTIONS: CardPoolOptionItem[] = [
  { value: 'any', label: '全部卡池' },
  { value: 'ocg', label: 'OCG' },
  { value: 'tcg', label: 'TCG' },
  { value: 'ocgOnly', label: 'OCG 独有' },
  { value: 'tcgOnly', label: 'TCG 独有' },
  { value: 'anime', label: '动漫/漫画', tag: 'anime' },
  { value: 'rush', label: '超速（Rush）', tag: 'rush' },
  { value: 'tf', label: '卡片力量（TF）', tag: 'tf' }
]

interface FilterFieldProps {
  label: string
  tooltip?: string
  disabled?: boolean
  labelClassName?: string
  className?: string
  children: React.ReactNode
}

/** YGOPro 式行内字段：左侧定宽标签，右侧控件依次排列 */
const FilterField: React.FC<FilterFieldProps> = ({
  label,
  tooltip,
  disabled,
  labelClassName,
  className,
  children
}) => {
  const labelNode = (
    <span
      className={cn(
        'w-9 shrink-0 whitespace-nowrap text-[11px] leading-none text-muted-foreground/90',
        disabled && 'opacity-50',
        labelClassName
      )}
    >
      {label}
    </span>
  )
  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger render={labelNode} />
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        labelNode
      )}
      {children}
    </div>
  )
}

interface NumericRowProps {
  label: string
  tooltip?: string
  op: NumericCompareOp
  value: number | undefined
  allowUnknown?: boolean
  disabled?: boolean
  className?: string
  inputClassName?: string
  onChange: (value: number | undefined, op: NumericCompareOp) => void
}

const NumericRow: React.FC<NumericRowProps> = ({
  label,
  tooltip,
  op,
  value,
  allowUnknown = false,
  disabled = false,
  className,
  inputClassName = 'h-7',
  onChange
}) => {
  const [draft, setDraft] = React.useState<string | null>(null)
  return (
    <FilterField label={label} tooltip={tooltip} disabled={disabled} className={className}>
      <Input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={draft ?? filterText(value, op)}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          const parsed = parseFilterText(next, allowUnknown)
          onChange(parsed.value, parsed.op)
        }}
        onBlur={() => setDraft(null)}
        className={cn(inputClassName, 'min-w-0 flex-1 px-1.5 text-xs')}
      />
    </FilterField>
  )
}

/** Link 怪兽没有守备力，切到 Link 条件时顺手清掉已填的 DEF 避免筛出空集 */
function clearDefIfLink(
  nextMarkers: number,
  nextSubType: number,
  nextType: number
): Pick<CardSearchFilters, 'def' | 'defOp'> | Record<string, never> {
  const isLink =
    nextSubType === (CardType.MONSTER | CardType.LINK) ||
    (nextType !== 0 && (nextType & CardType.LINK) !== 0) ||
    nextMarkers !== 0
  return isLink ? { def: undefined, defOp: 'eq' } : {}
}

interface FilterDrawerProps {
  /** drawer = 主窗口右侧滑出抽屉；band = 卡组编辑器顶部常驻横带（对齐 YGOPro wFilter） */
  variant?: 'drawer' | 'band'
  className?: string
  headerSlot?: React.ReactNode
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  variant = 'drawer',
  className,
  headerSlot
}) => {
  const isBand = variant === 'band'
  const controlH = isBand ? 'h-6' : 'h-7'
  const {
    keyword,
    isLoading,
    type,
    subType,
    attribute,
    race,
    level,
    levelOp,
    scale,
    scaleOp,
    effectCategoryMask,
    cardPool,
    markers,
    limitFilter,
    atk,
    atkOp,
    def,
    defOp,
    code,
    searchDesc,
    sortField,
    setKeyword,
    search,
    setFilters,
    resetFilters
  } = useCardSearchStore()

  const [localKw, setLocalKw] = React.useState<string>(keyword)
  const [markerOpen, setMarkerOpen] = React.useState<boolean>(false)
  const markerAnchorRef = React.useRef<HTMLButtonElement>(null)
  const [effectOpen, setEffectOpen] = React.useState<boolean>(false)
  const effectAnchorRef = React.useRef<HTMLButtonElement>(null)
  const runKeywordSearch = (): void => {
    const trimmed = localKw.trim()
    setKeyword(trimmed)
    void search({ keyword: trimmed })
  }

  const [filterOptions, setFilterOptions] = React.useState<CardSearchFilterOptions>({
    effectCategories: [],
    availablePools: []
  })

  React.useEffect(() => {
    let isActive = true
    const load = (): void => {
      window.api
        .getCardSearchFilterOptions()
        .then((options) => {
          if (isActive) setFilterOptions(options)
        })
        .catch((error) => console.error('[FilterDrawer] Failed to load filter labels:', error))
    }
    load()
    const unsubscribe = window.api.onCdbUpdated?.(load)
    return () => {
      isActive = false
      unsubscribe?.()
    }
  }, [])

  // 根据当前主种类动态获得子种类列表
  const currentSubTypes = React.useMemo(() => {
    if (type === CardType.SPELL) return SPELL_SUB_TYPES
    if (type === CardType.TRAP) return TRAP_SUB_TYPES
    return MONSTER_SUB_TYPES
  }, [type])

  const typeLabel = MAIN_TYPES.find((t) => t.value === type)?.label ?? NONE_LABEL
  const subTypeLabel = currentSubTypes.find((s) => s.value === subType)?.label ?? NONE_LABEL
  const attributeLabel = attribute !== 0 ? ATTRIBUTE_NAMES[attribute] : NONE_LABEL
  const raceLabel = race !== 0 ? RACE_NAMES[race] : NONE_LABEL
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortField)?.label ?? SORT_OPTIONS[0].label
  const cardPoolLabel =
    cardPool === 'any'
      ? '全部'
      : (CARD_POOL_OPTIONS.find((o) => o.value === cardPool)?.label ?? '全部')
  const limitLabel = LIMIT_OPTIONS.find((o) => o.value === limitFilter)?.label ?? '不限'
  const limitPoolValue =
    limitFilter !== 0
      ? `${LIMIT_VALUE_PREFIX}${limitFilter}`
      : cardPool === 'any'
        ? NONE_VALUE
        : cardPool
  const limitPoolLabel =
    limitFilter !== 0 ? limitLabel : cardPool === 'any' ? NONE_LABEL : cardPoolLabel
  const markerCount = LINK_MARKERS.filter((m) => (markers & m.mask) !== 0).length

  /**
   * 联动规则严格对齐 YGOPro 的 COMBOBOX_MAINTYPE 分支：
   * - 大类 = 全部种类：细分类型 / 属性 / 种族 / 等级 / 刻度 / 攻防 全部不可选
   * - 大类 = 魔法 / 陷阱：仅细分类型可选，其余全部不可选
   * - 大类 = 怪兽：全部可选
   * - 细分类型 = 连接：守备力不可选
   */
  const isAllTypes = type === 0
  const detailDisabled = isAllTypes || type === CardType.SPELL || type === CardType.TRAP
  const subTypeDisabled = isAllTypes

  const isLinkMonster = React.useMemo(() => {
    if (subType === (CardType.MONSTER | CardType.LINK)) return true
    if (type !== 0 && (type & CardType.LINK) !== 0) return true
    return markers !== 0
  }, [subType, type, markers])
  const defDisabled = detailDisabled || isLinkMonster

  const availablePools = React.useMemo(
    () => new Set(filterOptions.availablePools ?? []),
    [filterOptions.availablePools]
  )

  // 未加载对应标记附加库的卡池（动漫/漫画、超速、卡片力量）直接不显示
  const visiblePoolOptions = React.useMemo(
    () => CARD_POOL_OPTIONS.filter((o) => o.tag === undefined || availablePools.has(o.tag)),
    [availablePools]
  )

  // 卡库变化后若当前选中的卡池已不存在（该标记的附加库被移除/停用），回退到全部卡池
  React.useEffect(() => {
    const option = CARD_POOL_OPTIONS.find((o) => o.value === cardPool)
    if (option?.tag && !availablePools.has(option.tag)) {
      setFilters({ cardPool: 'any' })
    }
  }, [availablePools, cardPool, setFilters])

  const mainTypeTriggerClass = isBand
    ? `${controlH} w-[52px] shrink-0 gap-0.5 px-1 text-[11px] [&_svg]:size-3`
    : `${controlH} w-[60px] shrink-0 gap-0.5 px-2 text-xs`
  const subTypeTriggerClass = isBand
    ? `${controlH} min-w-0 flex-1 gap-0.5 px-1 text-[11px] [&_svg]:size-3`
    : `${controlH} min-w-0 flex-1 text-xs`

  const mainTypeField = (
    <FilterField label="种类：" className={isBand ? 'flex-1 min-w-0' : undefined}>
      <Select
        value={type}
        onValueChange={(val) => {
          const num = val ? Number(val) : 0
          setFilters({
            type: num,
            subType: 0,
            attribute: 0,
            race: 0,
            level: 0,
            scale: undefined,
            atk: undefined,
            def: undefined,
            defOp: 'eq',
            markers: 0
          })
        }}
      >
        <SelectTrigger size="sm" className={mainTypeTriggerClass}>
          <SelectValue>{typeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MAIN_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={subType}
        disabled={subTypeDisabled}
        onValueChange={(val) => {
          const num = val ? Number(val) : 0
          setFilters({ subType: num, ...clearDefIfLink(markers, num, type) })
        }}
      >
        <SelectTrigger size="sm" className={subTypeTriggerClass}>
          <SelectValue>{subTypeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {currentSubTypes.map((st) => (
            <SelectItem key={st.value} value={st.value}>
              {st.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )

  const limitField = (
    <FilterField label="禁限：" className={isBand ? 'flex-1 min-w-0' : undefined}>
      <Select
        value={limitPoolValue}
        onValueChange={(val) => {
          if (!val) {
            setFilters({ limitFilter: 0, cardPool: 'any' })
            return
          }
          if (val.startsWith(LIMIT_VALUE_PREFIX)) {
            setFilters({ limitFilter: Number(val.slice(LIMIT_VALUE_PREFIX.length)) as LimitFilter })
            return
          }
          setFilters({ cardPool: val as CardPoolFilter })
        }}
      >
        <SelectTrigger size="sm" className={`${controlH} min-w-0 flex-1 text-xs`}>
          <SelectValue>{limitPoolLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{NONE_LABEL}</SelectItem>
          {LIMIT_OPTIONS.filter((o) => o.value !== 0).map((o) => (
            <SelectItem
              key={`${LIMIT_VALUE_PREFIX}${o.value}`}
              value={`${LIMIT_VALUE_PREFIX}${o.value}`}
            >
              {o.label}
            </SelectItem>
          ))}
          {visiblePoolOptions
            .filter((o) => o.value !== 'any')
            .map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </FilterField>
  )

  const attributeField = (
    <FilterField
      label="属性："
      disabled={detailDisabled}
      className={isBand ? 'flex-1 min-w-0' : undefined}
    >
      <Select
        value={attribute}
        disabled={detailDisabled}
        onValueChange={(val) => setFilters({ attribute: val ? Number(val) : 0 })}
      >
        <SelectTrigger size="sm" className={`${controlH} min-w-0 flex-1 text-xs`}>
          <SelectValue>{attributeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={0}>{NONE_LABEL}</SelectItem>
          {Object.entries(CardAttribute).map(([key, val]) => (
            <SelectItem key={key} value={val}>
              {ATTRIBUTE_NAMES[val]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )

  const atkField = (
    <NumericRow
      label="攻击："
      op={atkOp}
      value={atk}
      onChange={(val, op) => setFilters({ atk: val, atkOp: op })}
      allowUnknown
      disabled={detailDisabled}
      className={isBand ? 'flex-1 min-w-0' : undefined}
      inputClassName={controlH}
    />
  )

  const raceField = (
    <FilterField
      label="种族："
      disabled={detailDisabled}
      className={isBand ? 'flex-1 min-w-0' : undefined}
    >
      <Select
        value={race}
        disabled={detailDisabled}
        onValueChange={(val) => setFilters({ race: val ? Number(val) : 0 })}
      >
        <SelectTrigger size="sm" className={`${controlH} min-w-0 flex-1 text-xs`}>
          <SelectValue>{raceLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={0}>{NONE_LABEL}</SelectItem>
          {Object.entries(CardRace).map(([key, val]) => (
            <SelectItem key={key} value={val}>
              {RACE_NAMES[val]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )

  const defField = (
    <NumericRow
      label="守备："
      op={defOp}
      value={def}
      onChange={(val, op) => setFilters({ def: val, defOp: op })}
      allowUnknown
      disabled={defDisabled}
      className={isBand ? 'flex-1 min-w-0' : undefined}
      inputClassName={controlH}
    />
  )

  const levelField = (
    <NumericRow
      label="星数："
      tooltip="等级 / 阶级 / 连接"
      op={levelOp}
      value={level !== 0 ? level : undefined}
      onChange={(val, op) => setFilters({ level: val ?? 0, levelOp: op })}
      disabled={detailDisabled}
      className={isBand ? 'flex-1 min-w-0' : undefined}
      inputClassName={controlH}
    />
  )

  const scaleField = (
    <NumericRow
      label="刻度："
      tooltip="灵摆刻度（左侧）"
      op={scaleOp}
      value={scale}
      onChange={(val, op) => setFilters({ scale: val, scaleOp: op })}
      disabled={detailDisabled}
      className={isBand ? 'flex-1 min-w-0' : undefined}
      inputClassName={controlH}
    />
  )

  const markerField = (
    <div className={cn('relative', isBand ? 'min-w-0 flex-1' : 'w-full')}>
      <button
        ref={markerAnchorRef}
        type="button"
        aria-pressed={markerCount > 0}
        onClick={() => setMarkerOpen((v) => !v)}
        className={cn(
          'rounded text-[11px] leading-none transition-colors disabled:pointer-events-none disabled:opacity-35 flex items-center justify-center px-2',
          `${controlH} w-full`,
          markerCount > 0
            ? 'bg-primary/20 text-primary font-semibold'
            : 'bg-neutral-500/10 text-muted-foreground hover:bg-neutral-500/25 hover:text-foreground'
        )}
      >
        连接标记
      </button>

      {markerOpen && (
        <LinkMarkerPopover
          value={markers}
          anchorRef={markerAnchorRef}
          onClose={() => setMarkerOpen(false)}
          onConfirm={(mask) => {
            setFilters({ markers: mask, ...clearDefIfLink(mask, subType, type) })
            setMarkerOpen(false)
          }}
        />
      )}
    </div>
  )

  const effectField = (
    <div className={cn('relative', isBand ? 'shrink-0 self-stretch' : 'w-full')}>
      <button
        ref={effectAnchorRef}
        type="button"
        aria-pressed={effectCategoryMask !== 0}
        onClick={() => setEffectOpen((v) => !v)}
        className={cn(
          'rounded text-[11px] leading-none transition-colors disabled:pointer-events-none disabled:opacity-35 flex items-center justify-center px-2',
          isBand ? 'h-full w-[92px] shrink-0' : 'h-7 w-full',
          effectCategoryMask !== 0
            ? 'bg-primary/20 text-primary font-semibold'
            : 'bg-neutral-500/10 text-muted-foreground hover:bg-neutral-500/25 hover:text-foreground'
        )}
      >
        效果
      </button>

      {effectOpen && (
        <EffectCategoryPopover
          categories={filterOptions.effectCategories}
          value={effectCategoryMask}
          anchorRef={effectAnchorRef}
          onClose={() => setEffectOpen(false)}
          onConfirm={(mask) => {
            setFilters({ effectCategoryMask: mask })
            setEffectOpen(false)
          }}
        />
      )}
    </div>
  )

  const sortRow = (
    <FilterField label="排序：">
      <Select
        value={sortField}
        onValueChange={(val) => {
          const option = SORT_OPTIONS.find((o) => o.value === val) ?? SORT_OPTIONS[0]
          setFilters({ sortField: option.value, sortOrder: option.order })
        }}
      >
        <SelectTrigger size="sm" className={`${controlH} min-w-0 flex-1 text-xs`}>
          <SelectValue>{sortLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )

  const codeField = (
    <FilterField label="卡密">
      <div className="relative min-w-0 flex-1">
        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
        <Input
          type="number"
          placeholder="8 位数字"
          value={code !== undefined ? code : ''}
          onChange={(e) => {
            const val = e.target.value.trim()
            setFilters({ code: val === '' ? undefined : parseInt(val, 10) })
          }}
          className="h-7 w-full pl-7 text-xs font-mono"
        />
      </div>
    </FilterField>
  )

  const searchDescToggle = (
    <button
      type="button"
      onClick={() => setFilters({ searchDesc: !searchDesc })}
      className="flex items-center gap-1.5 w-full px-1.5 py-1 rounded-md hover:bg-muted/40 cursor-pointer text-muted-foreground hover:text-foreground transition-colors text-left"
    >
      {searchDesc ? (
        <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
      ) : (
        <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="text-[11px]">检索效果描述文本</span>
    </button>
  )

  if (isBand) {
    const keywordField = (
      <FilterField label="关键字：" labelClassName="w-12" className="flex-1 min-w-0">
        <Input
          type="text"
          value={localKw}
          onChange={(e) => setLocalKw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runKeywordSearch()
          }}
          className={`${controlH} min-w-0 flex-1 bg-background text-xs`}
        />
      </FilterField>
    )

    const clearButton = (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setLocalKw('')
          setKeyword('')
          resetFilters()
        }}
        className={`${controlH} w-14 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground`}
      >
        清空
      </Button>
    )

    const searchButton = (
      <Button
        variant="secondary"
        size="sm"
        onClick={runKeywordSearch}
        aria-busy={isLoading}
        className={`${controlH} min-w-0 flex-1 gap-1 px-2 text-xs font-semibold`}
      >
        <span>搜索</span>
        <Loader2
          className={cn(
            'w-3 h-3 transition-opacity',
            isLoading ? 'animate-spin opacity-100' : 'opacity-0'
          )}
        />
      </Button>
    )

    return (
      <div
        className={cn(
          'flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-2 text-xs [-webkit-app-region:no-drag]',
          className
        )}
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">{mainTypeField}</div>
            <div className="flex items-center gap-2">{attributeField}</div>
            <div className="flex items-center gap-2">{raceField}</div>
            <div className="flex items-center gap-2">
              {levelField}
              {scaleField}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {limitField}
              {headerSlot}
            </div>
            <div className="flex items-stretch gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">{atkField}</div>
                <div className="flex items-center gap-2">{defField}</div>
              </div>
              {effectField}
            </div>
            <div className="flex items-center gap-2">{keywordField}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {markerField}
          {clearButton}
          {searchButton}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'h-full flex flex-col bg-card/75 shrink-0 select-none overflow-hidden',
        'w-64 border-l border-border/60 animate-in slide-in-from-right-2 duration-200'
      )}
    >
      <div className="h-10 px-3 border-b border-border/50 flex items-center justify-between gap-1 bg-muted/20 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground min-w-0">
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">筛选条件</span>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                onClick={resetFilters}
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-1.5 shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重置</span>
              </Button>
            }
          />
          <TooltipContent>重置所有筛选条件</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1.5 text-xs">
          {mainTypeField}

          <div className="grid grid-cols-2 gap-1.5">
            {limitField}
            {attributeField}
            {atkField}
            {raceField}
            {defField}
            {levelField}
            {scaleField}
          </div>

          {effectField}

          {codeField}

          {markerField}

          {sortRow}

          {searchDescToggle}
        </div>
      </ScrollArea>
    </div>
  )
}
