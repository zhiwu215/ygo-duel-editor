import { useState } from 'react'
import { PLACEHOLDER_CARD_LABEL, PLACEHOLDER_CARD_NAME, isPlaceholderCard } from '@shared/index'
import { CardImage } from './CardImage'
import { CARD_BACK_IMAGE } from '../../utils/cardImage'
import { cn } from '../../lib/utils'

interface CardThumbProps {
  code?: number
  name: string
  className?: string
  imageClassName?: string
  nameClassName?: string
  fallback?: string
  showName?: boolean
}

export function CardThumb({
  code,
  name,
  className,
  imageClassName,
  nameClassName,
  fallback,
  showName = true
}: CardThumbProps) {
  const [failedCode, setFailedCode] = useState<number | null>(null)
  const failed = code !== undefined && failedCode === code
  const placeholder = isPlaceholderCard(code)
  const displayName = placeholder ? PLACEHOLDER_CARD_NAME : name

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        backgroundImage: `url(${CARD_BACK_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <CardImage
        code={code}
        small
        alt={displayName}
        draggable={false}
        fallback={fallback}
        onFallback={() => setFailedCode(code ?? null)}
        className={cn('h-full w-full object-cover', imageClassName)}
      />
      {placeholder && (
        <span className="pointer-events-none absolute inset-x-[15%] bottom-[27%] top-[20%] z-10 flex items-center justify-center text-[11px] font-bold tracking-[0.2em] text-slate-800">
          {PLACEHOLDER_CARD_LABEL}
        </span>
      )}
      {showName && failed && !placeholder && (
        <span
          className={cn(
            'pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-1 text-center text-[9px] font-bold leading-tight break-all text-slate-700',
            nameClassName
          )}
        >
          {displayName}
        </span>
      )}
    </div>
  )
}
