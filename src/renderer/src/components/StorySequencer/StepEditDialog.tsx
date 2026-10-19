import React, { useState } from 'react'
import {
  ACTION_TYPE_NAMES,
  CardLocation,
  DuelActionType,
  DuelPhase,
  PHASE_NAMES
} from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Film, X } from 'lucide-react'
import { ALL_ACTIONS, ALL_PHASES, COMMONLY_USED_LOCATIONS } from './stepGrouping'

interface StepSelectOption {
  value: string
  label: string
}

function StepSelect({
  value,
  onValueChange,
  options
}: {
  value: string
  onValueChange: (value: string | null) => void
  options: StepSelectOption[]
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-7 w-full bg-background font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface StepEditDialogProps {
  editingStepId: string | null
  onClose: () => void
}

export const StepEditDialog: React.FC<StepEditDialogProps> = ({ editingStepId, onClose }) => {
  const { state, hoveredCard, addStep, updateStep } = useDuelStore()
  const steps = state.steps || []
  const editingStep = editingStepId ? (steps.find((s) => s.id === editingStepId) ?? null) : null
  const latestStep = steps[steps.length - 1]

  const [formTurn, setFormTurn] = useState<number>(
    editingStep ? editingStep.turn : latestStep?.turn || 1
  )
  const [formTurnPlayer, setFormTurnPlayer] = useState<0 | 1>(
    editingStep ? editingStep.turnPlayer : (latestStep?.turnPlayer ?? 0)
  )
  const [formPhase, setFormPhase] = useState<DuelPhase>(
    editingStep ? editingStep.phase : latestStep?.phase || 'M1'
  )
  const [formActionPlayer, setFormActionPlayer] = useState<0 | 1>(
    editingStep ? editingStep.actionPlayer : (latestStep?.actionPlayer ?? 0)
  )
  const [formActionType, setFormActionType] = useState<DuelActionType>(
    editingStep ? editingStep.actionType : 'NORMAL_SUMMON'
  )
  const [formCardCode, setFormCardCode] = useState<string>(
    editingStep
      ? editingStep.cardCode
        ? String(editingStep.cardCode)
        : ''
      : hoveredCard
        ? String(hoveredCard.id)
        : ''
  )
  const [formCardName, setFormCardName] = useState<string>(
    editingStep ? editingStep.cardName || '' : hoveredCard?.name || ''
  )
  const [formFromLoc, setFormFromLoc] = useState<number>(
    editingStep ? (editingStep.fromLocation ?? CardLocation.HAND) : CardLocation.HAND
  )
  const formFromSeq = editingStep ? (editingStep.fromSequence ?? 0) : 0
  const [formToLoc, setFormToLoc] = useState<number>(
    editingStep ? (editingStep.toLocation ?? CardLocation.MZONE) : CardLocation.MZONE
  )
  const formToSeq = editingStep ? (editingStep.toSequence ?? 0) : 2
  const [formChain, setFormChain] = useState<number>(
    editingStep ? (editingStep.chainIndex ?? 0) : 0
  )
  const formDesc = editingStep ? editingStep.description || '' : ''

  const handleSaveStep = (e: React.FormEvent): void => {
    e.preventDefault()
    const codeNum = parseInt(formCardCode, 10)
    const validCode = !isNaN(codeNum) && codeNum > 0 ? codeNum : undefined
    const existingStep = editingStepId ? steps.find((s) => s.id === editingStepId) : null

    const stepPayload = {
      turn: formTurn,
      turnPlayer: formTurnPlayer,
      phase: formPhase,
      actionPlayer: formActionPlayer,
      actionType: formActionType,
      cardCode: validCode,
      cardName: formCardName.trim() || undefined,
      fromLocation: formFromLoc,
      fromSequence: formFromSeq,
      toLocation: formToLoc,
      toSequence: formToSeq,
      chainIndex: formChain > 0 ? formChain : undefined,
      speaker: existingStep?.speaker,
      dialogue: existingStep?.dialogue,
      innerThoughts: existingStep?.innerThoughts,
      description: formDesc.trim() || existingStep?.description
    }

    if (editingStepId) {
      updateStep(editingStepId, stepPayload)
    } else {
      addStep(stepPayload)
    }
    onClose()
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="!flex !flex-col !gap-3 !bg-card !text-card-foreground !max-w-[360px] border border-border shadow-2xl rounded-xl p-4 w-full max-h-[90vh] overflow-y-auto select-none"
      >
        <DialogHeader className="!flex !flex-row items-center justify-between border-b border-border/60 pb-2 space-y-0">
          <DialogTitle className="font-bold text-sm flex items-center gap-1.5">
            <Film className="w-4 h-4 text-muted-foreground" />
            <span>{editingStepId ? '编辑对局步骤' : '添加对局新步骤'}</span>
          </DialogTitle>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <form onSubmit={handleSaveStep} className="flex flex-col gap-2.5 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">回合数</label>
              <Input
                type="number"
                min={1}
                value={formTurn}
                onChange={(e) => setFormTurn(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="h-7 text-xs font-mono font-bold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">决斗阶段</label>
              <StepSelect
                value={formPhase}
                onValueChange={(v) => setFormPhase(v as DuelPhase)}
                options={ALL_PHASES.map((p) => ({ value: p, label: PHASE_NAMES[p] }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">回合方</label>
              <StepSelect
                value={String(formTurnPlayer)}
                onValueChange={(v) => setFormTurnPlayer(Number(v) as 0 | 1)}
                options={[
                  { value: '0', label: '我方回合 (Player 0)' },
                  { value: '1', label: '对方回合 (Player 1)' }
                ]}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">动作发起人</label>
              <StepSelect
                value={String(formActionPlayer)}
                onValueChange={(v) => setFormActionPlayer(Number(v) as 0 | 1)}
                options={[
                  { value: '0', label: '我方发起 (Player 0)' },
                  { value: '1', label: '对方发起 (Player 1)' }
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">动作类型</label>
              <StepSelect
                value={formActionType}
                onValueChange={(v) => setFormActionType(v as DuelActionType)}
                options={ALL_ACTIONS.map((act) => ({
                  value: act,
                  label: ACTION_TYPE_NAMES[act]
                }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                连锁序号 (Chain)
              </label>
              <Input
                type="number"
                min={0}
                value={formChain}
                onChange={(e) => setFormChain(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="0 为无连锁"
                className="h-7 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">卡密 (密码)</label>
              <Input
                type="text"
                value={formCardCode}
                onChange={(e) => setFormCardCode(e.target.value)}
                placeholder="8位卡片密码"
                className="h-7 text-xs font-mono font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">卡片名称</label>
              <Input
                type="text"
                value={formCardName}
                onChange={(e) => setFormCardName(e.target.value)}
                placeholder="卡片名称"
                className="h-7 text-xs font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">来源区域</label>
              <StepSelect
                value={String(formFromLoc)}
                onValueChange={(v) => setFormFromLoc(Number(v))}
                options={COMMONLY_USED_LOCATIONS.map((loc) => ({
                  value: String(loc.loc),
                  label: loc.name
                }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">移动至区域</label>
              <StepSelect
                value={String(formToLoc)}
                onValueChange={(v) => setFormToLoc(Number(v))}
                options={COMMONLY_USED_LOCATIONS.map((loc) => ({
                  value: String(loc.loc),
                  label: loc.name
                }))}
              />
            </div>
          </div>

          <DialogFooter className="!flex !flex-row !border-t !bg-transparent !p-0 items-center justify-end gap-2 pt-2 border-border/60">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-7 text-xs"
            >
              取消
            </Button>
            <Button type="submit" size="sm" className="h-7 px-4 text-xs font-bold">
              {editingStepId ? '保存修改' : '确认添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
