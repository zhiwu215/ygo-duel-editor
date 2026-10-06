import React, { useState, useEffect, useMemo } from 'react'
import {
  PHASE_SHORT_NAMES,
  PHASE_NAMES,
  ACTION_TYPE_NAMES,
  ACTION_TYPE_COLORS,
  CardLocation
} from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { CardNotePicker } from './CardNotePicker'
import {
  BookOpen,
  Film,
  Sparkles,
  Plus,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Copy,
  Check,
  FileText,
  Download,
  Layers,
  BrainCircuit,
  Lightbulb
} from 'lucide-react'
import { cn } from '../../lib/utils'

const CHARACTER_PRESETS = [
  '我方',
  '对方',
  '旁白/解说',
  '暗游戏',
  '海马濑人',
  '城之内克也',
  '游城十代',
  '凯撒亮',
  '不动游星',
  '杰克·阿特拉斯'
]

export const DuelScreenplayModal: React.FC = () => {
  const {
    state,
    isScreenplayOpen,
    selectedStepId,
    setIsScreenplayOpen,
    setSelectedStepId,
    previewStepBoard,
    addStep,
    updateStep,
    deleteStep
  } = useDuelStore()

  const steps = useMemo(() => state.steps || [], [state.steps])

  const [viewMode, setViewMode] = useState<'editor' | 'document'>('editor')
  const [copiedFullScript, setCopiedFullScript] = useState<boolean>(false)
  const [savedToArchive, setSavedToArchive] = useState<boolean>(false)
  const [chantPickerCode, setChantPickerCode] = useState<number>(-1)

  const activeStep = steps.find((s) => s.id === selectedStepId) || steps[0]
  const activeStepIndex = steps.findIndex((s) => s.id === (activeStep?.id || ''))

  useEffect(() => {
    if (isScreenplayOpen && !selectedStepId && steps.length > 0) {
      setSelectedStepId(steps[0].id)
    }
  }, [isScreenplayOpen, selectedStepId, steps, setSelectedStepId])

  useEffect(() => {
    if (isScreenplayOpen && activeStepIndex >= 0) {
      previewStepBoard(activeStepIndex)
    }
  }, [isScreenplayOpen, activeStepIndex, previewStepBoard])

  useEffect(() => {
    if (!isScreenplayOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setIsScreenplayOpen(false)
      } else if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault()
        if (activeStepIndex > 0) {
          setSelectedStepId(steps[activeStepIndex - 1].id)
        }
      } else if ((e.ctrlKey && e.key === 'ArrowDown') || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault()
        if (activeStepIndex < steps.length - 1) {
          setSelectedStepId(steps[activeStepIndex + 1].id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isScreenplayOpen, activeStepIndex, steps, setSelectedStepId, setIsScreenplayOpen])

  if (!isScreenplayOpen) return null

  const handleInsertAfterCurrent = (): void => {
    const baseTurn = activeStep ? activeStep.turn : 1
    const basePhase = activeStep ? activeStep.phase : 'M1'
    const basePlayer = activeStep ? activeStep.actionPlayer : 0
    addStep({
      turn: baseTurn,
      turnPlayer: activeStep ? activeStep.turnPlayer : 0,
      phase: basePhase,
      actionPlayer: basePlayer,
      actionType: 'NORMAL_SUMMON',
      fromLocation: CardLocation.HAND,
      toLocation: CardLocation.MZONE
    })
    setTimeout(() => {
      const latest = useDuelStore.getState().state.steps
      if (latest && latest.length > 0) {
        setSelectedStepId(latest[latest.length - 1].id)
      }
    }, 50)
  }

  const generateFullScriptText = (): string => {
    const lines: string[] = []
    lines.push(`## 决斗台本：《${state.title || '未命名对局'}》`)
    if (state.hint) lines.push(`> 剧情提示: ${state.hint}`)
    lines.push('')

    let lastTurn = -1
    let lastPhase = ''

    steps.forEach((s, idx) => {
      if (s.turn !== lastTurn) {
        lines.push(`\n### 【第 ${s.turn} 回合 · ${s.turnPlayer === 0 ? '我方' : '对方'}回合】`)
        lastTurn = s.turn
        lastPhase = ''
      }
      if (s.phase !== lastPhase) {
        lines.push(`\n**>> ${PHASE_SHORT_NAMES[s.phase] || s.phase} <<**`)
        lastPhase = s.phase
      }

      const actName = ACTION_TYPE_NAMES[s.actionType] || s.actionType
      const cardDesc = s.cardName ? `【${s.cardName}】` : s.cardCode ? `【卡密:${s.cardCode}】` : ''
      const pName = s.actionPlayer === 0 ? '我方' : '对方'
      const chainStr = s.chainIndex ? ` (Chain ${s.chainIndex})` : ''

      lines.push(`${idx + 1}. [操作] ${pName}：${actName} ${cardDesc}${chainStr}`)

      if (s.speaker || s.dialogue) {
        const spk = s.speaker ? `【${s.speaker}】` : ''
        lines.push(`   ${spk}：“${s.dialogue || ''}”`)
      }
      if (s.innerThoughts) {
        lines.push(`   （心理戏）：${s.innerThoughts}`)
      }
      if (s.description) {
        lines.push(`   *战术解说*：${s.description}`)
      }
    })

    return lines.join('\n')
  }

  const handleCopyFullScript = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(generateFullScriptText())
      setCopiedFullScript(true)
      setTimeout(() => setCopiedFullScript(false), 2000)
    } catch (err) {
      console.error('Failed to copy screenplay text:', err)
    }
  }

  const handleExportMarkdown = async (): Promise<void> => {
    if (!window.api?.exportScreenplayFile) return
    const res = await window.api.exportScreenplayFile(state)
    if (res.success && res.filePath) {
      alert(`决斗剧本台本已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      alert(`导出失败: ${res.error}`)
    }
  }

  const handleSaveToArchive = async (): Promise<void> => {
    if (!window.api?.saveProjectToLibrary) return
    if ((state.steps || []).length === 0) {
      alert('还没有任何步骤，先编排或让 AI 转写后再存入档案。')
      return
    }
    const res = await window.api.saveProjectToLibrary(state)
    if (res.success && res.filePath) {
      setSavedToArchive(true)
      setTimeout(() => setSavedToArchive(false), 2500)
    } else {
      alert(`存入档案失败: ${res.error || '未知错误'}`)
    }
  }

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-0 duration-150 select-none"
    >
      <div className="w-[1100px] max-w-[96vw] h-[88vh] bg-card text-card-foreground border border-border/80 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-5 py-2.5 border-b border-border/70 bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-foreground tracking-wide">决斗台本</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg border border-border bg-background/80">
              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                  viewMode === 'editor'
                    ? 'bg-foreground/85 text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <Film className="w-3.5 h-3.5" />
                <span>分步创作模式</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('document')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
                  viewMode === 'document'
                    ? 'bg-foreground/85 text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>完整剧本文档预览</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFullScript}
              className="h-7 text-xs font-semibold gap-1.5 border-border"
              title="一键复制完整台本文档，方便直接用于视频配音或小说写作"
            >
              {copiedFullScript ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-bold">已复制全文</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>复制台本</span>
                </>
              )}
            </Button>

            <Button
              variant={savedToArchive ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => void handleSaveToArchive()}
              className="h-7 text-xs font-semibold gap-1.5"
              title="把当前盘面与步骤存入对局档案，之后可从左侧「决斗档案」重新载入"
            >
              {savedToArchive ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-bold">已存入档案</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>存入档案</span>
                </>
              )}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => void handleExportMarkdown()}
              className="h-7 text-xs font-bold gap-1.5 shadow-xs"
              title="导出为标准同人决斗剧本 Markdown 文档 (.md)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出 .md</span>
            </Button>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsScreenplayOpen(false)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground ml-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {viewMode === 'document' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-8 select-text bg-background/50 flex flex-col items-center">
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
                    const isFirstInTurn = idx === 0 || steps[idx - 1].turn !== s.turn
                    const isFirstInPhase =
                      isFirstInTurn ||
                      steps[idx - 1].phase !== s.phase ||
                      steps[idx - 1].turn !== s.turn

                    const pName = s.actionPlayer === 0 ? '我方' : '对方'
                    const actName = ACTION_TYPE_NAMES[s.actionType] || s.actionType
                    const color = ACTION_TYPE_COLORS[s.actionType]

                    return (
                      <div key={s.id} className="flex flex-col gap-1.5">
                        {isFirstInTurn && (
                          <div className="pt-2 font-bold text-sm text-blue-400 flex items-center gap-2 border-b border-blue-500/20 pb-1 mt-2">
                            <Sparkles className="w-4 h-4" />
                            <span>
                              第 {s.turn} 回合 · {s.turnPlayer === 0 ? '我方回合' : '对方回合'}
                            </span>
                          </div>
                        )}
                        {isFirstInPhase && (
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

                          {(s.speaker || s.dialogue) && (
                            <div className="mt-1 p-2 rounded-lg bg-muted/40 border border-border/60 text-xs">
                              {s.speaker && (
                                <span className="font-bold text-foreground mr-1.5">
                                  【{s.speaker}】:
                                </span>
                              )}
                              <span className="italic text-foreground/90 font-serif text-[13px]">
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
        ) : (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="w-[340px] h-full border-r border-border/70 bg-muted/15 flex flex-col shrink-0 overflow-hidden">
              <div className="p-2.5 border-b border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
                <span className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  <span>对局动作大纲 ({steps.length})</span>
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleInsertAfterCurrent}
                  className="h-6 text-[11px] gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>加动作</span>
                </Button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
                {steps.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs">
                    <p className="font-semibold text-foreground/80">尚无任何动作节点</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      点击右上角「加动作」建立对局大纲
                    </p>
                  </div>
                ) : (
                  steps.map((s, idx) => {
                    const isSelected = activeStep?.id === s.id
                    const isFirstInTurn = idx === 0 || steps[idx - 1].turn !== s.turn
                    const isFirstInPhase =
                      isFirstInTurn ||
                      steps[idx - 1].phase !== s.phase ||
                      steps[idx - 1].turn !== s.turn

                    const hasScript = Boolean(s.dialogue || s.speaker || s.innerThoughts)
                    const color = ACTION_TYPE_COLORS[s.actionType]
                    const actName = ACTION_TYPE_NAMES[s.actionType] || s.actionType

                    return (
                      <div key={s.id} className="flex flex-col gap-1">
                        {isFirstInTurn && (
                          <div className="flex items-center justify-between px-2 py-1 rounded bg-muted/50 border border-border/70 text-[11px] font-bold text-foreground mt-1">
                            <span>第 {s.turn} 回合</span>
                            <span className="text-[10px] font-normal text-muted-foreground">
                              {s.turnPlayer === 0 ? '我方回合' : '对方回合'}
                            </span>
                          </div>
                        )}
                        {isFirstInPhase && (
                          <div className="text-[10px] text-muted-foreground font-semibold px-1 pt-0.5">
                            {PHASE_SHORT_NAMES[s.phase] || s.phase}
                          </div>
                        )}

                        <div
                          onClick={() => setSelectedStepId(s.id)}
                          className={cn(
                            'p-2 rounded-lg border transition-all cursor-pointer flex items-center gap-2 select-none',
                            isSelected
                              ? 'border-primary/50 bg-primary/8 shadow-sm ring-1 ring-primary/25'
                              : 'border-border/60 bg-card/60 hover:bg-muted/40 hover:border-border'
                          )}
                        >
                          <span className="font-mono text-[10px] font-bold text-muted-foreground shrink-0 w-4">
                            {idx + 1}
                          </span>

                          {s.cardCode ? (
                            <img
                              src={getCardImageUrl(s.cardCode, true)}
                              alt={s.cardName || ''}
                              className="w-7 h-10 object-cover rounded border border-border/80 shrink-0"
                              onError={(e) => {
                                e.currentTarget.src = CARD_BACK_IMAGE
                              }}
                            />
                          ) : (
                            <div className="w-7 h-10 rounded border border-dashed border-border/80 flex items-center justify-center shrink-0 text-muted-foreground/60">
                              <Layers className="w-3.5 h-3.5" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={cn(
                                  'text-[9px] font-bold px-1 rounded truncate',
                                  s.actionPlayer === 0
                                    ? 'text-blue-400 bg-blue-500/10'
                                    : 'text-rose-400 bg-rose-500/10'
                                )}
                              >
                                {s.actionPlayer === 0 ? '我方' : '对方'}
                              </span>
                              <span
                                className={cn(
                                  'text-[9px] font-bold px-1 py-0.2 rounded border truncate',
                                  color.bg,
                                  color.text,
                                  color.border
                                )}
                              >
                                {actName}
                              </span>
                            </div>

                            <span
                              className="font-bold text-xs text-foreground truncate"
                              title={s.cardName || '未指定卡片'}
                            >
                              {s.cardName || '动作事件'}
                            </span>

                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                              {hasScript ? (
                                <span className="text-foreground flex items-center gap-1 truncate font-medium">
                                  <MessageSquare className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{s.dialogue || s.speaker}</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50 italic text-[9px]">
                                  待补充台词
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-5 select-text bg-background/40">
              {activeStep ? (
                <>
                  <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs flex items-center justify-between gap-4 select-none">
                    <div className="flex items-center gap-3 min-w-0">
                      {activeStep.cardCode ? (
                        <div className="w-12 h-[70px] rounded-md overflow-hidden border border-border/80 bg-black/60 shadow-sm shrink-0">
                          <img
                            src={getCardImageUrl(activeStep.cardCode, true)}
                            alt={activeStep.cardName || ''}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = CARD_BACK_IMAGE
                            }}
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
                            {activeStep.cardName || '未指定卡片动作'}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-bold px-2 py-0.5 rounded border',
                              ACTION_TYPE_COLORS[activeStep.actionType].bg,
                              ACTION_TYPE_COLORS[activeStep.actionType].text,
                              ACTION_TYPE_COLORS[activeStep.actionType].border
                            )}
                          >
                            {ACTION_TYPE_NAMES[activeStep.actionType]}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-blue-400">
                            第 {activeStep.turn} 回合
                          </span>
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
                        onClick={() => setSelectedStepId(steps[activeStepIndex - 1].id)}
                        className="h-8 px-2.5 text-xs font-semibold gap-1"
                        title="上一动作步骤 (快捷键 Ctrl + ↑)"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>上一步</span>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={activeStepIndex >= steps.length - 1}
                        onClick={() => setSelectedStepId(steps[activeStepIndex + 1].id)}
                        className="h-8 px-2.5 text-xs font-semibold gap-1"
                        title="下一动作步骤 (快捷键 Ctrl + ↓ 或 Ctrl + Enter)"
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
                      <span className="text-[11px] text-muted-foreground">
                        点击下方角色预设快速填入
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={activeStep.speaker || ''}
                        onChange={(e) => updateStep(activeStep.id, { speaker: e.target.value })}
                        className="h-8 text-xs font-medium max-w-sm"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {CHARACTER_PRESETS.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => updateStep(activeStep.id, { speaker: name })}
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
                          onClick={() => setChantPickerCode(activeStep.cardCode ?? 0)}
                          title="从召唤词库里挑一条填入台词"
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

                    <textarea
                      rows={5}
                      value={activeStep.dialogue || ''}
                      onChange={(e) => updateStep(activeStep.id, { dialogue: e.target.value })}
                      className="w-full rounded-xl border border-border/80 bg-background/80 p-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all font-serif leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-xs text-foreground">
                      <span>内心独白 / 心理戏 (可选)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={activeStep.innerThoughts || ''}
                      onChange={(e) => updateStep(activeStep.id, { innerThoughts: e.target.value })}
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
                      onChange={(e) => updateStep(activeStep.id, { description: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between select-none">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('确定要删除这一个动作步骤吗？')) {
                          deleteStep(activeStep.id)
                        }
                      }}
                      className="text-destructive/90 bg-destructive/5 hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除当前步骤</span>
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleInsertAfterCurrent}
                        className="text-xs font-semibold gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>在此之后插入新动作</span>
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground text-xs">
                  <div className="w-10 h-10 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center mb-2.5">
                    <BookOpen className="w-5 h-5 text-muted-foreground/60" />
                  </div>
                  <p className="font-semibold text-sm text-foreground/85">未选择动作步骤</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    在左侧选中动作后撰写对应台本
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleInsertAfterCurrent}
                    className="mt-4 gap-1.5 font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>添加第一步动作与台本</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {chantPickerCode >= 0 && activeStep && (
        <CardNotePicker
          cardCode={chantPickerCode > 0 ? chantPickerCode : null}
          cardName={activeStep.cardName}
          currentDialogue={activeStep.dialogue}
          onPick={(text) => updateStep(activeStep.id, { dialogue: text })}
          onClose={() => setChantPickerCode(-1)}
        />
      )}
    </div>
  )
}
