import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { X, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent } from '../ui/dialog'

const MIN_IMAGE_ZOOM = 0.5
const MAX_IMAGE_ZOOM = 6
const IMAGE_ZOOM_FACTOR = 1.15

interface CardImageViewerProps {
  cardCode: number
  cardName: string
  onClose: () => void
}

export const CardImageViewer: React.FC<CardImageViewerProps> = ({
  cardCode,
  cardName,
  onClose
}) => {
  const [imageZoom, setImageZoom] = useState<number>(1)
  const [imageOffset, setImageOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [canPan, setCanPan] = useState<boolean>(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
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
    const img = imageRef.current
    if (!stage || !img) return
    setCanPan(img.offsetWidth > stage.clientWidth || img.offsetHeight > stage.clientHeight)
  }, [imageZoom, cardCode])

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
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

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
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

  const endPan = (e: React.PointerEvent<HTMLDivElement>): void => {
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

  return (
    <Dialog
      open
      disablePointerDismissal={false}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        showCloseButton={false}
        className="bg-transparent border-0 shadow-none p-0 max-w-none sm:max-w-none w-screen h-screen top-0 left-0 -translate-x-0 -translate-y-0 rounded-none overflow-hidden select-none flex items-center justify-center"
        onWheel={(e) => e.preventDefault()}
        onClick={(e) => {
          if (lastPanMovedRef.current) return
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className="absolute top-4 right-4 flex items-start gap-3 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-end gap-1.5">
            <div className="text-white/90 text-xs font-medium bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
              {cardName}
            </div>
            <div className="text-[11px] leading-tight text-right text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.7)]">
              <div>滚轮缩放 {Math.round(imageZoom * 100)}%</div>
              {canPan && <div>按住拖动查看其它区域</div>}
              <div>按 Esc 或点击空白处关闭</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={resetImageView}
                    disabled={imageZoom === 1 && imageOffset.x === 0 && imageOffset.y === 0}
                    className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed text-white/80 hover:text-white flex items-center justify-center transition-colors border border-white/15 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                }
              />
              <TooltipContent>复位视图</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center transition-colors border border-white/15 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                }
              />
              <TooltipContent>关闭 (Esc)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div
          ref={stageRef}
          className={`relative max-h-[85vh] max-w-[90vw] flex items-center justify-center touch-none ${
            canPan ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
          }`}
          onClick={(e) => {
            if (e.target !== e.currentTarget) return
            if (lastPanMovedRef.current) return
            onClose()
          }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <img
            ref={imageRef}
            src={getCardImageUrl(cardCode)}
            alt={cardName}
            draggable={false}
            className={`max-h-[82vh] max-w-[85vw] object-contain rounded-lg shadow-2xl border border-white/10 transition-transform duration-100 ease-out ${
              canPan ? '' : 'cursor-zoom-in'
            }`}
            style={{
              transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageZoom})`,
              transformOrigin: 'center center'
            }}
            onError={(e) => {
              const target = e.currentTarget
              if (target.src !== CARD_BACK_IMAGE) {
                target.src = CARD_BACK_IMAGE
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
