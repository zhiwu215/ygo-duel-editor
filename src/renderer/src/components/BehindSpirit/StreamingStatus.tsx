import { useEffect, useState, type JSX } from 'react'

interface StreamingStatusProps {
  startTime: number
  label: string
}

function formatDuration(startTime: number, now: number): string {
  const total = Math.max(0, Math.floor((now - startTime) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`
}

export function StreamingStatus({ startTime, label }: StreamingStatusProps): JSX.Element {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="flex select-none items-center gap-1.5 px-1 pt-0.5 text-[10px] leading-4 text-muted-foreground">
      <span className="sr-only" role="status" aria-live="polite">
        {label}
      </span>
      <span className="flex items-center gap-[2px]" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1 w-1 animate-pulse rounded-full bg-current"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
      </span>
      <span className="animated-gradient-text font-medium" aria-hidden="true">
        {label}
      </span>
      <span className="text-muted-foreground/60" aria-hidden="true">
        · {formatDuration(startTime, now)}
      </span>
    </div>
  )
}
