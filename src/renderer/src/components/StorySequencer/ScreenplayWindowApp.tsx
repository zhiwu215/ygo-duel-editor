import { useEffect, useMemo, useState } from 'react'
import { CardLocation, DuelPuzzleState, DuelStep } from '@shared/index'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { Button } from '../ui/button'
import { WindowControls } from '../ui/window-controls'
import { Film, Copy, Check, FileText, Download, Layers } from 'lucide-react'
import { cn } from '../../lib/utils'
import { stepCardName } from '../../utils/cardNames'
import { generateFullScriptText } from '../../utils/screenplayText'
import { useScreenplayExport } from '../../hooks/useScreenplayExport'
import { CardNotePicker } from './CardNotePicker'
import { ScreenplayDocumentView } from './ScreenplayDocumentView'
import { ScreenplayOutlineList } from './ScreenplayOutlineList'
import { ScreenplayStepEditor } from './ScreenplayStepEditor'

const genStepId = (): string => `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

export const ScreenplayWindowApp: React.FC = () => {
  const [puzzle, setPuzzle] = useState<DuelPuzzleState | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  useEffect(() => {
    const offSnapshot = window.api.onScreenplaySnapshot((snapshot) => {
      setPuzzle(snapshot.state)
      setSelectedStepId(snapshot.selectedStepId)
    })
    void window.api.requestScreenplayState()
    return offSnapshot
  }, [])

  const handleSelectStep = (id: string | null): void => {
    setSelectedStepId(id)
  }

  if (!puzzle) {
    return <div className="h-screen w-screen bg-background" />
  }

  return (
    <ScreenplayWindowBody
      puzzle={puzzle}
      setPuzzle={setPuzzle}
      selectedStepId={selectedStepId}
      onSelectStep={handleSelectStep}
    />
  )
}

interface ScreenplayWindowBodyProps {
  puzzle: DuelPuzzleState
  setPuzzle: React.Dispatch<React.SetStateAction<DuelPuzzleState | null>>
  selectedStepId: string | null
  onSelectStep: (id: string | null) => void
}

const ScreenplayWindowBody = ({
  puzzle,
  setPuzzle,
  selectedStepId,
  onSelectStep
}: ScreenplayWindowBodyProps): React.JSX.Element => {
  const state = puzzle
  const steps = useMemo(() => state.steps || [], [state.steps])

  const [viewMode, setViewMode] = useState<'editor' | 'document'>('editor')
  const [copiedFullScript, setCopiedFullScript] = useState<boolean>(false)
  const [chantPickerCode, setChantPickerCode] = useState<number>(-1)

  const activeStep = steps.find((s) => s.id === selectedStepId) || steps[0]
  const activeStepIndex = steps.findIndex((s) => s.id === (activeStep?.id || ''))

  const { savedToArchive, handleExportMarkdown, handleSaveToArchive } = useScreenplayExport(state)

  useEffect(() => {
    if (activeStep?.id) void window.api.sendScreenplayPreview(activeStep.id)
  }, [activeStep?.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && chantPickerCode < 0) {
        e.preventDefault()
        window.close()
      } else if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault()
        if (activeStepIndex > 0) onSelectStep(steps[activeStepIndex - 1].id)
      } else if ((e.ctrlKey && e.key === 'ArrowDown') || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault()
        if (activeStepIndex < steps.length - 1) onSelectStep(steps[activeStepIndex + 1].id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeStepIndex, steps, chantPickerCode, onSelectStep])

  const updateStep = (stepId: string, patch: Partial<DuelStep>): void => {
    setPuzzle((prev) =>
      prev
        ? {
            ...prev,
            steps: (prev.steps || []).map((s) => (s.id === stepId ? { ...s, ...patch } : s))
          }
        : prev
    )
    void window.api.sendScreenplayEdit({ kind: 'updateStep', stepId, patch })
  }

  const deleteStep = (stepId: string): void => {
    setPuzzle((prev) =>
      prev ? { ...prev, steps: (prev.steps || []).filter((s) => s.id !== stepId) } : prev
    )
    void window.api.sendScreenplayEdit({ kind: 'deleteStep', stepId })
  }

  const addStep = (stepData: Omit<DuelStep, 'id'>): void => {
    const step: DuelStep = { ...stepData, id: genStepId() }
    setPuzzle((prev) => (prev ? { ...prev, steps: [...(prev.steps || []), step] } : prev))
    onSelectStep(step.id)
    void window.api.sendScreenplayEdit({ kind: 'addStep', step })
  }

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

  return (
    <div className="h-screen w-screen flex flex-col bg-card text-card-foreground overflow-hidden select-none">
      <header className="h-11 px-4 border-b border-border bg-card/80 backdrop-blur-md flex items-center gap-3 shrink-0 [-webkit-app-region:drag]">
        <h2 className="font-bold text-sm tracking-wide">决斗台本</h2>
        <div className="flex-1" />
        <div className="[-webkit-app-region:no-drag] flex items-center gap-2 -mr-4">
          <WindowControls className="h-11 w-10" actions={['close']} />
        </div>
      </header>

      <div className="px-5 py-2.5 border-b border-border/70 bg-card flex flex-wrap items-center justify-between gap-x-3 gap-y-2 shrink-0">
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
                onClick={() => void handleCopyFullScript()}
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
      </div>

      {viewMode === 'document' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScreenplayDocumentView state={state} steps={steps} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <ScreenplayOutlineList
            steps={steps}
            activeStep={activeStep}
            onSelectStep={onSelectStep}
            onInsertAfterCurrent={handleInsertAfterCurrent}
          />
          <ScreenplayStepEditor
            activeStep={activeStep}
            activeStepIndex={activeStepIndex}
            steps={steps}
            onSelectStep={onSelectStep}
            onUpdateStep={updateStep}
            onDeleteStep={deleteStep}
            onInsertAfterCurrent={handleInsertAfterCurrent}
            onOpenChantPicker={setChantPickerCode}
          />
        </div>
      )}

      {chantPickerCode >= 0 && activeStep && (
        <CardNotePicker
          cardCode={chantPickerCode > 0 ? chantPickerCode : null}
          cardName={stepCardName(activeStep)}
          currentDialogue={activeStep.dialogue}
          onPick={(text) => updateStep(activeStep.id, { dialogue: text })}
          onClose={() => setChantPickerCode(-1)}
        />
      )}
    </div>
  )
}
