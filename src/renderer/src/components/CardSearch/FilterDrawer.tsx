import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React from 'react'
import { SlidersHorizontal, RotateCcw, CheckSquare, Square, Search } from 'lucide-react'
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
import { Separator } from '../ui/separator'
import { cn } from '../../lib/utils'

// 主类别选项
const MAIN_TYPES = [
  { label: '全部种类', value: 0 },
  { label: '怪兽卡', value: CardType.MONSTER },
  { label: '魔法卡', value: CardType.SPELL },
  { label: '陷阱卡', value: CardType.TRAP }
]

/** 使用 YGOPro 的细分类型值：怪兽按位包含筛选，魔法/陷阱按完整类型精确匹配。 */
const MONSTER_SUB_TYPES = [
  { label: '全部子类', value: 0 },
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
  { label: '全部魔法', value: 0 },
  { label: '通常魔法', value: CardType.SPELL },
  { label: '速攻魔法', value: CardType.SPELL | CardType.QUICKPLAY },
  { label: '永续魔法', value: CardType.SPELL | CardType.CONTINUOUS },
  { label: '装备魔法', value: CardType.SPELL | CardType.EQUIP },
  { label: '场地魔法', value: CardType.SPELL | CardType.FIELD },
  { label: '仪式魔法', value: CardType.SPELL | CardType.RITUAL }
]

const TRAP_SUB_TYPES = [
  { label: '全部陷阱', value: 0 },
  { label: '通常陷阱', value: CardType.TRAP },
  { label: '永续陷阱', value: CardType.TRAP | CardType.CONTINUOUS },
  { label: '反击陷阱', value: CardType.TRAP | CardType.COUNTER }
]

/** 数值比较符选项 (包含严格不等式与未知值语义)。 */
const OP_OPTIONS: Array<{ value: NumericCompareOp; label: string; prefix: string }> = [
  { value: 'eq', label: '等于', prefix: '=' },
  { value: 'gt', label: '大于', prefix: '>' },
  { value: 'gte', label: '大于等于', prefix: '≥' },
  { value: 'lt', label: '小于', prefix: '<' },
  { value: 'lte', label: '小于等于', prefix: '≤' },
  { value: 'unknown', label: '未知 (?)', prefix: '?' }
]

/** 禁限三档，取自 YGOPro 的 cbLimit 前三项（4 档以上是 ot 位，已由「赛区卡池」覆盖） */
const LIMIT_OPTIONS: Array<{ value: LimitFilter; label: string }> = [
  { value: 0, label: '不限' },
  { value: 1, label: '禁限一（禁止）' },
  { value: 2, label: '禁限二（准限制）' },
  { value: 3, label: '禁限三（限制）' }
]

/** 箭头按 YGOPro 的 3×3 环形排布，中间格留空给「清除」 */
const MARKER_GRID: Array<{ mask: number; label: string } | null> = [
  LINK_MARKERS[0],
  LINK_MARKERS[1],
  LINK_MARKERS[2],
  LINK_MARKERS[3],
  null,
  LINK_MARKERS[4],
  LINK_MARKERS[5],
  LINK_MARKERS[6],
  LINK_MARKERS[7]
]

interface FilterFieldProps {
  label: string
  children: React.ReactNode
  className?: string
}

/** 统一的小节标题 */
const FilterField: React.FC<FilterFieldProps> = ({ label, children, className }) => (
  <div className={cn('space-y-1', className)}>
    <div className="text-[10px] font-medium text-muted-foreground/90">{label}</div>
    {children}
  </div>
)

interface CompareRowProps {
  label: string
  op: NumericCompareOp
  value: number | undefined
  placeholder: string
  onOpChange: (op: NumericCompareOp) => void
  onValueChange: (value: number | undefined) => void
  mono?: boolean
  allowUnknown?: boolean
  disabled?: boolean
}

/**
 * 数值维度筛选行：左侧条件选择器（= / ≥ / ≤）+ 右侧数值输入。
 * 参照 YGOPro 的「条件类型 + 数值」组合，而不是只能填精确值。
 */
const CompareRow: React.FC<CompareRowProps> = ({
  label,
  op,
  value,
  placeholder,
  onOpChange,
  onValueChange,
  mono,
  allowUnknown = false,
  disabled = false
}) => {
  const options = allowUnknown
    ? OP_OPTIONS
    : OP_OPTIONS.filter((option) => option.value !== 'unknown')
  const current = options.find((option) => option.value === op) ?? OP_OPTIONS[0]
  return (
    <div className="space-y-1">
      <div
        className={cn('text-[10px] font-medium text-muted-foreground/90', disabled && 'opacity-50')}
      >
        {label}
      </div>
      <div className="flex items-center gap-1">
        <Select
          value={op}
          disabled={disabled}
          onValueChange={(val) => onOpChange((val || 'eq') as NumericCompareOp)}
        >
          <SelectTrigger size="sm" className="w-14 h-7 text-xs shrink-0">
            <SelectValue>{current.prefix}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder={op === 'unknown' ? '未知 (?)' : placeholder}
          disabled={disabled || op === 'unknown'}
          value={op === 'unknown' ? '' : value !== undefined ? value : ''}
          onChange={(e) => {
            const val = e.target.value.trim()
            onValueChange(val === '' ? undefined : parseInt(val, 10))
          }}
          className={cn('h-7 text-xs min-w-0 flex-1', mono && 'font-mono')}
        />
      </div>
    </div>
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

export const FilterDrawer: React.FC = () => {
  const {
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
    sortOrder,
    setFilters,
    resetFilters
  } = useCardSearchStore()
  const [filterOptions, setFilterOptions] = React.useState<CardSearchFilterOptions>({
    effectCategories: []
  })

  React.useEffect(() => {
    let isActive = true
    window.api
      .getCardSearchFilterOptions()
      .then((options) => {
        if (isActive) setFilterOptions(options)
      })
      .catch((error) => console.error('[FilterDrawer] Failed to load filter labels:', error))
    return () => {
      isActive = false
    }
  }, [])

  // 根据当前主种类动态获得子种类列表
  const currentSubTypes = React.useMemo(() => {
    if (type === CardType.SPELL) return SPELL_SUB_TYPES
    if (type === CardType.TRAP) return TRAP_SUB_TYPES
    return MONSTER_SUB_TYPES
  }, [type])

  const typeLabel = MAIN_TYPES.find((t) => t.value === type)?.label ?? '全部种类'
  const subTypeLabel = currentSubTypes.find((s) => s.value === subType)?.label ?? '全部子类'
  const attributeLabel = attribute !== 0 ? `${ATTRIBUTE_NAMES[attribute]}属性` : '全部属性'
  const raceLabel = race !== 0 ? RACE_NAMES[race] : '全部种族'
  const sortFieldLabel =
    { id: 'YGOPro 默认', atk: '按攻击力', def: '按守备力', level: '按等级', name: '按卡名' }[
      sortField
    ] ?? 'YGOPro 默认'
  const cardPoolLabel =
    ({ any: '全部卡池', ocg: 'OCG', tcg: 'TCG', both: 'OCG + TCG' } as const)[cardPool] ??
    '全部卡池'
  const limitLabel = LIMIT_OPTIONS.find((o) => o.value === limitFilter)?.label ?? '不限'
  const markerCount = LINK_MARKERS.filter((m) => (markers & m.mask) !== 0).length

  const isLinkMonster = React.useMemo(() => {
    if (subType === (CardType.MONSTER | CardType.LINK)) return true
    if (type !== 0 && (type & CardType.LINK) !== 0) return true
    return markers !== 0
  }, [subType, type, markers])
  const toggleMarker = (mask: number): void => {
    const next = (markers & mask) !== 0 ? (markers & ~mask) >>> 0 : (markers | mask) >>> 0
    setFilters({ markers: next, ...clearDefIfLink(next, subType, type) })
  }

  const toggleEffectCategory = (mask: number): void => {
    const nextMask =
      (effectCategoryMask & mask) !== 0
        ? (effectCategoryMask & ~mask) >>> 0
        : (effectCategoryMask | mask) >>> 0
    setFilters({ effectCategoryMask: nextMask })
  }

  return (
    <div className="w-64 h-full flex flex-col bg-card/75 border-l border-border/60 shrink-0 select-none overflow-hidden animate-in slide-in-from-right-2 duration-200">
      {/* 顶部标题与重置 */}
      <div className="h-10 px-3 border-b border-border/50 flex items-center justify-between bg-muted/20 shrink-0">
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

      {/* 筛选表单：两列网格紧凑排布 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2.5 space-y-2.5 text-xs">
          {/* 类型 */}
          <FilterField label="卡片大类">
            <Select
              value={type}
              onValueChange={(val) => {
                const num = val ? Number(val) : 0
                setFilters({
                  type: num,
                  subType: 0,
                  ...clearDefIfLink(markers, 0, num)
                })
              }}
            >
              <SelectTrigger size="sm" className="w-full h-7 text-xs">
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
          </FilterField>

          <FilterField label="细分类型">
            <Select
              value={subType}
              onValueChange={(val) => {
                const num = val ? Number(val) : 0
                setFilters({ subType: num, ...clearDefIfLink(markers, num, type) })
              }}
            >
              <SelectTrigger size="sm" className="w-full h-7 text-xs">
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

          <FilterField label="赛区卡池">
            <Select
              value={cardPool}
              onValueChange={(value) =>
                setFilters({ cardPool: (value || 'any') as CardPoolFilter })
              }
            >
              <SelectTrigger size="sm" className="w-full h-7 text-xs">
                <SelectValue>{cardPoolLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">全部卡池</SelectItem>
                <SelectItem value="ocg">OCG 可用</SelectItem>
                <SelectItem value="tcg">TCG 可用</SelectItem>
                <SelectItem value="both">OCG 与 TCG 均可用</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="禁限">
            <Select
              value={String(limitFilter)}
              onValueChange={(val) =>
                setFilters({ limitFilter: (Number(val) || 0) as LimitFilter })
              }
            >
              <SelectTrigger size="sm" className="w-full h-7 text-xs">
                <SelectValue>{limitLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label={`连接标记${markerCount > 0 ? `（已选 ${markerCount}）` : ''}`}>
            <div className="grid grid-cols-3 gap-1">
              {MARKER_GRID.map((marker, index) =>
                marker === null ? (
                  <button
                    key={`empty-${index}`}
                    type="button"
                    disabled={markerCount === 0}
                    onClick={() => setFilters({ markers: 0 })}
                    className="h-7 rounded text-[10px] text-muted-foreground bg-muted/30 transition-colors hover:bg-muted/70 hover:text-foreground disabled:opacity-35 disabled:pointer-events-none"
                  >
                    清除
                  </button>
                ) : (
                  <Tooltip key={marker.mask}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-pressed={(markers & marker.mask) !== 0}
                          onClick={() => toggleMarker(marker.mask)}
                          className={cn(
                            'h-7 rounded text-sm leading-none transition-colors',
                            (markers & marker.mask) !== 0
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                          )}
                        >
                          {marker.label}
                        </button>
                      }
                    />
                    <TooltipContent>
                      {`箭头 ${marker.label}（需同时具备全部选中方向）`}
                    </TooltipContent>
                  </Tooltip>
                )
              )}
            </div>
          </FilterField>

          <Separator className="opacity-40" />

          <div className="grid grid-cols-2 gap-1.5">
            <FilterField label="属性">
              <Select
                value={attribute}
                onValueChange={(val) => setFilters({ attribute: val ? Number(val) : 0 })}
              >
                <SelectTrigger size="sm" className="w-full h-7 text-xs">
                  <SelectValue>{attributeLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={0}>全部属性</SelectItem>
                  {Object.entries(CardAttribute).map(([key, val]) => (
                    <SelectItem key={key} value={val}>
                      {ATTRIBUTE_NAMES[val]}属性
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="种族">
              <Select
                value={race}
                onValueChange={(val) => setFilters({ race: val ? Number(val) : 0 })}
              >
                <SelectTrigger size="sm" className="w-full h-7 text-xs">
                  <SelectValue>{raceLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={0}>全部种族</SelectItem>
                  {Object.entries(CardRace).map(([key, val]) => (
                    <SelectItem key={key} value={val}>
                      {RACE_NAMES[val]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </div>

          {/* 星级：条件 + 数值 */}
          <CompareRow
            label="等级 / 阶级 / 连接"
            op={levelOp}
            value={level !== 0 ? level : undefined}
            placeholder="1 - 13"
            onOpChange={(op) => setFilters({ levelOp: op })}
            onValueChange={(val) => setFilters({ level: val ?? 0 })}
          />

          <CompareRow
            label="灵摆刻度（左侧）"
            op={scaleOp}
            value={scale}
            placeholder="如 8"
            onOpChange={(op) => setFilters({ scaleOp: op })}
            onValueChange={(val) => setFilters({ scale: val })}
          />

          <Separator className="opacity-40" />

          {/* 攻防：各带条件 */}
          <CompareRow
            label="攻击力 ATK"
            op={atkOp}
            value={atk}
            placeholder="如 3000"
            onOpChange={(op) => setFilters({ atkOp: op })}
            onValueChange={(val) => setFilters({ atk: val })}
            allowUnknown
          />

          <CompareRow
            label="守备力 DEF"
            op={defOp}
            value={def}
            placeholder="如 2000"
            onOpChange={(op) => setFilters({ defOp: op })}
            onValueChange={(val) => setFilters({ def: val })}
            allowUnknown
            disabled={isLinkMonster}
          />

          <FilterField label="卡密">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
              <Input
                type="number"
                placeholder="8 位数字"
                value={code !== undefined ? code : ''}
                onChange={(e) => {
                  const val = e.target.value.trim()
                  setFilters({ code: val === '' ? undefined : parseInt(val, 10) })
                }}
                className="h-7 pl-7 text-xs font-mono"
              />
            </div>
          </FilterField>

          <Separator className="opacity-40" />

          {/* 排序 */}
          <FilterField label="排序">
            <div className="grid grid-cols-2 gap-1.5">
              <Select
                value={sortField}
                onValueChange={(val) =>
                  setFilters({
                    sortField: (val || 'id') as 'id' | 'atk' | 'def' | 'level' | 'name'
                  })
                }
              >
                <SelectTrigger size="sm" className="w-full h-7 text-[11px]">
                  <SelectValue>{sortFieldLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">YGOPro 默认</SelectItem>
                  <SelectItem value="atk">按攻击力</SelectItem>
                  <SelectItem value="def">按守备力</SelectItem>
                  <SelectItem value="level">按等级</SelectItem>
                  <SelectItem value="name">按卡名</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortOrder}
                onValueChange={(val) =>
                  setFilters({ sortOrder: (val || 'DESC') as 'ASC' | 'DESC' })
                }
              >
                <SelectTrigger size="sm" className="w-full h-7 text-[11px]">
                  <SelectValue>{sortOrder === 'ASC' ? '升序' : '降序'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DESC">降序（高→低）</SelectItem>
                  <SelectItem value="ASC">升序（低→高）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FilterField>

          <details className="rounded-md border border-border/50 px-2 py-1.5">
            <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
              效果分类{effectCategoryMask !== 0 ? '（已启用）' : ''}
            </summary>
            {filterOptions.effectCategories.length > 0 ? (
              <div className="mt-2 max-h-40 overflow-y-auto pr-1.5">
                <div className="grid grid-cols-2 gap-1">
                  {filterOptions.effectCategories.map((category) => {
                    const selected = (effectCategoryMask & category.mask) !== 0
                    return (
                      <Tooltip key={category.mask}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleEffectCategory(category.mask)}
                              className={cn(
                                'truncate rounded px-1.5 py-1 text-left text-[10px] transition-colors',
                                selected
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                              )}
                            >
                              {category.label}
                            </button>
                          }
                        />
                        <TooltipContent>{category.label}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                当前卡库未提供分类名称。将游戏目录中的 strings.conf 放在 cards.cdb 同目录或
                expansions 子目录后重载卡库。
              </p>
            )}
          </details>

          {/* 描述检索开关 */}
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
        </div>
      </ScrollArea>
    </div>
  )
}
