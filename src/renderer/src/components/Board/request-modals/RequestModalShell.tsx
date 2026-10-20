import React from 'react'
import { cn } from '../../../lib/utils'

interface RequestModalShellProps {
  title?: string
  subtitle?: string
  width?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

const stripPlayerPrefix = (text?: string): string | undefined => text?.replace(/^Player \d+\s*/, '')

export const RequestModalShell: React.FC<RequestModalShellProps> = ({
  title,
  subtitle,
  width = 'max-w-md',
  children,
  footer
}) => {
  const barTitle = stripPlayerPrefix(title)
  const barSubtitle = stripPlayerPrefix(subtitle)
  return (
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
        {(barTitle || barSubtitle) && (
          <div className="flex shrink-0 items-baseline gap-2 bg-foreground px-3 py-1.5 text-background dark:bg-muted dark:text-foreground">
            {barTitle && (
              <h2 className="min-w-0 break-words text-[11px] font-semibold leading-relaxed tracking-wide">
                {barTitle}
              </h2>
            )}
            {barSubtitle && (
              <span className="min-w-0 break-words text-[11px] leading-relaxed opacity-60">
                {barSubtitle}
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
}
