import React from 'react'
import { SlidersHorizontal, RotateCcw, CheckSquare, Square, Search } from 'lucide-react'
import {
  CardType,
  CardAttribute,
  ATTRIBUTE_NAMES,
  CardRace,
  RACE_NAMES,
  NumericCompareOp
} from '@shared/index'
import { useCardSearchStore } from '../../stores/useCardSearchStore'
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

/** 怪兽卡细分种类选项 */
const MONSTER_SUB_TYPES = [
  { label: '全部子类', value: 0 },
  { label: '通常', value: CardType.NORMAL },
  { label: '效果', value: CardType.EFFECT },
  { label: '融合', value: CardType.FUSION },
  { label: '仪式', value: CardType.RITUAL },
  { label: '同调', value: CardType.SYNCHRO },
  { label: '超量', value: CardType.XYZ },
  { label: '灵摆', value: CardType.PENDULUM },
  { label: '连接', value: CardType.LINK },
  { label: '调整', value: CardType.TUNER },
  { label: '翻转', value: CardType.FLIP },
  { label: '衍生物', value: CardType.TOKEN }
]

/** 魔法卡细分种类选项 */
const SPELL_SUB_TYPES = [
  { label: '全部魔法', value: 0 },
  { label: '通常魔法', value: CardType.NORMAL },
  { label: '速攻魔法', value: CardType.QUICKPLAY },
  { label: '永续魔法', value: CardType.CONTINUOUS },
  { label: '装备魔法', value: CardType.EQUIP },
  { label: '场地魔法', value: CardType.FIELD },
  { label: '仪式魔法', value: CardType.RITUAL }
]

/** 陷阱卡细分种类选项 */
const TRAP_SUB_TYPES = [
  { label: '全部陷阱', value: 0 },
  { label: '通常陷阱', value: CardType.NORMAL },
  { label: '永续陷阱', value: CardType.CONTINUOUS },
  { label: '反击陷阱', value: CardType.COUNTER }
]

/** 数值比较符选项 (对齐 YGOPro 的 filter_*type) */
const OP_OPTIONS: Array<{ value: NumericCompareOp; label: string; prefix: string }> = [
  { value: 'eq', label: '等于', prefix: '=' },
  { value: 'gte', label: '大于等于', prefix: '≥' },
  { value: 'lte', label: '小于等于', prefix: '≤' }
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
  mono
}) => {
  const current = OP_OPTIONS.find((o) => o.value === op) ?? OP_OPTIONS[0]
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-muted-foreground/90">{label}</div>
      <div className="flex items-center gap-1">
        <Select value={op} onValueChange={(val) => onOpChange((val || 'eq') as NumericCompareOp)}>
          <SelectTrigger size="sm" className="w-14 h-7 text-xs shrink-0">
            <SelectValue>{current.prefix}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {OP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder={placeholder}
          value={value !== undefined ? value : ''}
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

export const FilterDrawer: React.FC = () => {
  const {
    type,
    subType,
    attribute,
    race,
    level,
    levelOp,
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

  // 根据当前主种类动态获得子种类列表
  const currentSubTypes = React.useMemo(() => {
    if (type === CardType.SPELL) return SPELL_SUB_TYPES
    if (type === CardType.TRAP) return TRAP_SUB_TYPES
    return MONSTER_SUB_TYPES
  }, [type])

  // 统计已启用的筛选条件数量，用于顶部提示
  const activeCount =
    (type !== 0 ? 1 : 0) +
    (subType !== 0 ? 1 : 0) +
    (attribute !== 0 ? 1 : 0) +
    (race !== 0 ? 1 : 0) +
    (level !== 0 ? 1 : 0) +
    (atk !== undefined ? 1 : 0) +
    (def !== undefined ? 1 : 0) +
    (code !== undefined ? 1 : 0)

  const typeLabel = MAIN_TYPES.find((t) => t.value === type)?.label ?? '全部种类'
  const subTypeLabel = currentSubTypes.find((s) => s.value === subType)?.label ?? '全部子类'
  const attributeLabel = attribute !== 0 ? `${ATTRIBUTE_NAMES[attribute]}属性` : '全部属性'
  const raceLabel = race !== 0 ? RACE_NAMES[race] : '全部种族'
  const sortFieldLabel =
    { id: '按卡密', atk: '按攻击力', def: '按守备力', level: '按等级', name: '按卡名' }[
      sortField
    ] ?? '按卡密'

  return (
    <div className="w-64 h-full flex flex-col bg-card/75 border-l border-border/60 shrink-0 select-none overflow-hidden animate-in slide-in-from-right-2 duration-200">
      {/* 顶部标题与重置 */}
      <div className="h-10 px-3 border-b border-border/50 flex items-center justify-between bg-muted/20 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground min-w-0">
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">筛选条件</span>
          {activeCount > 0 && (
            <span className="shrink-0 min-w-4 h-4 px-1 rounded-full bg-primary/15 text-primary text-[10px] font-mono font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={resetFilters}
          className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-1.5 shrink-0"
          title="重置所有筛选条件"
        >
          <RotateCcw className="w-3 h-3" />
          <span>重置</span>
        </Button>
      </div>

      {/* 筛选表单：两列网格紧凑排布 */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 text-xs">
        {/* 类型 */}
        <FilterField label="卡片大类">
          <Select
            value={type}
            onValueChange={(val) => {
              const num = val ? Number(val) : 0
              setFilters({ type: num, subType: 0 })
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
            onValueChange={(val) => setFilters({ subType: val ? Number(val) : 0 })}
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

        <Separator className="opacity-40" />

        {/* 属性 / 种族 */}
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

        <Separator className="opacity-40" />

        {/* 攻防：各带条件 */}
        <CompareRow
          label="攻击力 ATK"
          op={atkOp}
          value={atk}
          placeholder="如 3000"
          onOpChange={(op) => setFilters({ atkOp: op })}
          onValueChange={(val) => setFilters({ atk: val })}
        />

        <CompareRow
          label="守备力 DEF"
          op={defOp}
          value={def}
          placeholder="如 2000"
          onOpChange={(op) => setFilters({ defOp: op })}
          onValueChange={(val) => setFilters({ def: val })}
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
                <SelectItem value="id">按卡密</SelectItem>
                <SelectItem value="atk">按攻击力</SelectItem>
                <SelectItem value="def">按守备力</SelectItem>
                <SelectItem value="level">按等级</SelectItem>
                <SelectItem value="name">按卡名</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortOrder}
              onValueChange={(val) => setFilters({ sortOrder: (val || 'DESC') as 'ASC' | 'DESC' })}
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
    </div>
  )
}
