import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DuelStep, DuelStepTextBlock, PHASE_NAMES, displayStepTextBlocks } from '@shared/index'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { alertDialog, confirmDialog } from '../../stores/useDialogStore'
import { resolveDuelistName, resolveTeamLabel } from '../../utils/duelistNames'
import { duelActionLabel } from '../StorySequencer/stepGrouping'
import { stepCardName } from '../../utils/cardNames'
import { saveDuelDocument } from '../../utils/duelDocumentActions'
import { useDuelDocumentSaveStatus } from '../../hooks/useDuelDocumentSaveStatus'
import { AutoResizeTextarea } from '../ui/AutoResizeTextarea'
import { CardEffectPicker } from './CardEffectPicker'
import { cn } from '../../lib/utils'

interface DuelScriptEditorPanelProps {
  onBack: () => void
}

function formatSaveTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function saveStatusText(status: string, savedAt: number | null): string {
  if (status === 'saving') return '保存中…'
  if (status === 'pending') return '待自动保存'
  if (status === 'saved') return savedAt ? `已自动保存 ${formatSaveTime(savedAt)}` : '已自动保存'
  if (status === 'error') return '自动保存失败'
  if (status === 'unsaved') return '未保存'
  return '自动保存'
}

function blockId(stepId: string): string {
  return `text-${stepId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export const DuelScriptEditorPanel: React.FC<DuelScriptEditorPanelProps> = ({ onBack }) => {
  const state = useDuelStore((s) => s.state)
  const selectedStepId = useDuelStore((s) => s.selectedStepId)
  const setSelectedStepId = useDuelStore((s) => s.setSelectedStepId)
  const setCurrentStepIndex = useDuelStore((s) => s.setCurrentStepIndex)
  const updateStep = useDuelStore((s) => s.updateStep)
  const setTitle = useDuelStore((s) => s.setTitle)
  const currentProjectPath = useDuelStore((s) => s.currentProjectPath)
  const engineActive = useDuelEngineStore((s) => s.isInitialized)
  const wrapper = useConfigStore((s) => s.config.cardNameWrapper)
  const saveState = useDuelDocumentSaveStatus()
  const saveText = currentProjectPath
    ? saveStatusText(saveState.status, saveState.savedAt)
    : '未保存'
  const scrollRef = useRef<HTMLDivElement>(null)
  const [picker, setPicker] = useState<{
    stepId: string
    blockId: string
    start: number
    end: number
  } | null>(null)

  const steps = state.steps || []
  const activeStep = steps.find((step) => step.id === selectedStepId) || steps[0] || null

  useEffect(() => {
    if (!selectedStepId || !scrollRef.current) return
    const element = scrollRef.current.querySelector(
      `[data-step-id="${CSS.escape(selectedStepId)}"]`
    )
    element?.scrollIntoView({ block: 'nearest' })
  }, [selectedStepId])

  const actorName = useCallback(
    (step: DuelStep): string =>
      resolveDuelistName(state.duelists, step.actionDuelistId) ||
      resolveTeamLabel(state, step.actionPlayer, step.turn),
    [state]
  )

  const selectStep = (step: DuelStep, index: number): void => {
    setSelectedStepId(step.id)
    setCurrentStepIndex(index)
    useDuelStore.getState().previewStepBoard(index)
  }

  const updateBlocks = (step: DuelStep, blocks: DuelStepTextBlock[]): void => {
    updateStep(step.id, { texts: blocks })
  }

  const textStep = (step: DuelStep): DuelStep =>
    step.cardName ? step : { ...step, cardName: stepCardName(step) }

  const updateBlock = (step: DuelStep, block: DuelStepTextBlock, text: string): void => {
    const blocks = displayStepTextBlocks(textStep(step), actorName(step), wrapper).map((item) =>
      item.id === block.id ? { ...item, text, auto: false } : item
    )
    updateBlocks(step, blocks)
  }

  const addBlock = (step: DuelStep): void => {
    const blocks = displayStepTextBlocks(textStep(step), actorName(step), wrapper)
    updateBlocks(step, [...blocks, { id: blockId(step.id), text: '' }])
  }

  const deleteBlock = (step: DuelStep, blockIdValue: string): void => {
    const blocks = displayStepTextBlocks(textStep(step), actorName(step), wrapper).filter(
      (item) => item.id !== blockIdValue
    )
    updateBlocks(step, blocks)
  }

  const insertPickerText = (text: string): void => {
    if (!picker) return
    const step = steps.find((item) => item.id === picker.stepId)
    if (!step) return
    const block = displayStepTextBlocks(textStep(step), actorName(step), wrapper).find(
      (item) => item.id === picker.blockId
    )
    if (!block) return
    const nextText = `${block.text.slice(0, picker.start)}${text}${block.text.slice(picker.end)}`
    updateBlock(step, block, nextText)
  }

  const handleSave = async (): Promise<boolean> => {
    const result = await saveDuelDocument(false)
    if (!result.success) {
      if (result.error) await alertDialog(`保存失败\n\n${result.error}`)
      return false
    }
    const index = steps.findIndex((step) => step.id === activeStep?.id)
    if (index >= 0) useDuelStore.getState().previewStepBoard(index)
    return true
  }

  const autoSaveTitle = async (): Promise<void> => {
    if (!currentProjectPath) return
    const stored = await window.api.readDuelDocument(currentProjectPath)
    if (!stored.success || !stored.document) return
    const currentState = useDuelStore.getState().state
    if ((currentState.title || '') === (stored.document.state.title || '')) return
    const onlyTitleChanged =
      JSON.stringify({ ...currentState, title: stored.document.state.title }) ===
      JSON.stringify(stored.document.state)
    if (onlyTitleChanged) await handleSave()
  }

  const handleBack = async (): Promise<void> => {
    if (!currentProjectPath) {
      onBack()
      return
    }
    const current = useDuelStore.getState()
    if (current.previewReturn) current.exitPreview()
    const stored = await window.api.readDuelDocument(currentProjectPath)
    if (!stored.success || !stored.document) {
      onBack()
      return
    }
    const same =
      JSON.stringify(stored.document.state) === JSON.stringify(useDuelStore.getState().state)
    if (same) {
      onBack()
      return
    }
    const currentState = useDuelStore.getState().state
    const onlyTitleChanged =
      JSON.stringify({ ...currentState, title: stored.document.state.title }) ===
      JSON.stringify(stored.document.state)
    if (onlyTitleChanged) {
      if (await handleSave()) onBack()
      return
    }
    const choice = await confirmDialog({
      title: '台本有未保存的修改',
      description: '返回台本库后，当前修改会丢失。',
      confirmText: '放弃修改',
      destructive: true,
      extraAction: { text: '保存并返回', value: 'save' }
    })
    if (choice === 'save') {
      if (await handleSave()) onBack()
      return
    }
    if (choice === true) onBack()
  }

  const rendered = (() => {
    const nodes: React.JSX.Element[] = []
    let lastTurn: number | null = null
    let lastPhase: string | null = null
    steps.forEach((step, index) => {
      if (step.turn !== lastTurn) {
        lastTurn = step.turn
        lastPhase = step.phase
        nodes.push(
          <div key={`turn-${step.turn}-${index}`} className="mb-1 mt-3 first:mt-0">
            <div className="text-[11px] font-bold text-foreground">第 {step.turn} 回合</div>
            <div className="text-[10px] text-muted-foreground">{PHASE_NAMES[step.phase]}</div>
          </div>
        )
      } else if (step.phase !== lastPhase) {
        lastPhase = step.phase
        nodes.push(
          <div key={`phase-${step.id}`} className="mb-1 mt-2 text-[10px] text-muted-foreground">
            {PHASE_NAMES[step.phase]}
          </div>
        )
      }
      const active = step.id === activeStep?.id
      const cardName = stepCardName(step)
      const actionText = cardName ? `${duelActionLabel(step)} ${cardName}` : duelActionLabel(step)
      const blocks = displayStepTextBlocks(textStep(step), actorName(step), wrapper)
      nodes.push(
        <div
          key={step.id}
          data-step-id={step.id}
          onClick={() => selectStep(step, index)}
          className={cn(
            'cursor-pointer rounded-md border px-2 py-1.5 transition-colors',
            active
              ? 'border-foreground/30 bg-foreground/5'
              : 'border-transparent hover:border-border/60 hover:bg-muted/30'
          )}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              selectStep(step, index)
              useDuelStore.getState().openStepEditor(step.id)
            }}
            className="flex w-full items-center gap-1 text-left text-[11px] font-semibold text-foreground/90 hover:text-foreground"
          >
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1 truncate">{actionText}</span>
          </button>

          <div className="mt-1 flex flex-col gap-1">
            {blocks.map((block) =>
              active ? (
                <div key={block.id} className="group relative">
                  <AutoResizeTextarea
                    value={block.text}
                    onChange={(event) => updateBlock(step, block, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== '@') return
                      event.preventDefault()
                      setPicker({
                        stepId: step.id,
                        blockId: block.id,
                        start: event.currentTarget.selectionStart,
                        end: event.currentTarget.selectionEnd
                      })
                    }}
                    className="min-h-[30px] w-full rounded border border-border/60 bg-background/80 px-1.5 py-1 pr-6 text-[11px] leading-relaxed text-foreground outline-none focus:border-foreground/30"
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      deleteBlock(step, block.id)
                    }}
                    className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    title="删除文本"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                block.text && (
                  <p
                    key={block.id}
                    className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground"
                  >
                    {block.text}
                  </p>
                )
              )
            )}
            {active && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  addBlock(step)
                }}
                className="mt-0.5 flex items-center gap-1 self-start rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                添加文本
              </button>
            )}
          </div>
        </div>
      )
    })
    return nodes
  })()

  return (
    <div className="flex h-full min-h-0 flex-col bg-card/40">
      <div className="flex shrink-0 flex-col border-b border-border/70">
        <div className="flex h-8 items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => void handleBack()}
            className="flex items-center gap-1 rounded px-1 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            台本库
          </button>
          <div className="flex-1" />
          {saveText && (
            <span
              className={cn(
                'shrink-0 text-[9px] tabular-nums',
                saveState.status === 'error' || !currentProjectPath
                  ? 'text-rose-500'
                  : 'text-muted-foreground'
              )}
              title={
                currentProjectPath
                  ? '当前台本会在修改后自动保存到文档'
                  : '当前内容还没有保存到台本库，请点击右侧保存按钮'
              }
            >
              {saveText}
            </span>
          )}
          <span
            title={
              engineActive
                ? '当前处于引擎模式：动作由引擎自动记录'
                : '当前为编排模式：动作由编辑器手动记录'
            }
            className={cn(
              'shrink-0 rounded border px-1 text-[9px] leading-4',
              engineActive
                ? 'border-emerald-500/30 text-emerald-500'
                : 'border-amber-500/30 text-amber-500'
            )}
          >
            {engineActive ? '引擎' : '手动'}
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Save className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-2 pb-2">
          <input
            value={state.title || ''}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void autoSaveTitle()}
            className="w-full rounded border border-border/60 bg-background/60 px-2 py-1 text-xs font-semibold text-foreground outline-none focus:border-foreground/30"
            placeholder="未命名台本"
          />
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2">
        {steps.length === 0 ? (
          <div className="p-6 text-center text-[11px] text-muted-foreground">
            还没有步骤，先在决斗盘上操作，或到右栏步骤编排添加。
          </div>
        ) : (
          rendered
        )}
      </div>

      {picker && (
        <CardEffectPicker
          onClose={() => setPicker(null)}
          onInsert={(text) => insertPickerText(text)}
        />
      )}
    </div>
  )
}
