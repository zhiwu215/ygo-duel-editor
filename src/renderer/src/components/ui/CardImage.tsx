import type { ImgHTMLAttributes } from 'react'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { isPlaceholderCard } from '@shared/index'

type CardImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  code: number | undefined
  small?: boolean
  fallback?: string
  onFallback?: () => void
}

export function CardImage({
  code,
  small = false,
  fallback = UNKNOWN_CARD_IMAGE,
  onFallback,
  ...rest
}: CardImageProps) {
  const source = isPlaceholderCard(code)
    ? UNKNOWN_CARD_IMAGE
    : code && code > 0
      ? getCardImageUrl(code, small)
      : fallback

  return (
    <img
      {...rest}
      src={source}
      onError={(e) => {
        const el = e.currentTarget
        if (el.src !== fallback) el.src = fallback
        onFallback?.()
      }}
    />
  )
}
