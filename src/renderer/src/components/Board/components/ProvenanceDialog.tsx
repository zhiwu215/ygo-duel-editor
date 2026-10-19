import React from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { useEngineCardEditStore } from '../../../stores/useEngineCardEditStore'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { LOCATION_NAMES } from '@shared/index'
import { CornerUpLeft, History, Loader2 } from 'lucide-react'

const controllerName = (controller: 0 | 1): string => (controller === 0 ? '我方' : '对方')

const locationName = (location: number): string => LOCATION_NAMES[location] ?? `区域 ${location}`

export const ProvenanceDialog: React.FC = () => {
  const provenanceTarget = useEngineCardEditStore((s) => s.provenanceTarget)
  const provenance = useEngineCardEditStore((s) => s.provenance)
  const provenanceLoading = useEngineCardEditStore((s) => s.provenanceLoading)
  const closeProvenance = useEngineCardEditStore((s) => s.closeProvenance)
  const timeline = useDuelEngineStore((s) => s.timeline)
  const jumpToStep = useDuelEngineStore((s) => s.jumpToStep)

  const node =
    provenance && (provenance.kind === 'inject' || provenance.kind === 'drawn')
      ? (timeline.find((item) => item.id === provenance.nodeId) ?? null)
      : null

  const jump = async (stepId: string | null): Promise<void> => {
    if (!stepId) return
    await jumpToStep(stepId)
    closeProvenance()
  }

  return (
    <Dialog open={Boolean(provenanceTarget)} onOpenChange={(open) => !open && closeProvenance()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <History className="w-4 h-4 text-amber-500" />
            <span>卡片来源 — {provenanceTarget?.name ?? '卡片'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground">
          <span className="font-mono">{provenanceTarget?.code}</span>
        </div>

        {provenanceLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>正在溯源…</span>
          </div>
        )}

        {!provenanceLoading && provenance?.kind === 'inject' && (
          <div className="flex flex-col gap-2 text-xs">
            <p className="text-foreground">
              该卡由剧情安排加入（操作流第 {provenance.opIndex + 1} 条）。
            </p>
            {node && (
              <p className="text-muted-foreground">
                第 {node.stepNumber} 步：{node.title}
              </p>
            )}
            <p className="text-muted-foreground">
              注入命令：
              {provenance.command.op === 'add-card'
                ? `${provenance.command.to} / ${provenance.command.code}`
                : `调整 LP 至 ${provenance.command.lp}`}
            </p>
          </div>
        )}

        {!provenanceLoading && provenance?.kind === 'drawn' && (
          <div className="flex flex-col gap-2 text-xs">
            <p className="text-foreground">
              {controllerName(provenance.player)}第 {provenance.drawIndex} 次抽卡获得。
            </p>
            {node && (
              <p className="text-muted-foreground">
                第 {node.stepNumber} 步：{node.title}
              </p>
            )}
            {node?.boardState && (
              <p className="text-muted-foreground">
                来源节点序号：{node.stepNumber}（操作流第 {provenance.opIndex + 1} 条）
              </p>
            )}
          </div>
        )}

        {!provenanceLoading && provenance?.kind === 'initial' && (
          <div className="flex flex-col gap-2 text-xs">
            <p className="text-foreground">该卡来自初始布置。</p>
            <p className="text-muted-foreground">
              {controllerName(provenance.controller)}
              {locationName(provenance.location)} · 序号 {provenance.sequence + 1}
            </p>
          </div>
        )}

        {!provenanceLoading && (!provenance || provenance.kind === 'unknown') && (
          <p className="text-xs text-amber-500">
            无法安全溯源（该卡可能由效果生成、移动或已不在场上）。
          </p>
        )}

        <DialogFooter>
          {node && (
            <Button size="sm" variant="secondary" onClick={() => void jump(node.id)}>
              <CornerUpLeft className="w-3.5 h-3.5" />
              跳到该节点
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={closeProvenance}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
