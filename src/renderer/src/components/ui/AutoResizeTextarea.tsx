import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

interface AutoResizeTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'style' | 'rows' | 'value'
> {
  style?: React.CSSProperties
  rows?: number
  value?: string
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  style,
  rows = 1,
  value,
  ...props
}) => {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  const resize = useCallback(() => {
    const element = innerRef.current
    if (!element) return
    element.style.height = 'auto'
    const borderHeight = element.offsetHeight - element.clientHeight
    element.style.height = `${element.scrollHeight + borderHeight}px`
  }, [])

  useLayoutEffect(() => {
    resize()
  }, [value, resize])

  useEffect(() => {
    const element = innerRef.current
    if (!element) return
    const observer = new ResizeObserver(resize)
    observer.observe(element.parentElement ?? element)
    window.addEventListener('resize', resize)
    if (document.fonts) {
      void document.fonts.ready.then(resize)
    }
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [resize])

  return (
    <textarea
      {...props}
      value={value}
      rows={rows}
      ref={innerRef}
      style={{ ...style, resize: 'none', overflowY: 'hidden' }}
    />
  )
}
