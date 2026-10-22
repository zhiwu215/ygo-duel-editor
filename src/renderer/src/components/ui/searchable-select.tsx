import * as React from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from 'cn'

export interface SearchableSelectOption<Value extends string | number = number> {
  value: Value
  label: string
}

interface SearchableSelectProps<Value extends string | number> {
  options: readonly SearchableSelectOption<Value>[]
  value: Value
  onValueChange: (value: Value) => void
  ariaLabel: string
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
}

export function SearchableSelect<Value extends string | number>({
  options,
  value,
  onValueChange,
  ariaLabel,
  placeholder = '请选择',
  emptyLabel = '无匹配项',
  disabled = false,
  className
}: SearchableSelectProps<Value>): React.JSX.Element {
  const items = React.useMemo(
    () =>
      Combobox.createItems(options, {
        getValue: (option) => option.value,
        getLabel: (option) => option.label
      }),
    [options]
  )

  return (
    <Combobox.Root
      items={items}
      value={value}
      disabled={disabled}
      autoHighlight
      filter={(item: SearchableSelectOption<Value>, query: string) => {
        const text = query.trim().toLowerCase()
        if (!text) return true
        return item.label.toLowerCase().includes(text) || String(item.value).includes(text)
      }}
      onValueChange={(next) => {
        if (next != null) onValueChange(next)
      }}
    >
      <Combobox.InputGroup
        className={cn(
          'flex h-8 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-transparent pr-1 pl-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
          disabled && 'pointer-events-none opacity-50',
          className
        )}
      >
        <Combobox.Input
          aria-label={ariaLabel}
          placeholder={placeholder}
          title="可直接输入名称筛选"
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
          className="h-full w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        <Combobox.Trigger
          disabled={disabled}
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDownIcon className="pointer-events-none size-4" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} align="start" className="isolate z-50">
          <Combobox.Popup className="max-h-(--available-height) min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[scale,opacity] duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0">
            <Combobox.Empty className="px-2.5 py-3 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </Combobox.Empty>
            <Combobox.List className="max-h-60 overflow-y-auto overscroll-contain p-1">
              {(option: SearchableSelectOption<Value>) => (
                <Combobox.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-default items-center rounded-md py-1 pr-8 pl-2 text-xs outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <Combobox.ItemIndicator className="absolute right-2 flex size-3.5 items-center justify-center">
                    <CheckIcon className="pointer-events-none size-3.5" />
                  </Combobox.ItemIndicator>
                  {option.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
