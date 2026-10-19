import React, { useEffect, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { cn } from '../../lib/utils'

export const EngineFeedbackToast: React.FC = () => {
  const error = useDuelEngineStore((s) => s.error)
  const injectNotice = useDuelEngineStore((s) => s.injectNotice)
  const clearInjectNotice = useDuelEngineStore((s) => s.clearInjectNotice)
  const [hiddenError, setHiddenError] = useState<string | null>(null)

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setHiddenError(error), 3000)
    return () => clearTimeout(timer)
  }, [error])

  useEffect(() => {
    if (!injectNotice) return
    const timer = setTimeout(clearInjectNotice, 3600)
    return () => clearTimeout(timer)
  }, [injectNotice, clearInjectNotice])

  if (error && hiddenError !== error) {
    return (
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600/90 text-white text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-100 select-none">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  if (!injectNotice) return null
  return (
    <div
      className={cn(
        'fixed top-16 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-4 py-2 rounded-lg text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-100 select-none max-w-[82vw]',
        injectNotice.kind === 'warning'
          ? 'bg-amber-500/95 text-neutral-950'
          : 'bg-emerald-600/95 text-white'
      )}
    >
      {injectNotice.kind === 'warning' ? (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Check className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="truncate">{injectNotice.message}</span>
    </div>
  )
}
