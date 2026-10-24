import { useState } from 'react'
import { CardImage } from './CardImage'
import { cn } from '../../lib/utils'

interface CardThumbProps {
  code?: number
  name: string
  className?: string
  imageClassName?: string
  nameClassName?: string
  title?: string
  fallback?: string
  showName?: boolean
}

export function CardThumb({
  code,
  name,
  className,
  imageClassName,
  nameClassName,
  title,
  fallback,
  showName = true
}: CardThumbProps) {
  const [failedCode, setFailedCode] = useState<number | null>(null)
  const failed = code !== undefined && failedCode === code

  return (
    <div className={cn('relative overflow-hidden', className)} title={title ?? name}>
      <CardImage
        code={code}
        small
        alt={name}
        fallback={fallback}
        onFallback={() => setFailedCode(code ?? null)}
        className={cn('h-full w-full object-cover', imageClassName)}
      />
      {showName && failed && (
        <span
          className={cn(
            'pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-1 text-center text-[9px] font-bold leading-tight break-all text-slate-700',
            nameClassName
          )}
        >
          {name}
        </span>
      )}
    </div>
  )
}
