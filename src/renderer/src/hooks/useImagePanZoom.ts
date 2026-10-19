import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
  SyntheticEvent,
  WheelEvent as ReactWheelEvent
} from 'react'

const MIN_IMAGE_ZOOM = 0.5
const MAX_IMAGE_ZOOM = 6
const IMAGE_ZOOM_FACTOR = 1.15

export interface ImagePanZoom {
  imageZoom: number
  imageOffset: { x: number; y: number }
  isPanning: boolean
  canPan: boolean
  baseScale: number
  stageRef: RefObject<HTMLDivElement | null>
  lastPanMovedRef: RefObject<boolean>
  resetImageView: () => void
  handleImageLoad: (e: SyntheticEvent<HTMLImageElement>) => void
  handleWheel: (e: ReactWheelEvent<HTMLDivElement>) => void
  handlePointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  handlePointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  endPan: (e: ReactPointerEvent<HTMLDivElement>) => void
}

export function useImagePanZoom(cardCode: number): ImagePanZoom {
  const [imageZoom, setImageZoom] = useState<number>(1)
  const [imageOffset, setImageOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [canPan, setCanPan] = useState<boolean>(false)
  const [baseScale, setBaseScale] = useState<number>(1)

  const stageRef = useRef<HTMLDivElement>(null)
  const panStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const lastPanMovedRef = useRef<boolean>(false)

  const resetImageView = useCallback((): void => {
    setImageZoom(1)
    setImageOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const img = stage?.querySelector('img')
    if (!stage || !(img instanceof HTMLImageElement)) return
    setCanPan(img.offsetWidth > stage.clientWidth || img.offsetHeight > stage.clientHeight)
  }, [imageZoom, cardCode])

  const handleImageLoad = (e: SyntheticEvent<HTMLImageElement>): void => {
    const img = e.currentTarget
    if (img.naturalHeight <= 0) return
    const rendered = img.getBoundingClientRect().height / (imageZoom || 1)
    setBaseScale(rendered > 0 ? rendered / img.naturalHeight : 1)
  }

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    if (e.deltaY === 0) return

    const factor = e.deltaY < 0 ? IMAGE_ZOOM_FACTOR : 1 / IMAGE_ZOOM_FACTOR
    const stage = stageRef.current
    if (!stage) {
      setImageZoom((zoom) => Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, zoom * factor)))
      return
    }

    const rect = stage.getBoundingClientRect()
    const cursorX = e.clientX - rect.left - rect.width / 2
    const cursorY = e.clientY - rect.top - rect.height / 2

    setImageZoom((zoom) => {
      const target = Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, zoom * factor))
      if (target === zoom) return zoom
      const ratio = target / zoom
      setImageOffset((prev) => ({
        x: cursorX - (cursorX - prev.x) * ratio,
        y: cursorY - (cursorY - prev.y) * ratio
      }))
      return target
    })
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    const stage = stageRef.current
    if (!stage) return
    e.preventDefault()
    stage.setPointerCapture(e.pointerId)
    panStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: imageOffset.x,
      originY: imageOffset.y,
      moved: false
    }
    setIsPanning(true)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const pan = panStateRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    e.preventDefault()
    const dx = e.clientX - pan.startX
    const dy = e.clientY - pan.startY
    if (!pan.moved && Math.hypot(dx, dy) > 3) {
      pan.moved = true
      lastPanMovedRef.current = true
    }
    setImageOffset({ x: pan.originX + dx, y: pan.originY + dy })
  }

  const endPan = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const pan = panStateRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    const stage = stageRef.current
    if (stage?.hasPointerCapture(e.pointerId)) {
      stage.releasePointerCapture(e.pointerId)
    }
    panStateRef.current = null
    setIsPanning(false)
    if (pan.moved) {
      requestAnimationFrame(() => {
        lastPanMovedRef.current = false
      })
    }
  }

  return {
    imageZoom,
    imageOffset,
    isPanning,
    canPan,
    baseScale,
    stageRef,
    lastPanMovedRef,
    resetImageView,
    handleImageLoad,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    endPan
  }
}
