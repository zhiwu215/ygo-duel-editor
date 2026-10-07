import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import React from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { useDuelStore } from '../../../stores/useDuelStore'
import { isExportableMatch } from '@shared/index'
import { cn } from '../../../lib/utils'

export const ExportStatusBadge: React.FC = () => {
  const { state } = useDuelStore()
  const canExport = isExportableMatch(state.matchConfig)

  const t0 = state.matchConfig?.team0Count ?? 1
  const t1 = state.matchConfig?.team1Count ?? 1

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border select-none transition-colors cursor-help',
              canExport
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            )}
          >
            {canExport ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                <span>可导出</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                <span>自定义人数 · 仅编排不可导出</span>
              </>
            )}
          </div>
        }
      />
      <TooltipContent>
        {canExport
          ? '当前对阵符合 ocgcore 单机引擎规范，可正常导出 Lua 脚本'
          : `当前对阵 (${t0}v${t1}) 仅用于剧情编排。因 ocgcore 单机引擎限制，仅 1v1 与 2v2 双打支持导出为可运行的 Lua 脚本。`}
      </TooltipContent>
    </Tooltip>
  )
}
