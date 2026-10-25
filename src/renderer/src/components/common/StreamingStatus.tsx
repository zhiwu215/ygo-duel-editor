import { useEffect, useState, type JSX } from 'react'
import { formatElapsed } from '../../utils/formatElapsed'

interface StreamingStatusProps {
  startTime: number
  label: string
}

export function StreamingStatus({ startTime, label }: StreamingStatusProps): JSX.Element {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="flex min-w-0 select-none items-center gap-1.5 px-1 pt-0.5 text-[10px] leading-4 text-muted-foreground">
      <span className="sr-only" role="status" aria-live="polite">
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-[2px]" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1 w-1 animate-pulse rounded-full bg-current"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
      </span>
      <span
        className="animated-gradient-text min-w-0 flex-1 truncate font-medium"
        aria-hidden="true"
      >
        {label}
      </span>
      <span className="shrink-0 text-muted-foreground/60" aria-hidden="true">
        · {formatElapsed(now - startTime)}
      </span>
    </div>
  )
}
