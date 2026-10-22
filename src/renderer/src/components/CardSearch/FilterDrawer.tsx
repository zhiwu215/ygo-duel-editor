import { ScrollArea } from '../ui/scroll-area'
import React from 'react'
import { RotateCcw, CheckSquare, Square } from 'lucide-react'
import {
  CardType,
  CardPoolFilter,
  FILTER_CATALOGS,
  LimitFilter,
  NONE_LABEL,
  linkMarkerCount
} from '@shared/index'
import { CardSearchFilters, useCardSearchStore } from '../../stores/useCardSearchStore'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { SearchableSelect } from '../ui/searchable-select'
import { LinkMarkerPopover } from './LinkMarkerPopover'
import { EffectCategoryPopover } from './EffectCategoryPopover'
import { SORT_OPTIONS } from './sortOptions'
import { FilterField } from './FilterField'
import { NumericRow } from './NumericRow'
import { FilterBand } from './FilterBand'
import { LIMIT_OPTIONS, cardPoolOptions } from './filterOptions'
import { cn } from '../../lib/utils'

const NONE_VALUE = '__none__'
const LIMIT_VALUE_PREFIX = 'limit:'

function isLinkSelection(type: number, subType: number, markers: number): boolean {
  if (subType === (CardType.MONSTER | CardType.LINK)) return true
  if (type !== 0 && (type & CardType.LINK) !== 0) return true
  return markers !== 0
}

function clearDefIfLink(
  nextMarkers: number,
  nextSubType: number,
  nextType: number
): Pick<CardSearchFilters, 'def' | 'defOp'> | Record<string, never> {
  return isLinkSelection(nextType, nextSubType, nextMarkers) ? { def: undefined, defOp: 'eq' } : {}
}

interface FilterDrawerProps {
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
    searchDesc,
    showUnofficial,
    onlyFavorites,
    sortField,
    filterOptions,
    setKeyword,
    search,
    setFilters,
    resetFilters,
    loadFilterOptions,
    selectBanlist
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

  const catalog = FILTER_CATALOGS[filterOptions.poolSchema]
  const poolSelectOptions = React.useMemo(
    () => cardPoolOptions(filterOptions.poolSchema),
    [filterOptions.poolSchema]
  )

  React.useEffect(() => {
    void loadFilterOptions()
  }, [loadFilterOptions])

  const currentSubTypes = React.useMemo(() => {
    if (type === CardType.SPELL) return catalog.spellSubTypes
    if (type === CardType.TRAP) return catalog.trapSubTypes
    return catalog.monsterSubTypes
  }, [catalog, type])

  const typeLabel = catalog.mainTypes.find((t) => t.value === type)?.label ?? NONE_LABEL
  const subTypeLabel = currentSubTypes.find((s) => s.value === subType)?.label ?? NONE_LABEL
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortField)?.label ?? SORT_OPTIONS[0].label
  const cardPoolLabel =
    cardPool === 'any'
      ? '全部'
      : (poolSelectOptions.find((o) => o.value === cardPool)?.label ?? '全部')
  const limitLabel = LIMIT_OPTIONS.find((o) => o.value === limitFilter)?.label ?? '不限'
  const limitPoolValue =
    limitFilter !== 0
      ? `${LIMIT_VALUE_PREFIX}${limitFilter}`
      : cardPool === 'any'
        ? NONE_VALUE
        : cardPool
  const limitPoolLabel =
    limitFilter !== 0 ? limitLabel : cardPool === 'any' ? NONE_LABEL : cardPoolLabel
  const markerCount = linkMarkerCount(markers)
  const markerLabel = '连接标记'

  const isAllTypes = type === 0
  const isSkillType = type === CardType.SKILL
  const detailDisabled =
    isAllTypes || isSkillType || type === CardType.SPELL || type === CardType.TRAP
  const subTypeDisabled = isAllTypes || isSkillType

  const isLinkMonster = React.useMemo(
    () => isLinkSelection(type, subType, markers),
    [subType, type, markers]
  )
  const defDisabled = detailDisabled || isLinkMonster

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
          if (val == null) return
          const num = Number(val)
          if (num === type) return
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
          {catalog.mainTypes.map((t) => (
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
          if (val == null) return
          const num = Number(val)
          if (num === subType) return
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

  const banlistField = (
    <FilterField label="卡表：" className={isBand ? 'flex-1 min-w-0' : undefined}>
      <SearchableSelect
        ariaLabel="卡表"
        options={filterOptions.banlists.map((name) => ({ value: name, label: name }))}
        value={filterOptions.banlist ?? ''}
        disabled={filterOptions.banlists.length === 0}
        className={cn(controlH, 'min-w-0 flex-1 text-xs')}
        onValueChange={(val) => {
          void selectBanlist(val || null)
        }}
      />
    </FilterField>
  )

  const limitField = (
    <FilterField label="禁限：" className={isBand ? 'flex-1 min-w-0' : undefined}>
      <Select
        value={limitPoolValue}
        onValueChange={(val) => {
          if (val == null) return
          if (val === NONE_VALUE) {
            setFilters({ limitFilter: 0, cardPool: 'any' })
            return
          }
          if (val.startsWith(LIMIT_VALUE_PREFIX)) {
            setFilters({ limitFilter: Number(val.slice(LIMIT_VALUE_PREFIX.length)) as LimitFilter })
            return
          }
          setFilters({ cardPool: val as CardPoolFilter, limitFilter: 0 })
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
          {poolSelectOptions
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
      <SearchableSelect
        ariaLabel="属性"
        options={catalog.attributes}
        value={attribute}
        disabled={detailDisabled}
        className={cn(controlH, 'min-w-0 flex-1 text-xs')}
        onValueChange={(next) => setFilters({ attribute: Number(next) })}
      />
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
      <SearchableSelect
        ariaLabel="种族"
        options={catalog.races}
        value={race}
        disabled={detailDisabled}
        className={cn(controlH, 'min-w-0 flex-1 text-xs')}
        onValueChange={(next) => setFilters({ race: Number(next) })}
      />
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
          'rounded text-[11px] leading-none transition-colors disabled:pointer-events-none disabled:opacity-35 flex items-center justify-center px-2 whitespace-nowrap overflow-hidden text-ellipsis',
          `${controlH} w-full`,
          markerCount > 0
            ? 'bg-primary/20 text-primary font-semibold'
            : 'bg-neutral-500/10 text-muted-foreground hover:bg-neutral-500/25 hover:text-foreground'
        )}
      >
        {markerLabel}
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

  const unofficialToggle = (
    <button
      type="button"
      onClick={() => setFilters({ showUnofficial: !showUnofficial })}
      title="OCG/TCG/先行卡以外的卡：动漫、Rush、卡片力量、自定义等"
      className="flex items-center gap-1.5 w-full px-1.5 py-1 rounded-md hover:bg-muted/40 cursor-pointer text-muted-foreground hover:text-foreground transition-colors text-left"
    >
      {showUnofficial ? (
        <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
      ) : (
        <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="text-[11px]">显示非 OCG/TCG 卡</span>
    </button>
  )

  const onlyFavoritesToggle = (
    <button
      type="button"
      onClick={() => setFilters({ onlyFavorites: !onlyFavorites })}
      className="flex items-center gap-1.5 w-full px-1.5 py-1 rounded-md hover:bg-muted/40 cursor-pointer text-muted-foreground hover:text-foreground transition-colors text-left"
    >
      {onlyFavorites ? (
        <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
      ) : (
        <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="text-[11px]">仅显示收藏卡片</span>
    </button>
  )

  if (isBand) {
    return (
      <FilterBand
        className={className}
        headerSlot={headerSlot}
        isLoading={isLoading}
        keyword={localKw}
        onKeywordChange={setLocalKw}
        onKeywordSubmit={runKeywordSearch}
        onClear={() => {
          setLocalKw('')
          setKeyword('')
          resetFilters()
        }}
        fields={{
          mainType: mainTypeField,
          banlist: banlistField,
          limit: limitField,
          attribute: attributeField,
          race: raceField,
          level: levelField,
          scale: scaleField,
          atk: atkField,
          def: defField,
          effect: effectField,
          marker: markerField
        }}
      />
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
          <span className="truncate">筛选条件</span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={resetFilters}
          className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-1.5 shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          <span>重置</span>
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1.5 text-xs">
          {mainTypeField}

          <div className="grid grid-cols-2 gap-1.5">
            <div className="col-span-2">{banlistField}</div>
            <div className="col-span-2">{limitField}</div>
            {raceField}
            {attributeField}
            {atkField}
            {defField}
            {levelField}
            {scaleField}
          </div>

          {effectField}

          {markerField}

          {sortRow}

          {searchDescToggle}

          {filterOptions.poolSchema === 'kcg' && unofficialToggle}

          {onlyFavoritesToggle}
        </div>
      </ScrollArea>
    </div>
  )
}
