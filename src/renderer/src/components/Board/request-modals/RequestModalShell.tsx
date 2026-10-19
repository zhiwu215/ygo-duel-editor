import React from 'react'
import { Sparkles } from 'lucide-react'
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
    className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45 p-4 select-none animate-in fade-in"
    role="dialog"
    aria-modal="true"
  >
    <div
      className={cn(
        'flex max-h-[86vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 duration-100',
        width
      )}
    >
      {(title || subtitle) && (
        <div className="flex shrink-0 items-start gap-2 border-b border-border/70 bg-muted/40 px-4 py-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            {title && <h2 className="break-words text-sm font-bold leading-snug">{title}</h2>}
            {subtitle && (
              <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      {footer && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/70 bg-muted/30 px-3 py-2.5">
          {footer}
        </div>
      )}
    </div>
  </div>
)
