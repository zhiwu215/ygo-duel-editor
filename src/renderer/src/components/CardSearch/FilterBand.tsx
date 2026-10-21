import React from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'
import { FilterField } from './FilterField'

interface FilterBandFields {
  mainType: React.ReactNode
  limit: React.ReactNode
  attribute: React.ReactNode
  race: React.ReactNode
  level: React.ReactNode
  scale: React.ReactNode
  atk: React.ReactNode
  def: React.ReactNode
  effect: React.ReactNode
  marker: React.ReactNode
}

interface FilterBandProps {
  className?: string
  headerSlot?: React.ReactNode
  isLoading: boolean
  keyword: string
  onKeywordChange: (value: string) => void
  onKeywordSubmit: () => void
  onClear: () => void
  fields: FilterBandFields
}

export const FilterBand: React.FC<FilterBandProps> = ({
  className,
  headerSlot,
  isLoading,
  keyword,
  onKeywordChange,
  onKeywordSubmit,
  onClear,
  fields
}) => {
  const keywordField = (
    <FilterField label="关键字：" labelClassName="w-12" className="flex-1 min-w-0">
      <Input
        type="text"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onKeywordSubmit()
        }}
        className="h-6 min-w-0 flex-1 bg-background text-xs"
      />
    </FilterField>
  )

  const clearButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClear}
      className="h-6 w-14 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      清空
    </Button>
  )

  const searchButton = (
    <Button
      variant="secondary"
      size="sm"
      onClick={onKeywordSubmit}
      aria-busy={isLoading}
      className="h-6 min-w-0 flex-1 gap-1 px-2 text-xs font-semibold"
    >
      <span>搜索</span>
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
          <div className="flex items-center gap-2">{fields.mainType}</div>
          <div className="flex items-center gap-2">{fields.attribute}</div>
          <div className="flex items-center gap-2">{fields.race}</div>
          <div className="flex items-center gap-2">
            {fields.level}
            {fields.scale}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {fields.limit}
            {headerSlot}
          </div>
          <div className="flex items-stretch gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">{fields.atk}</div>
              <div className="flex items-center gap-2">{fields.def}</div>
            </div>
            {fields.effect}
          </div>
          <div className="flex items-center gap-2">{keywordField}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {fields.marker}
        {clearButton}
        {searchButton}
      </div>
    </div>
  )
}
