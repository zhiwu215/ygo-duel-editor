import React, { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { EngineCardEditTarget, useEngineCardEditStore } from '../../stores/useEngineCardEditStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { CdbCard, LOCATION_NAMES } from '@shared/index'
import { ArrowLeftRight, CornerUpLeft, History, Loader2, Search } from 'lucide-react'

const controllerName = (controller: 0 | 1): string => (controller === 0 ? '我方' : '对方')

const locationName = (location: number): string => LOCATION_NAMES[location] ?? `区域 ${location}`

export const EngineCardEditDialogs: React.FC = () => {
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
    <>
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

      <ReplaceCardDialog />
    </>
  )
}

const ReplaceCardDialog: React.FC = () => {
  const replaceTarget = useEngineCardEditStore((s) => s.replaceTarget)
  const closeReplace = useEngineCardEditStore((s) => s.closeReplace)

  return (
    <Dialog open={Boolean(replaceTarget)} onOpenChange={(open) => !open && closeReplace()}>
      <DialogContent className="max-w-lg">
        {replaceTarget && <ReplaceCardForm target={replaceTarget} onClose={closeReplace} />}
      </DialogContent>
    </Dialog>
  )
}

const ReplaceCardForm: React.FC<{
  target: EngineCardEditTarget
  onClose: () => void
}> = ({ target, onClose }) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<CdbCard[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const doSearch = async (): Promise<void> => {
    const query = keyword.trim()
    if (!query || searching) return
    setSearching(true)
    setSearchError(null)
    try {
      const res = /^\d+$/.test(query)
        ? await window.api.searchCards({ code: Number(query) })
        : await window.api.searchCards({ keyword: query, searchDesc: true })
      setResults(res.cards.slice(0, 30))
    } catch {
      setResults([])
      setSearchError('搜索失败，请重试')
    } finally {
      setSearching(false)
    }
  }

  const pick = async (card: CdbCard): Promise<void> => {
    const ok = await useDuelEngineStore.getState().replaceCard(target.ref, card.id)
    if (ok) onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-sm">
          <ArrowLeftRight className="w-4 h-4 text-blue-400" />
          <span>替换卡片 — {target.name}</span>
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void doSearch()
        }}
      >
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入卡名或卡密搜索"
            className="h-8 pl-8 text-xs"
            autoFocus
          />
        </div>
        <Button type="submit" size="sm" disabled={searching || !keyword.trim()}>
          {searching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          搜索
        </Button>
      </form>

      {searchError && <p className="text-xs text-rose-500">{searchError}</p>}

      <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
        {results.map((card) => (
          <button
            key={card.id}
            type="button"
            disabled={loading}
            onClick={() => void pick(card)}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-border/60 bg-card/60 hover:border-blue-400/60 hover:bg-card text-left transition-colors disabled:opacity-50"
          >
            <span className="text-xs font-medium truncate">{card.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">{card.id}</span>
          </button>
        ))}
        {results.length === 0 && !searching && !searchError && (
          <p className="text-xs text-muted-foreground py-6 text-center">
            搜索后点击结果即可替换（将自动重演到当前步骤）
          </p>
        )}
      </div>

      <DialogFooter>
        <Button size="sm" variant="outline" onClick={onClose}>
          取消
        </Button>
      </DialogFooter>
    </>
  )
}
