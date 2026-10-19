import React, { type JSX } from 'react'

interface SettingsRowProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function SettingsRow({ title, description, children }: SettingsRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4 border-b border-border/60 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 break-all">{description}</div>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
