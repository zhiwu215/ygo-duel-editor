import React from 'react'
import { Clapperboard, SkipBack, SkipForward, Square, FileDown } from 'lucide-react'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { alertDialog } from '../../stores/useDialogStore'
import { Button } from '../ui/button'

export const ReplayBar: React.FC = () => {
  const replayInfo = useDuelEngineStore((s) => s.replayInfo)
  const timeline = useDuelEngineStore((s) => s.timeline)
  const currentStepId = useDuelEngineStore((s) => s.currentStepId)
  const loading = useDuelEngineStore((s) => s.loading)
  const undo = useDuelEngineStore((s) => s.undo)
  const redo = useDuelEngineStore((s) => s.redo)
  const stopEngine = useDuelEngineStore((s) => s.stopEngine)
  const convertReplayToPuzzle = useDuelEngineStore((s) => s.convertReplayToPuzzle)

  if (!replayInfo) return null

  const handleConvert = (): void => {
    if (convertReplayToPuzzle()) {
      void alertDialog(
        '已将当前回放场面转为可编辑残局。\n\n默认按大师规则 2020 解析，如原对局规则不同请手动调整；可通过「另存为...」保存为工程。'
      )
    }
  }

  const currentIndex = timeline.findIndex((node) => node.id === currentStepId)
  const canPrev = !loading && currentIndex > 0
  const canNext = !loading && currentIndex >= 0 && currentIndex < timeline.length - 1

  return (
    <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 rounded-lg border border-violet-500/60 bg-violet-50/95 px-2.5 py-1.5 shadow-xl backdrop-blur-md dark:border-violet-400/60 dark:bg-violet-950/90">
      <Clapperboard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
      <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-100 max-w-40 truncate">
        回放：{replayInfo.fileName}
      </span>
      <span className="text-[11px] tabular-nums text-violet-600/80 dark:text-violet-300/80">
        {currentIndex < 0 ? '—' : `${currentIndex + 1} / ${timeline.length}`}
      </span>
      <div className="flex items-center gap-1 ml-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0"
          disabled={!canPrev}
          onClick={() => void undo()}
          title="上一步"
        >
          <SkipBack className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0"
          disabled={!canNext}
          onClick={() => void redo()}
          title="下一步"
        >
          <SkipForward className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0"
          disabled={loading}
          onClick={handleConvert}
          title="将当前场面转为可编辑残局"
        >
          <FileDown className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0"
          disabled={loading}
          onClick={stopEngine}
          title="退出回放，恢复导入前的残局"
        >
          <Square className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
