import React from 'react'
import { ACTION_TYPE_COLORS, DuelStep, PHASE_NAMES } from '@shared/index'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { CardImage } from '../ui/CardImage'
import { ChevronLeft, ChevronRight, Sparkles, Trash2, BookOpen, Layers } from 'lucide-react'
import { cn } from '../../lib/utils'
import { stepCardName } from '../../utils/cardNames'
import { confirmDialog } from '../../stores/useDialogStore'
import { duelActionLabel } from './stepGrouping'
import { CHARACTER_PRESETS } from './characterPresets'

interface ScreenplayStepEditorProps {
  activeStep: DuelStep | undefined
  activeStepIndex: number
  steps: DuelStep[]
  onSelectStep: (id: string) => void
  onUpdateStep: (stepId: string, patch: Partial<DuelStep>) => void
  onDeleteStep: (stepId: string) => void
  onOpenChantPicker: (cardCode: number) => void
  stepEditingLocked: boolean
}

export const ScreenplayStepEditor: React.FC<ScreenplayStepEditorProps> = ({
  activeStep,
  activeStepIndex,
  steps,
  onSelectStep,
  onUpdateStep,
  onDeleteStep,
  onOpenChantPicker,
  stepEditingLocked
}) => {
  return (
    <ScrollArea className="flex-1 min-h-0 bg-background/40">
      <div className="p-6 flex flex-col gap-5 select-text">
        {activeStep ? (
          <>
            <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs flex items-center justify-between gap-4 select-none">
              <div className="flex items-center gap-3 min-w-0">
                {activeStep.cardCode ? (
                  <div className="w-12 h-[70px] rounded-md overflow-hidden border border-border/80 bg-black/60 shadow-sm shrink-0">
                    <CardImage
                      code={activeStep.cardCode}
                      small
                      alt={stepCardName(activeStep)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-[70px] rounded-md border border-dashed border-border flex items-center justify-center shrink-0 text-muted-foreground/60">
                    <Layers className="w-5 h-5" />
                  </div>
                )}

                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground truncate">
                      {stepCardName(activeStep) || '未指定卡片动作'}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded border',
                        ACTION_TYPE_COLORS[activeStep.actionType].bg,
                        ACTION_TYPE_COLORS[activeStep.actionType].text,
                        ACTION_TYPE_COLORS[activeStep.actionType].border
                      )}
                    >
                      {duelActionLabel(activeStep)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-blue-400">第 {activeStep.turn} 回合</span>
                    <span>·</span>
                    <span className="font-medium text-foreground/80">
                      {PHASE_NAMES[activeStep.phase]}
                    </span>
                    <span>·</span>
                    <span>{activeStep.actionPlayer === 0 ? '我方发起' : '对方发起'}</span>
                    {activeStep.chainIndex && activeStep.chainIndex > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-teal-400 font-bold">
                          Chain {activeStep.chainIndex}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={activeStepIndex <= 0}
                  onClick={() => onSelectStep(steps[activeStepIndex - 1].id)}
                  className="h-8 px-2.5 text-xs font-semibold gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>上一步</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  disabled={activeStepIndex >= steps.length - 1}
                  onClick={() => onSelectStep(steps[activeStepIndex + 1].id)}
                  className="h-8 px-2.5 text-xs font-semibold gap-1"
                >
                  <span>下一步</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <span>说话角色 (Speaker)</span>
                </label>
                <span className="text-[11px] text-muted-foreground">点击下方角色预设快速填入</span>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={activeStep.speaker || ''}
                  onChange={(e) => onUpdateStep(activeStep.id, { speaker: e.target.value })}
                  className="h-8 text-xs font-medium max-w-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {CHARACTER_PRESETS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onUpdateStep(activeStep.id, { speaker: name })}
                    className={cn(
                      'text-[11px] px-2 py-0.5 rounded-full border transition-all font-medium',
                      activeStep.speaker === name
                        ? 'bg-foreground/85 text-background border-foreground/85 font-semibold'
                        : 'bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <span>角色台词 / 召唤口播 / 决斗战吼</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenChantPicker(activeStep.cardCode ?? 0)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>插入召唤词</span>
                  </button>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {(activeStep.dialogue || '').length} 字
                  </span>
                </div>
              </div>

              <Textarea
                rows={5}
                value={activeStep.dialogue || ''}
                onChange={(e) => onUpdateStep(activeStep.id, { dialogue: e.target.value })}
                style={{ fontSize: 'var(--content-font-size)' }}
                className="w-full rounded-xl border border-border/80 bg-background/80 p-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all font-serif leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs text-foreground">
                <span>内心独白 / 心理戏 (可选)</span>
              </label>
              <Textarea
                rows={2}
                value={activeStep.innerThoughts || ''}
                onChange={(e) => onUpdateStep(activeStep.id, { innerThoughts: e.target.value })}
                className="w-full rounded-lg border border-border/70 bg-background/60 p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 transition-all italic leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs text-foreground">
                <span>战术解说 / 备忘说明 (可选)</span>
              </label>
              <Input
                type="text"
                value={activeStep.description || ''}
                onChange={(e) => onUpdateStep(activeStep.id, { description: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            {stepEditingLocked && (
              <div className="text-[11px] leading-relaxed text-muted-foreground select-none">
                引擎运行中，动作由引擎接管；退出规则校验后可删除步骤。
              </div>
            )}

            <div className="pt-3 border-t border-border/60 flex items-center justify-between select-none">
              <Button
                variant="ghost"
                size="sm"
                disabled={stepEditingLocked}
                onClick={() => {
                  void confirmDialog({
                    title: '删除步骤',
                    description: '确定要删除这一个动作步骤吗？',
                    confirmText: '删除'
                  }).then((ok) => {
                    if (ok) onDeleteStep(activeStep.id)
                  })
                }}
                className="text-destructive/90 bg-destructive/5 hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除当前步骤</span>
              </Button>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground text-xs">
            <div className="w-10 h-10 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center mb-2.5">
              <BookOpen className="w-5 h-5 text-muted-foreground/60" />
            </div>
            <p className="font-semibold text-sm text-foreground/85">未选择动作步骤</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              在主窗口执行一次动作后，步骤会自动记录，再回到这里撰写台本
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
