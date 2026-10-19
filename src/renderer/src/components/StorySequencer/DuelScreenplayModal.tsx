import React, { useState, useEffect, useMemo } from 'react'
import { CardLocation } from '@shared/index'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { Button } from '../ui/button'
import { Film, X, Copy, Check, FileText, Download, Layers } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useDuelStore } from '../../stores/useDuelStore'
import { stepCardName } from '../../utils/cardNames'
import { generateFullScriptText } from '../../utils/screenplayText'
import { useScreenplayHotkeys } from '../../hooks/useScreenplayHotkeys'
import { useScreenplayExport } from '../../hooks/useScreenplayExport'
import { CardNotePicker } from './CardNotePicker'
import { ScreenplayDocumentView } from './ScreenplayDocumentView'
import { ScreenplayOutlineList } from './ScreenplayOutlineList'
import { ScreenplayStepEditor } from './ScreenplayStepEditor'

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
  const [chantPickerCode, setChantPickerCode] = useState<number>(-1)

  const activeStep = steps.find((s) => s.id === selectedStepId) || steps[0]
  const activeStepIndex = steps.findIndex((s) => s.id === (activeStep?.id || ''))

  const { savedToArchive, handleExportMarkdown, handleSaveToArchive } = useScreenplayExport(state)

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

  useScreenplayHotkeys({
    isScreenplayOpen,
    activeStepIndex,
    steps,
    chantPickerCode,
    setIsScreenplayOpen,
    setSelectedStepId
  })

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

  const handleCopyFullScript = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(generateFullScriptText(state, steps))
      setCopiedFullScript(true)
      setTimeout(() => setCopiedFullScript(false), 2000)
    } catch (err) {
      console.error('Failed to copy screenplay text:', err)
    }
  }

  if (!isScreenplayOpen) return null

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-50 w-[min(880px,72vw)] max-w-full flex flex-col bg-card text-card-foreground border-l border-border/80 shadow-2xl overflow-hidden select-none animate-in fade-in duration-100">
        <div className="px-5 py-2.5 border-b border-border/70 bg-card flex flex-wrap items-center justify-between gap-x-3 gap-y-2 shrink-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <h2 className="font-bold text-sm text-foreground tracking-wide">决斗台本</h2>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
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

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyFullScript}
                    className="h-7 text-xs font-semibold gap-1.5 border-border"
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
                }
              />
              <TooltipContent>一键复制完整台本文档，方便直接用于视频配音或小说写作</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={savedToArchive ? 'outline' : 'secondary'}
                    size="sm"
                    onClick={() => void handleSaveToArchive()}
                    className="h-7 text-xs font-semibold gap-1.5"
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
                }
              />
              <TooltipContent>
                把当前盘面与步骤存入对局档案，之后可从左侧「决斗档案」重新载入
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => void handleExportMarkdown()}
                    className="h-7 text-xs font-bold gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>导出 .md</span>
                  </Button>
                }
              />
              <TooltipContent>导出为标准同人决斗剧本 Markdown 文档 (.md)</TooltipContent>
            </Tooltip>

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
          <ScreenplayDocumentView state={state} steps={steps} />
        ) : (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <ScreenplayOutlineList
              steps={steps}
              activeStep={activeStep}
              onSelectStep={setSelectedStepId}
              onInsertAfterCurrent={handleInsertAfterCurrent}
            />
            <ScreenplayStepEditor
              activeStep={activeStep}
              activeStepIndex={activeStepIndex}
              steps={steps}
              onSelectStep={setSelectedStepId}
              onUpdateStep={updateStep}
              onDeleteStep={deleteStep}
              onInsertAfterCurrent={handleInsertAfterCurrent}
              onOpenChantPicker={setChantPickerCode}
            />
          </div>
        )}
      </div>

      {chantPickerCode >= 0 && activeStep && (
        <CardNotePicker
          cardCode={chantPickerCode > 0 ? chantPickerCode : null}
          cardName={stepCardName(activeStep)}
          currentDialogue={activeStep.dialogue}
          onPick={(text) => updateStep(activeStep.id, { dialogue: text })}
          onClose={() => setChantPickerCode(-1)}
        />
      )}
    </>
  )
}
