import React from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { useDuelStore } from '../../../stores/useDuelStore'
import { isExportableMatch, isIndependentLpTag } from '@shared/index'
import { cn } from '../../../lib/utils'

export const ExportStatusBadge: React.FC = () => {
  const { state } = useDuelStore()
  const canExport = isExportableMatch(state.matchConfig)
  const independentTag = isIndependentLpTag(state.matchConfig)
  const label = canExport ? '可导出' : independentTag ? '仅近似校验' : '仅编排不可导出'

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border select-none transition-colors',
        canExport
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
      )}
    >
      {canExport ? (
        <>
          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
          <span>{label}</span>
        </>
      ) : (
        <>
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
          <span>{label}</span>
        </>
      )}
    </div>
  )
}
