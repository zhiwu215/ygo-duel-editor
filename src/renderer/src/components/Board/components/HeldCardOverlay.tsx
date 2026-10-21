import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDuelStore } from '../../../stores/useDuelStore'
import { useHeldCardStore } from '../../../stores/useHeldCardStore'
import { CardImage } from '../../ui/CardImage'
import { resolveCardName } from '../../../utils/cardNames'

const PREVIEW_WIDTH = 64
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 86) / 59)

const HeldCardPreview: React.FC<{ code: number }> = ({ code }) => {
  const point = useHeldCardStore((s) => s.point)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handleMove = (e: MouseEvent): void => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  const pos = cursor ?? point
  if (!pos) return null

  return createPortal(
    <div
      className="fixed z-[70] pointer-events-none"
      style={{
        left: pos.x - PREVIEW_WIDTH / 2,
        top: pos.y - PREVIEW_HEIGHT / 2,
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT
      }}
    >
      <CardImage
        code={code}
        small
        alt={resolveCardName(code)}
        className="w-full h-full rounded object-cover shadow-2xl ring-2 ring-blue-400/80"
      />
    </div>,
    document.body
  )
}

export const HeldCardOverlay: React.FC = () => {
  const instanceId = useHeldCardStore((s) => s.instanceId)
  const materialRef = useHeldCardStore((s) => s.materialRef)
  const release = useHeldCardStore((s) => s.release)
  const card = useDuelStore((s) =>
    instanceId ? s.state.cards.find((c) => c.instanceId === instanceId) : undefined
  )
  const materialCode = useDuelStore((s) => {
    if (!materialRef) return undefined
    const host = s.state.cards.find((c) => c.instanceId === materialRef.hostInstanceId)
    return host?.overlayMaterials[materialRef.index]
  })

  useEffect(() => {
    if (!instanceId && !materialRef) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') release()
    }
    const handleContextMenu = (e: MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      release()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('contextmenu', handleContextMenu, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true })
    }
  }, [instanceId, materialRef, release])

  useEffect(() => {
    if (instanceId && !card) release()
  }, [instanceId, card, release])

  useEffect(() => {
    if (materialRef && materialCode === undefined) release()
  }, [materialRef, materialCode, release])

  const code = card?.code ?? materialCode
  const previewKey =
    instanceId ?? (materialRef ? `mat_${materialRef.hostInstanceId}_${materialRef.index}` : null)

  if (!previewKey || code === undefined) return null

  return <HeldCardPreview key={previewKey} code={code} />
}
