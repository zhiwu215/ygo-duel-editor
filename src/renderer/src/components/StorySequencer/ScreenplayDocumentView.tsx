import React from 'react'
import { ACTION_TYPE_COLORS, DuelPuzzleState, DuelStep, PHASE_NAMES } from '@shared/index'
import { ScrollArea } from '../ui/scroll-area'
import { Sparkles, BrainCircuit, Crosshair, Lightbulb, FileText } from 'lucide-react'
import { cn } from '../../lib/utils'
import { duelActionLabel, isFirstInPhase, isFirstInTurn } from './stepGrouping'

interface ScreenplayDocumentViewProps {
  state: DuelPuzzleState
  steps: DuelStep[]
}

export const ScreenplayDocumentView: React.FC<ScreenplayDocumentViewProps> = ({ state, steps }) => {
  return (
    <ScrollArea className="flex-1 min-h-0 bg-background/50">
      <div className="p-8 select-text flex flex-col items-center">
        <div className="w-full max-w-3xl flex flex-col gap-5 bg-card border border-border/80 rounded-xl p-8 shadow-sm">
          <div className="border-b border-border/70 pb-4 flex flex-col gap-1">
            <h1 className="text-xl font-extrabold text-foreground">
              《{state.title || '未命名决斗剧情'}》
            </h1>
            <p className="text-xs text-muted-foreground">
              大师规则 (MR{state.masterRule}) · 共 {steps.length} 个动作节点
            </p>
            {state.hint && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded border border-border mt-2">
                剧情开场提示：{state.hint}
              </p>
            )}
          </div>

          {steps.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              暂无编排动作步骤。切换到「分步创作模式」开始添加对局剧情吧！
            </div>
          ) : (
            <div className="flex flex-col gap-6 text-sm leading-relaxed">
              {steps.map((s, idx) => {
                const pName = s.actionPlayer === 0 ? '我方' : '对方'
                const actName = duelActionLabel(s)
                const color = ACTION_TYPE_COLORS[s.actionType]

                return (
                  <div key={s.id} className="flex flex-col gap-1.5">
                    {isFirstInTurn(steps, idx) && (
                      <div className="pt-2 font-bold text-sm text-blue-400 flex items-center gap-2 border-b border-blue-500/20 pb-1 mt-2">
                        <Sparkles className="w-4 h-4" />
                        <span>
                          第 {s.turn} 回合 · {s.turnPlayer === 0 ? '我方回合' : '对方回合'}
                        </span>
                      </div>
                    )}
                    {isFirstInPhase(steps, idx) && (
                      <div className="text-xs font-semibold text-muted-foreground/80 pl-2">
                        ▶ {PHASE_NAMES[s.phase]}
                      </div>
                    )}

                    <div className="pl-4 border-l-2 border-border/80 flex flex-col gap-1 py-0.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-muted-foreground">#{idx + 1}</span>
                        <span
                          className={cn(
                            'font-bold px-1 rounded text-[11px]',
                            s.actionPlayer === 0
                              ? 'text-blue-400 bg-blue-500/10'
                              : 'text-rose-400 bg-rose-500/10'
                          )}
                        >
                          {pName}
                        </span>
                        <span
                          className={cn(
                            'font-bold px-1.5 py-0.5 rounded border text-[10px]',
                            color.bg,
                            color.text,
                            color.border
                          )}
                        >
                          {actName}
                        </span>
                        {s.cardName && (
                          <span className="font-bold text-foreground">【{s.cardName}】</span>
                        )}
                        {s.chainIndex && s.chainIndex > 0 && (
                          <span className="text-[10px] text-teal-400 font-bold bg-teal-500/10 px-1 rounded">
                            Chain {s.chainIndex}
                          </span>
                        )}
                      </div>

                      {s.targetCardName && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Crosshair className="w-3.5 h-3.5 shrink-0 text-cyan-400/80" />
                          <span>
                            目标：
                            <span className="font-semibold text-foreground">
                              {s.targetCardName}
                            </span>
                          </span>
                        </div>
                      )}

                      {(s.speaker || s.dialogue) && (
                        <div className="mt-1 p-2 rounded-lg bg-muted/40 border border-border/60 text-xs">
                          {s.speaker && (
                            <span className="font-bold text-foreground mr-1.5">
                              【{s.speaker}】:
                            </span>
                          )}
                          <span
                            style={{ fontSize: 'var(--content-font-size)' }}
                            className="italic text-foreground/90 font-serif"
                          >
                            “{s.dialogue || ''}”
                          </span>
                        </div>
                      )}

                      {s.innerThoughts && (
                        <div className="text-xs text-sky-400/90 italic pl-1 flex items-center gap-1">
                          <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
                          <span>（心声：{s.innerThoughts}）</span>
                        </div>
                      )}

                      {s.description && (
                        <div className="text-[11px] text-muted-foreground/80 pl-1 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span>战术备忘：{s.description}</span>
                        </div>
                      )}

                      {s.sourceQuote && (
                        <div className="text-[10px] text-muted-foreground/70 italic pl-1 flex items-center gap-1">
                          <FileText className="w-3 h-3 shrink-0" />
                          <span>原文：「{s.sourceQuote}」</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
