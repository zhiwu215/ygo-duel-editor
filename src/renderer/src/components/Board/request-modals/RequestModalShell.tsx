import React from 'react'
import { cn } from '../../../lib/utils'

interface RequestModalShellProps {
  title?: string
  subtitle?: string
  width?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export const RequestModalShell: React.FC<RequestModalShellProps> = ({
  title,
  subtitle,
  width = 'max-w-md',
  children,
  footer
}) => (
  <div
    className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4 select-none animate-in fade-in"
    role="dialog"
    aria-modal="true"
  >
    <div
      className={cn(
        'flex max-h-[86vh] w-full flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-xl animate-in zoom-in-95 duration-100',
        width
      )}
    >
      {(title || subtitle) && (
        <div className="flex shrink-0 items-baseline gap-2 bg-foreground px-3 py-1.5 text-background dark:bg-muted dark:text-foreground">
          {title && (
            <h2 className="min-w-0 break-words text-[11px] font-semibold leading-relaxed tracking-wide">
              {title}
            </h2>
          )}
          {subtitle && (
            <span className="min-w-0 break-words text-[11px] leading-relaxed opacity-60">
              {subtitle}
            </span>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">{children}</div>
      {footer && (
        <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-border/60 px-3 py-2">
          {footer}
        </div>
      )}
    </div>
  </div>
)
