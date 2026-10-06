import { useState, type JSX } from 'react'
import { Check, ChevronDown, ChevronRight, Loader2, Sliders } from 'lucide-react'
import {
  AGENT_BOARD_FACING_NAMES,
  AGENT_BOARD_ZONE_NAMES,
  ACTION_TYPE_NAMES,
  AgentBoardSetupProposal,
  AgentStepProposal,
  PHASE_SHORT_NAMES
} from '@shared/index'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export interface DuelProposalSummaryCardProps {
  /** 开局布局提案（转写任务会有；纯战术推演可能只有步骤） */
  setup?: AgentBoardSetupProposal
  proposals: AgentStepProposal[]
  applied: boolean
  applying: boolean
  error: string | null
  onApply: () => void
}

/**
 * 对局整理提案的汇总卡（替代原先「布局预览大卡 + 逐条步骤大卡」两块）
 *
 * 气泡里只默认给一行摘要与一个应用入口，布局落位与逐步详情默认折叠 ——
 * 转写一局动辄二十多步，全量展开会把对话窗口撑爆；详情在台本工作台里看更合适。
 */
export function DuelProposalSummaryCard({
  setup,
  proposals,
  applied,
  applying,
  error,
  onApply
}: DuelProposalSummaryCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const turnCount = new Set(proposals.map((s) => s.turn)).size
  const warnings = setup?.warnings ?? []
  const placements = setup?.cards ?? []

  return (
    <div className="mt-3 pt-2.5 border-t border-border/60 space-y-2">
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-foreground flex items-center gap-1 text-xs">
          <Sliders className="w-3.5 h-3.5" />
          <span>对局整理提案</span>
        </span>

        <Button
          size="xs"
          onClick={onApply}
          disabled={applying || applied}
          className="h-6 text-[10px] gap-1 font-bold shrink-0"
        >
          {applying ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>应用中...</span>
            </>
          ) : applied ? (
            <>
              <Check className="w-3 h-3" />
              <span>已应用到决斗场</span>
            </>
          ) : (
            <span>应用到决斗场</span>
          )}
        </Button>
      </div>

      <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-mono">
          共 {proposals.length} 步 · {turnCount} 个回合
        </span>
        {placements.length > 0 && <span>开局布局 {placements.length} 张卡</span>}
        {warnings.length > 0 && (
          <span title={warnings.join('\n')} className="text-amber-500">
            {warnings.length} 条落位警告
          </span>
        )}
      </div>

      {error && (
        <div className="rounded bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive leading-relaxed">
          {error}
        </div>
      )}

      {(placements.length > 0 || proposals.length > 0) && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>{expanded ? '收起详情' : '查看详情'}</span>
          </button>

          {expanded && (
            <div className="mt-1.5 space-y-2 max-h-64 overflow-y-auto rounded border border-border/50 p-2 bg-muted/20">
              {placements.length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold text-foreground/80">开局布局</p>
                  {placements.map((c, i) => (
                    <div
                      key={i}
                      className="text-[10px] text-muted-foreground flex items-center gap-1.5 min-w-0"
                    >
                      <span className="truncate flex-1 min-w-0">
                        {c.isUnknown ? '未知盖卡' : c.cardName || `卡密 ${c.code}`}
                      </span>
                      <span className="shrink-0">
                        {(c.side === 0 ? '我方' : '对方') +
                          ' ' +
                          (AGENT_BOARD_ZONE_NAMES[c.location] || c.location) +
                          (c.sequence ? `[${c.sequence}]` : '')}
                      </span>
                      {c.position && (
                        <span className="shrink-0 text-muted-foreground/70">
                          {AGENT_BOARD_FACING_NAMES[c.position]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {proposals.length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold text-foreground/80">步骤台本</p>
                  {proposals.map((p, i) => (
                    <div
                      key={i}
                      className="text-[10px] text-muted-foreground flex items-center gap-1.5 min-w-0"
                    >
                      <span className="font-mono shrink-0">{i + 1}</span>
                      <span
                        className={cn(
                          'shrink-0',
                          p.actionPlayer === 0 ? 'text-blue-400' : 'text-rose-400'
                        )}
                      >
                        {p.actionPlayer === 0 ? '我方' : '对方'}
                      </span>
                      <span className="shrink-0 text-muted-foreground/70">
                        T{p.turn}·{PHASE_SHORT_NAMES[p.phase] || p.phase}
                      </span>
                      <span className="shrink-0">
                        {ACTION_TYPE_NAMES[p.actionType] || p.actionType}
                      </span>
                      {p.cardName && (
                        <span className="shrink-0 font-medium text-foreground/90">
                          {p.cardName}
                        </span>
                      )}
                      {p.dialogue && (
                        <span className="truncate italic min-w-0">「{p.dialogue}」</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
