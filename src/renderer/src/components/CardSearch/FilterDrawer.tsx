import React from 'react'
import { SlidersHorizontal, RotateCcw, ArrowDownUp, CheckSquare, Square } from 'lucide-react'
import { CardType, CardAttribute, ATTRIBUTE_NAMES, CardRace, RACE_NAMES } from '@shared/index'
import { useCardSearchStore } from '../../stores/useCardSearchStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Separator } from '../ui/separator'

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

export const FilterDrawer: React.FC = () => {
  const {
    type,
    subType,
    attribute,
    race,
    level,
    atk,
    def,
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

  return (
    <div className="w-68 h-full flex flex-col bg-card/75 border-l border-border/60 shrink-0 select-none overflow-hidden animate-in slide-in-from-right-2 duration-200">
      {/* 顶部标题与折叠栏 */}
      <div className="h-11 px-3 border-b border-border/50 flex items-center justify-between bg-muted/20 shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span>高级筛选条件</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={resetFilters}
            className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-1.5"
            title="重置所有筛选条件"
          >
            <RotateCcw className="w-3 h-3" />
            <span>重置</span>
          </Button>
        </div>
      </div>

      {/* 筛选表单区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">
        {/* 卡片大类 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">卡片大类</label>
          <Select
            value={type}
            onValueChange={(val) => {
              const num = val ? Number(val) : 0
              setFilters({ type: num, subType: 0 })
            }}
          >
            <SelectTrigger size="sm" className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAIN_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 细分类型 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">细分类型</label>
          <Select
            value={subType}
            onValueChange={(val) => setFilters({ subType: val ? Number(val) : 0 })}
          >
            <SelectTrigger size="sm" className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currentSubTypes.map((st) => (
                <SelectItem key={st.value} value={st.value}>
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="opacity-50" />

        {/* 属性过滤 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">怪兽属性</label>
          <Select
            value={attribute}
            onValueChange={(val) => setFilters({ attribute: val ? Number(val) : 0 })}
          >
            <SelectTrigger size="sm" className="h-7 text-xs">
              <SelectValue />
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
        </div>

        {/* 种族过滤 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">怪兽种族</label>
          <Select value={race} onValueChange={(val) => setFilters({ race: val ? Number(val) : 0 })}>
            <SelectTrigger size="sm" className="h-7 text-xs">
              <SelectValue />
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
        </div>

        {/* 等级 / 阶级 / Link */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            等级 / 阶级 / 连接
          </label>
          <Select
            value={level}
            onValueChange={(val) => setFilters({ level: val ? Number(val) : 0 })}
          >
            <SelectTrigger size="sm" className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={0}>全部星级</SelectItem>
              {Array.from({ length: 13 }, (_, i) => i + 1).map((lvl) => (
                <SelectItem key={lvl} value={lvl}>
                  ☆ {lvl} / Rank {lvl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="opacity-50" />

        {/* 攻防数值与卡密过滤 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">攻击力 (ATK)</label>
            <Input
              type="number"
              placeholder="精确数值"
              value={atk !== undefined ? atk : ''}
              onChange={(e) => {
                const val = e.target.value.trim()
                setFilters({ atk: val === '' ? undefined : parseInt(val, 10) })
              }}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">守备力 (DEF)</label>
            <Input
              type="number"
              placeholder="精确数值"
              value={def !== undefined ? def : ''}
              onChange={(e) => {
                const val = e.target.value.trim()
                setFilters({ def: val === '' ? undefined : parseInt(val, 10) })
              }}
              className="h-7 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">8位卡密</label>
          <Input
            type="number"
            placeholder="如 89631139"
            value={code !== undefined ? code : ''}
            onChange={(e) => {
              const val = e.target.value.trim()
              setFilters({ code: val === '' ? undefined : parseInt(val, 10) })
            }}
            className="h-7 text-xs font-mono"
          />
        </div>

        <Separator className="opacity-50" />

        {/* 排序设置 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <ArrowDownUp className="w-3 h-3" />
            <span>排序规则</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Select
              value={sortField}
              onValueChange={(val) =>
                setFilters({ sortField: (val || 'id') as 'id' | 'atk' | 'def' | 'level' | 'name' })
              }
            >
              <SelectTrigger size="sm" className="h-7 text-[11px]">
                <SelectValue />
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
              <SelectTrigger size="sm" className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DESC">降序 (高→低)</SelectItem>
                <SelectItem value="ASC">升序 (低→高)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 检索选项开关 */}
        <div
          onClick={() => setFilters({ searchDesc: !searchDesc })}
          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/40 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        >
          {searchDesc ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-xs">检索卡片效果描述文本</span>
        </div>
      </div>
    </div>
  )
}
