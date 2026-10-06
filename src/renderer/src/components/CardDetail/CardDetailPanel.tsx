import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import {
  formatCardTypeLine,
  formatCardStatsLine,
  formatCardSeriesLine
} from '../../utils/cardFormat'
import { HelpCircle, ZoomIn, X, Copy, Check, RotateCcw } from 'lucide-react'

const MIN_IMAGE_ZOOM = 0.5
const MAX_IMAGE_ZOOM = 6
const IMAGE_ZOOM_FACTOR = 1.15

export const CardDetailPanel: React.FC = () => {
  const { hoveredCard, selectedCardId, state } = useDuelStore()
  const [showImageModal, setShowImageModal] = useState<boolean>(false)
  const [imageZoom, setImageZoom] = useState<number>(1)
  const [imageOffset, setImageOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [copiedName, setCopiedName] = useState<boolean>(false)

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
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [canPan, setCanPan] = useState<boolean>(false)

  let currentCard = hoveredCard
  const selectedFieldCard = selectedCardId
    ? state.cards.find((c) => c.instanceId === selectedCardId)
    : undefined
  if (!currentCard && selectedFieldCard?.card) {
    currentCard = selectedFieldCard.card
  }

  const resetImageView = useCallback((): void => {
    setImageZoom(1)
    setImageOffset({ x: 0, y: 0 })
  }, [])

  const openImageModal = (): void => {
    resetImageView()
    setShowImageModal(true)
  }

  const closeImageModal = (): void => {
    setShowImageModal(false)
    resetImageView()
  }

  useEffect(() => {
    const stage = stageRef.current
    const img = imageRef.current
    if (!stage || !img) return
    const stageW = stage.clientWidth
    const stageH = stage.clientHeight
    const imgW = img.offsetWidth
    const imgH = img.offsetHeight
    const overflowX = imgW > stageW
    const overflowY = imgH > stageH
    setCanPan(overflowX || overflowY)
  }, [showImageModal, imageZoom, currentCard?.id])

  const handleImageWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    if (e.deltaY === 0) return

    const factor = e.deltaY < 0 ? IMAGE_ZOOM_FACTOR : 1 / IMAGE_ZOOM_FACTOR
    const stage = stageRef.current
    if (!stage) {
      setImageZoom((zoom) =>
        Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, zoom * factor))
      )
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

  const handleImagePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
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

  const handleImagePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
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

  useEffect(() => {
    if (!currentCard && selectedFieldCard && !selectedFieldCard.card) {
      window.api
        .getCardsByIds([selectedFieldCard.code])
        .then((cardMap) => {
          const cardData = cardMap[selectedFieldCard.code]
          if (cardData) {
            useDuelStore.getState().setCardData(selectedFieldCard.instanceId, cardData)
          }
        })
        .catch((err) => {
          void err
        })
    }
  }, [currentCard, selectedFieldCard])

  useEffect(() => {
    if (!showImageModal) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        setShowImageModal(false)
        resetImageView()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [showImageModal, resetImageView])

  const handleCopyName = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!currentCard?.name) return
    try {
      await navigator.clipboard.writeText(currentCard.name)
      setCopiedName(true)
      setTimeout(() => setCopiedName(false), 1500)
    } catch (err) {
      console.error('[CardDetailPanel] Failed to copy card name:', err)
    }
  }

  if (!currentCard) {
    return (
      <div className="w-full h-full bg-card/30 flex flex-col select-none">
        <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
          <span className="text-xs font-bold text-foreground">卡片详情</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none">
          <HelpCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-foreground/80">尚未选择卡片</p>
        </div>
      </div>
    )
  }

  const statsLine = formatCardStatsLine(currentCard)
  const seriesLine = formatCardSeriesLine(currentCard)

  return (
    <>
      <div className="w-full h-full bg-card/40 flex flex-col overflow-hidden">
        <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0 bg-neutral-100/60 dark:bg-neutral-900/60">
          <span className="text-xs font-bold text-foreground">卡片详情</span>
        </div>

        <div className="pt-3 pb-2.5 px-4 flex flex-col items-center select-none shrink-0">
          <div
            className="group relative cursor-zoom-in rounded-md overflow-hidden shadow-md border border-border/80 bg-black/40"
            onClick={openImageModal}
            title="点击放大查看卡图"
          >
            <img
              src={getCardImageUrl(currentCard.id)}
              alt={currentCard.name}
              className="w-[200px] h-[291px] object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src !== CARD_BACK_IMAGE) {
                  target.src = CARD_BACK_IMAGE
                }
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-medium backdrop-blur-sm shadow-md">
                <ZoomIn className="w-3.5 h-3.5" />
                <span>点击放大</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2 select-text">
          <div
            onClick={handleCopyName}
            className="group relative flex items-center justify-center px-2 py-1 rounded border border-border/70 bg-muted/60 dark:bg-muted/30 shadow-inner text-center cursor-pointer hover:bg-muted/80 transition-colors select-none"
            title="点击快速复制卡名"
          >
            <span className="font-bold text-xs text-foreground truncate">
              {currentCard.name}[{currentCard.id}]
            </span>
            <span className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
              {copiedName ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 select-text leading-snug">
            <div>{formatCardTypeLine(currentCard)}</div>

            {statsLine && <div>{statsLine}</div>}

            {seriesLine && <div>{seriesLine}</div>}
          </div>

          <div className="pt-1 text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap select-text cursor-text selection:bg-primary/25">
            {currentCard.desc}
          </div>
        </div>
      </div>

      {showImageModal && (
        <div
          className="fixed inset-0 z-[70] overflow-hidden bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none animate-in fade-in"
          onClick={(e) => {
            if (lastPanMovedRef.current) return
            if (e.target === e.currentTarget) closeImageModal()
          }}
          onWheel={(e) => e.preventDefault()}
        >
          <div
            className="absolute top-4 right-4 flex items-start gap-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-end gap-1.5">
              <div className="text-white/90 text-xs font-medium bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
                {currentCard.name}
              </div>
              <div className="text-white/60 text-[11px] leading-tight text-right">
                <div>滚轮缩放 {Math.round(imageZoom * 100)}%</div>
                {canPan && <div>按住拖动查看其它区域</div>}
                <div>按 Esc 或点击空白处关闭</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetImageView()
                }}
                disabled={imageZoom === 1 && imageOffset.x === 0 && imageOffset.y === 0}
                className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed text-white/80 hover:text-white flex items-center justify-center transition-colors border border-white/15 cursor-pointer"
                title="复位视图"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={closeImageModal}
                className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center transition-colors border border-white/15 cursor-pointer"
                title="关闭 (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={stageRef}
            className={`relative max-h-[85vh] max-w-[90vw] flex items-center justify-center touch-none ${
              canPan ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
            }`}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleImageWheel}
            onPointerDown={handleImagePointerDown}
            onPointerMove={handleImagePointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <img
              ref={imageRef}
              src={getCardImageUrl(currentCard.id)}
              alt={currentCard.name}
              draggable={false}
              className="max-h-[82vh] max-w-[85vw] object-contain rounded-lg shadow-2xl border border-white/10 transition-transform duration-100 ease-out"
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
        </div>
      )}
    </>
  )
}
