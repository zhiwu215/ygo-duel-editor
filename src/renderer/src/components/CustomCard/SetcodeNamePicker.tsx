import React, { useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

interface SetcodeNamePickerProps {
  value: string
  options: Array<{ code: number; name: string }>
  localName?: string
  onSelect: (value: string | null) => void
  onCustom: () => void
}

export const SetcodeNamePicker: React.FC<SetcodeNamePickerProps> = ({
  value,
  options,
  localName,
  onSelect,
  onCustom
}) => {
  const [open, setOpen] = useState<boolean>(false)
  const [query, setQuery] = useState<string>('')

  const unique = new Map<string, string>()
  for (const option of options) {
    const hex = option.code.toString(16).padStart(4, '0').toUpperCase()
    if (!unique.has(hex)) unique.set(hex, option.name)
  }

  const knownName = value ? unique.get(value) : undefined
  const displayName = !value ? '无' : (knownName ?? localName ?? '自定义代码')
  const keyword = query.trim().toLocaleLowerCase()
  const filtered = [...unique.entries()].filter(([hex, name]) => {
    if (!keyword) return true
    return name.toLocaleLowerCase().includes(keyword) || hex.toLocaleLowerCase().includes(keyword)
  })

  const select = (next: string | null): void => {
    onSelect(next)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setQuery('')
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-xs font-normal transition-colors hover:bg-muted/40"
          >
            <span className="min-w-0 truncate text-left">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-[320px] gap-0 p-0">
        <div className="border-b border-border/60 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索系列名称或代码"
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          <button
            type="button"
            onClick={() => select(null)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/60"
          >
            <span className="min-w-0 flex-1">无</span>
            {!value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </button>
          <button
            type="button"
            onClick={() => {
              onCustom()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/60"
          >
            <span className="min-w-0 flex-1">自定义代码</span>
          </button>
          {localName && !knownName && (
            <button
              type="button"
              onClick={() => select(value)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/60"
            >
              <span className="min-w-0 flex-1">{localName}（本地）</span>
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            </button>
          )}
          {filtered.map(([hex, name]) => (
            <button
              key={hex}
              type="button"
              onClick={() => select(hex)}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/60',
                value === hex && 'bg-muted/50'
              )}
            >
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{hex}</span>
              {value === hex && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
              没有匹配的系列
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
