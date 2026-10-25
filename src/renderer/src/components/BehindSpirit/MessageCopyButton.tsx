import { useEffect, useRef, useState, type JSX } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '../../lib/utils'

interface MessageCopyButtonProps {
  text: string
  className?: string
}

export function MessageCopyButton({ text, className }: MessageCopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    []
  )

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        setCopied(false)
      }, 1500)
    } catch (error) {
      console.error('[MessageCopyButton] Failed to copy message:', error)
    }
  }

  return (
    <button
      type="button"
      aria-label={copied ? '已复制' : '复制'}
      onClick={() => void copy()}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
        copied &&
          'text-[#15803d] hover:text-[#15803d] dark:text-[#4ade80] dark:hover:text-[#4ade80]',
        className
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}
