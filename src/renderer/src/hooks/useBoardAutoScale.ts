import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

export function useBoardAutoScale(): {
  viewportRef: RefObject<HTMLDivElement | null>
  wrapperRef: RefObject<HTMLDivElement | null>
  boardRef: RefObject<HTMLDivElement | null>
  scale: number
  naturalW: number
} {
  const viewportRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [naturalW, setNaturalW] = useState(0)
  const metricsRef = useRef({ scale: 1, w: 0, h: 0 })
  const appliedScaleRef = useRef(1)
  const signalRef = useRef({ w: 0, h: 0 })

  useLayoutEffect(() => {
    appliedScaleRef.current = scale
  }, [scale])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const wrapper = wrapperRef.current
    const board = boardRef.current
    if (!viewport || !wrapper || !board) return

    let frame = 0

    const measure = (): void => {
      const zoom = appliedScaleRef.current || 1

      const boardW = board.getBoundingClientRect().width / zoom
      if (boardW <= 0) return

      const wrapperH = wrapper.getBoundingClientRect().height / zoom

      const widthChanged = Math.abs(boardW - metricsRef.current.w) > 0.5
      const heightChanged = Math.abs(wrapperH - metricsRef.current.h) > 0.5
      if (widthChanged) {
        metricsRef.current.w = boardW
        setNaturalW(boardW)
      }
      if (heightChanged) {
        metricsRef.current.h = wrapperH
      }

      const style = window.getComputedStyle(viewport)
      const availW =
        viewport.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0)
      const availH =
        viewport.clientHeight -
        (parseFloat(style.paddingTop) || 0) -
        (parseFloat(style.paddingBottom) || 0)

      const signalChanged =
        Math.abs(availW - signalRef.current.w) > 1 || Math.abs(availH - signalRef.current.h) > 1
      if (!signalChanged && !widthChanged && !heightChanged) return
      signalRef.current = { w: availW, h: availH }

      const ratioW = availW > 1 ? (availW - 1) / boardW : 1
      const ratioH = availH > 1 && wrapperH > 0 ? (availH - 1) / wrapperH : 1
      const next = Math.max(1, Math.min(ratioW, ratioH))

      if (Math.abs(next - metricsRef.current.scale) > 0.001) {
        metricsRef.current.scale = next
        setScale(next)
      }
    }

    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    measure()
    const observer = new ResizeObserver(schedule)
    observer.observe(viewport)
    observer.observe(wrapper)
    observer.observe(board)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return { viewportRef, wrapperRef, boardRef, scale, naturalW }
}
