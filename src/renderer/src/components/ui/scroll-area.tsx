import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'
import { cn } from 'cn'

function ScrollArea({
  className,
  children,
  horizontal,
  ...props
}: ScrollAreaPrimitive.Root.Props & { horizontal?: boolean }) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full overscroll-contain rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      {horizontal && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        'z-20 flex touch-none p-[3px] opacity-0 transition-opacity duration-300 ease-out select-none hover:opacity-100 data-[scrolling]:opacity-100 data-[scrolling]:duration-0 data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:w-2.5',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-foreground/25 transition-colors duration-150 hover:bg-foreground/45"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
