import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import { useState, type JSX } from 'react'
import { Check, ChevronDown, ChevronRight, Loader2, Sliders } from 'lucide-react'
import {
  AGENT_BOARD_FACING_NAMES,
  AGENT_BOARD_ZONE_NAMES,
  ACTION_TYPE_NAMES,
  AgentBoardSetupProposal,
  AgentStepProposal,
  EngineDuelStep,
  PHASE_SHORT_NAMES
} from '@shared/index'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export interface DuelProposalSummaryCardProps {
  setup?: AgentBoardSetupProposal
  proposals: AgentStepProposal[]
  engine?: { steps: EngineDuelStep[]; winner: 0 | 1 | null; totalTurns: number }
  applied: boolean
  applying: boolean
  error: string | null
  onApply: () => void
}

export function DuelProposalSummaryCard({
  setup,
  proposals,
  engine,
  applied,
  applying,
  error,
  onApply
}: DuelProposalSummaryCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const engineSteps = engine?.steps ?? []
  const steps = engineSteps.length > 0 ? engineSteps : proposals
  const isEngine = engineSteps.length > 0

  const turnCount = new Set(steps.map((s) => s.turn)).size
  const warnings = setup?.warnings ?? []
  const placements = setup?.cards ?? []

  return (
    <div className="mt-3 pt-2.5 border-t border-border/60 space-y-2">
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-foreground flex items-center gap-1 text-xs">
          <Sliders className="w-3.5 h-3.5" />
          <span>{isEngine ? '引擎对局提案' : '对局整理提案'}</span>
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
          共 {steps.length} 步 · {turnCount} 个回合
        </span>
        {isEngine && engine && (
          <span className="font-mono">
            胜者 {engine.winner === null ? '未定' : engine.winner === 0 ? '我方' : '对方'}
          </span>
        )}
        {placements.length > 0 && <span>开局布局 {placements.length} 张卡</span>}
        {warnings.length > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={<span className="text-amber-500">{warnings.length} 条落位警告</span>}
            />
            <TooltipContent>{warnings.join('\n')}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {error && (
        <div className="rounded bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive leading-relaxed">
          {error}
        </div>
      )}

      {(placements.length > 0 || steps.length > 0) && (
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
            <ScrollArea className="mt-1.5 max-h-64 rounded border border-border/50 bg-muted/20">
              <div className="space-y-2 p-2">
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

                {steps.length > 0 && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-semibold text-foreground/80">步骤台本</p>
                    {steps.map((p, i) => (
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
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
