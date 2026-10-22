import type { ImgHTMLAttributes } from 'react'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'

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
  return (
    <img
      {...rest}
      src={getCardImageUrl(code, small)}
      onError={(e) => {
        const el = e.currentTarget
        if (el.src !== fallback) el.src = fallback
        onFallback?.()
      }}
    />
  )
}
