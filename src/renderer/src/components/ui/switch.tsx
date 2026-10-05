import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from 'cn'

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

function Switch({ className, checked, onCheckedChange, disabled, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onCheckedChange?.(value)}
      className={cn(
        'relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full bg-neutral-300 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-700 data-checked:bg-emerald-500 dark:data-checked:bg-emerald-500',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 translate-x-[2px] rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-[15px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
