import localCover from '../assets/textures/cover.jpg'
import localCover2 from '../assets/textures/cover2.jpg'
import localUnknown from '../assets/textures/unknown.jpg'

export const CARD_BACK_IMAGE = localCover

export const CARD_BACK_OPPONENT_IMAGE = localCover2

export const UNKNOWN_CARD_IMAGE = localUnknown

let imageVersion = 0

export function bumpCardImageVersion(): void {
  imageVersion += 1
}

export function getCardBack(controller: 0 | 1 = 0): string {
  return controller === 1 ? CARD_BACK_OPPONENT_IMAGE : CARD_BACK_IMAGE
}

export function getCardImageUrl(code: number | undefined, small = false): string {
  if (!code || code <= 0) {
    return CARD_BACK_IMAGE
  }
  const query = small ? `small=1&v=${imageVersion}` : `v=${imageVersion}`
  return `ygopic://card/${code}.jpg?${query}`
}

const DRAG_IMAGE_WIDTH = 64
const DRAG_IMAGE_HEIGHT = 92

export function setCardDragImage(dataTransfer: DataTransfer, source: Element | null): void {
  const image = source?.tagName === 'IMG' ? source : source?.querySelector('img')
  if (!(image instanceof HTMLImageElement)) return

  if (image.complete && image.naturalWidth > 0) {
    const preview = document.createElement('canvas')
    preview.width = DRAG_IMAGE_WIDTH
    preview.height = DRAG_IMAGE_HEIGHT
    preview.style.cssText = 'position:fixed;left:0;top:0;opacity:0.01;pointer-events:none'
    const context = preview.getContext('2d')
    if (context) {
      const iw = image.naturalWidth
      const ih = image.naturalHeight
      const scale = Math.max(DRAG_IMAGE_WIDTH / iw, DRAG_IMAGE_HEIGHT / ih)
      const sw = DRAG_IMAGE_WIDTH / scale
      const sh = DRAG_IMAGE_HEIGHT / scale
      context.drawImage(
        image,
        (iw - sw) / 2,
        (ih - sh) / 2,
        sw,
        sh,
        0,
        0,
        DRAG_IMAGE_WIDTH,
        DRAG_IMAGE_HEIGHT
      )
      document.body.appendChild(preview)
      const remove = (): void => {
        preview.remove()
        document.removeEventListener('dragend', remove, true)
        window.clearTimeout(timer)
      }
      document.addEventListener('dragend', remove, true)
      const timer = window.setTimeout(remove, 30_000)
      dataTransfer.setDragImage(preview, DRAG_IMAGE_WIDTH / 2, DRAG_IMAGE_HEIGHT / 2)
      return
    }
  }

  dataTransfer.setDragImage(image, image.width / 2, image.height / 2)
}

if (typeof window !== 'undefined' && window.api) {
  window.api.onCardImageUpdated(() => bumpCardImageVersion())
  window.api.onCustomCardsUpdated(() => bumpCardImageVersion())
}
