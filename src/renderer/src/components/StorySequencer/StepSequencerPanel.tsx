import React, { useState } from 'react'
import {
  DuelStep,
  DuelPhase,
  DuelActionType,
  PHASE_NAMES,
  PHASE_SHORT_NAMES,
  ACTION_TYPE_NAMES,
  ACTION_TYPE_COLORS,
  CardLocation
} from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  MessageSquare,
  BookOpen,
  Film,
  ArrowRight,
  Layers,
  X,
  RotateCcw
} from 'lucide-react'
import { cn } from '../../lib/utils'

/** 阶段列表定义 */
const ALL_PHASES: DuelPhase[] = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP']

/** 常见动作类型快捷列表 */
const ALL_ACTIONS: DuelActionType[] = [
  'NORMAL_SUMMON',
  'SPECIAL_SUMMON',
  'ACTIVATE',
  'SET_SPELL_TRAP',
  'SET_MONSTER',
  'DRAW',
  'ATTACK',
  'TO_GRAVE',
  'BANISH',
  'TO_HAND',
  'CHANGE_POS',
  'DAMAGE',
  'CHAIN',
  'DIALOGUE'
]

/** 常用区域映射 */
const COMMONLY_USED_LOCATIONS: { loc: number; name: string }[] = [
  { loc: CardLocation.HAND, name: '手牌' },
  { loc: CardLocation.MZONE, name: '怪兽区' },
  { loc: CardLocation.SZONE, name: '魔陷区' },
  { loc: CardLocation.GRAVE, name: '墓地' },
  { loc: CardLocation.DECK, name: '主卡组' },
  { loc: CardLocation.EXTRA, name: '额外卡组' },
  { loc: CardLocation.REMOVED, name: '除外区' },
  { loc: CardLocation.FZONE, name: '场地魔法区' },
  { loc: CardLocation.PZONE, name: '灵摆区' }
]

function getLocationDisplayName(loc?: number, seq?: number): string {
  if (loc === undefined) return ''
  if (loc === CardLocation.MZONE && (seq === 5 || seq === 6)) {
    return `EX怪兽区${seq === 5 ? '1' : '2'}`
  }
  const match = COMMONLY_USED_LOCATIONS.find((l) => l.loc === loc)
  if (match) return match.name
  return '未知区域'
}

export const StepSequencerPanel: React.FC = () => {
  const {
    state,
    currentStepIndex,
    currentTurn,
    currentPhase,
    currentChain,
    activeTurnPlayer,
    isAutoRecording,
    setCurrentPhase,
    resetChain,
    nextPhase,
    nextTurn,
    setActiveTurnPlayer,
    setIsAutoRecording,
    previewStepBoard,
    setHoveredInstanceId,
    addStep,
    updateStep,
    deleteStep,
    moveStep,
    clearSteps,
    hoveredCard,
    openScreenplayWithStep
  } = useDuelStore()

  const steps = state.steps || []

  // 对话框与表单状态
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)

  // 步骤草稿表单状态
  const latestStep = steps[steps.length - 1]
  const [formTurn, setFormTurn] = useState<number>(latestStep?.turn || 1)
  const [formTurnPlayer, setFormTurnPlayer] = useState<0 | 1>(latestStep?.turnPlayer ?? 0)
  const [formPhase, setFormPhase] = useState<DuelPhase>(latestStep?.phase || 'M1')
  const [formActionPlayer, setFormActionPlayer] = useState<0 | 1>(latestStep?.actionPlayer ?? 0)
  const [formActionType, setFormActionType] = useState<DuelActionType>('NORMAL_SUMMON')
  const [formCardCode, setFormCardCode] = useState<string>(
    hoveredCard ? String(hoveredCard.id) : ''
  )
  const [formCardName, setFormCardName] = useState<string>(hoveredCard?.name || '')
  const [formFromLoc, setFormFromLoc] = useState<number>(CardLocation.HAND)
  const [formFromSeq, setFormFromSeq] = useState<number>(0)
  const [formToLoc, setFormToLoc] = useState<number>(CardLocation.MZONE)
  const [formToSeq, setFormToSeq] = useState<number>(2)
  const [formChain, setFormChain] = useState<number>(0)
  const [formDesc, setFormDesc] = useState<string>('')

  // 打开新增步骤窗口
  const handleOpenAdd = (): void => {
    setEditingStepId(null)
    const last = steps[steps.length - 1]
    if (last) {
      setFormTurn(last.turn)
      setFormTurnPlayer(last.turnPlayer)
      setFormPhase(last.phase)
      setFormActionPlayer(last.actionPlayer)
    } else {
      setFormTurn(1)
      setFormTurnPlayer(0)
      setFormPhase('M1')
      setFormActionPlayer(0)
    }
    // 默认选取当前悬停的卡片
    if (hoveredCard) {
      setFormCardCode(String(hoveredCard.id))
      setFormCardName(hoveredCard.name)
    } else {
      setFormCardCode('')
      setFormCardName('')
    }
    setFormActionType('NORMAL_SUMMON')
    setFormFromLoc(CardLocation.HAND)
    setFormToLoc(CardLocation.MZONE)
    setFormChain(0)
    setFormDesc('')
    setShowAddModal(true)
  }

  // 打开编辑现有步骤窗口
  const handleOpenEdit = (step: DuelStep): void => {
    setEditingStepId(step.id)
    setFormTurn(step.turn)
    setFormTurnPlayer(step.turnPlayer)
    setFormPhase(step.phase)
    setFormActionPlayer(step.actionPlayer)
    setFormActionType(step.actionType)
    setFormCardCode(step.cardCode ? String(step.cardCode) : '')
    setFormCardName(step.cardName || '')
    setFormFromLoc(step.fromLocation ?? CardLocation.HAND)
    setFormFromSeq(step.fromSequence ?? 0)
    setFormToLoc(step.toLocation ?? CardLocation.MZONE)
    setFormToSeq(step.toSequence ?? 0)
    setFormChain(step.chainIndex ?? 0)
    setFormDesc(step.description || '')
    setShowAddModal(true)
  }

  // 提交添加或保存
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
    setShowAddModal(false)
  }

  // 真实播放推演控制 (上一步 / 下一步 / 复位)
  const handlePrevStep = (): void => {
    if (currentStepIndex === null) {
      previewStepBoard(steps.length - 1)
    } else if (currentStepIndex > 0) {
      previewStepBoard(currentStepIndex - 1)
    }
  }

  const handleNextStep = (): void => {
    if (currentStepIndex === null) {
      previewStepBoard(0)
    } else if (currentStepIndex < steps.length - 1) {
      previewStepBoard(currentStepIndex + 1)
    }
  }

  const handleResetPlayback = (): void => {
    previewStepBoard(null)
  }

  return (
    <div className="w-full h-full flex flex-col shrink-0 select-none overflow-hidden text-xs">
      {/* 1. 顶栏：统计与核心操作按钮 */}
      <div className="p-2.5 border-b border-border/60 bg-muted/10 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
            <Film className="w-3.5 h-3.5 text-muted-foreground" />
            <span>对局剧情编排</span>
          </span>
          <span className="text-[10px] text-muted-foreground">
            共 {steps.length} 步 · {new Set(steps.map((s) => s.turn)).size || 1} 回合
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="outline"
            onClick={() => openScreenplayWithStep()}
            title="打开大屏决斗台本工作台，沉浸式编写角色台词与剧情"
            className="h-7 px-2 text-xs font-semibold gap-1 border-border text-foreground hover:bg-muted"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>台本</span>
          </Button>

          <Button
            size="xs"
            variant="default"
            onClick={handleOpenAdd}
            className="h-7 px-2.5 text-xs font-semibold gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加步骤</span>
          </Button>

          {steps.length > 0 && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => {
                if (window.confirm('确定要清空全部编排动作步骤吗？此操作可使用 Ctrl+Z 撤销。')) {
                  clearSteps()
                }
              }}
              title="清空全部步骤"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 1.1 决斗实战时序与连锁控制条 (Direct Duel Flow & Chain Bar) */}
      <div className="p-2 border-b border-border/60 bg-muted/20 flex flex-col gap-2 shrink-0 select-none">
        {/* 回合数、回合方与连锁状态 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs text-foreground">第 {currentTurn} 回合</span>
            <Badge
              variant="outline"
              onClick={() => setActiveTurnPlayer(activeTurnPlayer === 0 ? 1 : 0)}
              title="点击切换当前行动方 (我方 / 对方)"
              className={cn(
                'text-[10px] px-1.5 py-0 cursor-pointer font-bold transition-colors',
                activeTurnPlayer === 0
                  ? 'border-blue-500/50 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
                  : 'border-rose-500/50 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
              )}
            >
              {activeTurnPlayer === 0 ? '我方行动' : '对方行动'}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            {/* 连锁状态指示器 */}
            {currentChain > 0 ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-[10px] font-bold text-teal-300">
                <span className="animate-pulse">⛓ Chain {currentChain}</span>
                <button
                  type="button"
                  onClick={resetChain}
                  title="结算并重置连锁序号"
                  className="ml-0.5 text-[9px] px-1 py-0 bg-teal-500/30 hover:bg-teal-500/50 text-teal-200 rounded font-semibold cursor-pointer"
                >
                  结算
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 font-mono">C0 (无连锁)</span>
            )}

            {/* 自动记谱开关 */}
            <button
              type="button"
              onClick={() => setIsAutoRecording(!isAutoRecording)}
              title={
                isAutoRecording
                  ? '自动记谱开启中：在决斗盘拖拽或右键操作将自动记录动作步骤与连锁'
                  : '自动记谱已暂停：仅摆放卡片，不自动写入步骤流'
              }
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer',
                isAutoRecording
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                  : 'bg-muted border-border text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isAutoRecording ? 'bg-rose-500 animate-pulse' : 'bg-muted-foreground'
                )}
              />
              <span>{isAutoRecording ? '记谱中' : '暂停'}</span>
            </button>
          </div>
        </div>

        {/* 6 个阶段快捷切换条 (DP, SP, M1, BP, M2, EP) 与推进按钮 */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5 bg-background/80 p-0.5 rounded-md border border-border/70 flex-1">
            {ALL_PHASES.map((p) => {
              const isActive = currentPhase === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPhase(p)}
                  className={cn(
                    'flex-1 text-[10px] font-extrabold py-0.5 rounded transition-all text-center cursor-pointer',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                  title={`切换到 ${PHASE_NAMES[p] || p}`}
                >
                  {p}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              size="xs"
              variant="outline"
              onClick={nextPhase}
              title="推进到下一个决斗阶段 (DP → SP → M1 → BP → M2 → EP)"
              className="h-6 px-1.5 text-[10px] font-bold gap-0.5 border-border"
            >
              <span>下阶段</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={nextTurn}
              title="回合结束，推进到下一回合并切换回合方"
              className="h-6 px-1.5 text-[10px] font-bold text-foreground/90"
            >
              <span>下回合</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. 步骤流纵向时间轴展示区 (对标 MDPro3 动作列表) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2 select-text">
        {steps.length === 0 ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none">
            <Film className="w-10 h-10 text-muted-foreground/30 mb-2.5 animate-pulse" />
            <p className="font-semibold text-foreground/80">暂无编排动作步骤</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed max-w-[220px]">
              点击右上角「添加步骤」开始规划回合、阶段、动作与角色台词，打造生动决斗故事！
            </p>
            <div className="flex items-center gap-2 mt-3.5">
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenAdd}
                className="h-7 text-xs font-semibold gap-1 border-border text-foreground hover:bg-muted"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建第 1 步</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openScreenplayWithStep()}
                className="h-7 text-xs font-semibold gap-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>决斗台本工作台</span>
              </Button>
            </div>
          </div>
        ) : (
          steps.map((step, index) => {
            const isFirstInTurn = index === 0 || steps[index - 1].turn !== step.turn
            const isFirstInPhase =
              isFirstInTurn ||
              steps[index - 1].phase !== step.phase ||
              steps[index - 1].turn !== step.turn

            const colorTheme =
              ACTION_TYPE_COLORS[step.actionType] || ACTION_TYPE_COLORS.NORMAL_SUMMON
            const actionLabel = ACTION_TYPE_NAMES[step.actionType] || step.actionType
            const isCurrentPlaying = currentStepIndex === index

            // 移动路线描述
            const fromName = getLocationDisplayName(step.fromLocation, step.fromSequence)
            const toName = getLocationDisplayName(step.toLocation, step.toSequence)

            return (
              <div key={step.id} className="flex flex-col gap-1.5">
                {/* 2.1 回合分隔头 (Turn Header) */}
                {isFirstInTurn && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/70 shadow-sm mt-1 select-none">
                    <span className="font-bold text-xs text-foreground">第 {step.turn} 回合</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 font-medium border-border bg-background/60 text-muted-foreground"
                    >
                      {step.turnPlayer === 0 ? '我方回合' : '对方回合'}
                    </Badge>
                  </div>
                )}

                {/* 2.2 阶段标头 (Phase Banner) */}
                {isFirstInPhase && (
                  <div className="flex items-center gap-1.5 px-1 pt-1 select-none text-[11px] font-semibold text-muted-foreground/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                    <span>{PHASE_SHORT_NAMES[step.phase] || step.phase}</span>
                    <div className="flex-1 h-px bg-border/50 ml-1" />
                  </div>
                )}

                {/* 2.3 动作卡片本体 (Action Block) */}
                <div
                  onClick={() => previewStepBoard(index)}
                  onMouseEnter={() => {
                    if (step.instanceId) setHoveredInstanceId(step.instanceId)
                  }}
                  onMouseLeave={() => setHoveredInstanceId(null)}
                  className={cn(
                    'group relative flex flex-col gap-1.5 p-2 rounded-lg border transition-all cursor-pointer select-none',
                    isCurrentPlaying
                      ? 'border-primary/60 ring-2 ring-primary/25 bg-card/90 shadow-md'
                      : step.actionPlayer === 0
                        ? 'border-blue-500/30 bg-muted/20 hover:border-blue-500/60 hover:bg-muted/30'
                        : 'border-rose-500/30 bg-muted/20 hover:border-rose-500/60 hover:bg-muted/30'
                  )}
                >
                  {/* 卡片主信息行 */}
                  <div className="flex items-center gap-2">
                    {/* 卡图缩略图 (若有卡密) */}
                    {step.cardCode ? (
                      <div className="w-9 h-[52px] rounded overflow-hidden border border-border/80 bg-black/60 shrink-0 shadow-sm relative">
                        <img
                          src={getCardImageUrl(step.cardCode, true)}
                          alt={step.cardName || String(step.cardCode)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = CARD_BACK_IMAGE
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-9 h-[52px] rounded border border-dashed border-border/70 flex items-center justify-center shrink-0 text-muted-foreground/50">
                        <Layers className="w-4 h-4" />
                      </div>
                    )}

                    {/* 动作类型、玩家标签与移动流向 */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 truncate">
                          <span
                            className={cn(
                              'text-[10px] font-bold px-1 rounded truncate',
                              step.actionPlayer === 0
                                ? 'text-blue-400 bg-blue-500/10'
                                : 'text-rose-400 bg-rose-500/10'
                            )}
                          >
                            {step.actionPlayer === 0 ? '我方' : '对方'}
                          </span>
                          <span
                            className="font-bold text-xs text-foreground truncate"
                            title={
                              step.cardName || (step.cardCode ? String(step.cardCode) : '剧情事件')
                            }
                          >
                            {step.cardName || (step.cardCode ? String(step.cardCode) : '剧情事件')}
                          </span>
                        </div>

                        {/* 动作类型徽标 */}
                        <span
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0',
                            colorTheme.bg,
                            colorTheme.text,
                            colorTheme.border
                          )}
                        >
                          {actionLabel}
                        </span>
                      </div>

                      {/* 移动流向或连锁信息 */}
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                        {fromName && toName && (
                          <span className="flex items-center gap-1 truncate">
                            <span>{fromName}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/60" />
                            <span className="text-foreground/90 font-semibold">{toName}</span>
                          </span>
                        )}
                        {step.chainIndex && step.chainIndex > 0 && (
                          <span className="bg-teal-500/20 text-teal-400 font-bold px-1 rounded ml-auto">
                            C{step.chainIndex}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2.4 剧情对白 / 解说台词气泡 */}
                  {(step.dialogue || step.speaker || step.innerThoughts) && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        openScreenplayWithStep(step.id)
                      }}
                      title="点击进入大屏决斗台本工作台精修台词与剧情"
                      className="mt-0.5 p-1.5 rounded bg-background/80 hover:bg-background border border-border/50 hover:border-foreground/30 cursor-pointer text-[11px] leading-relaxed flex flex-col gap-0.5 transition-colors"
                    >
                      {step.speaker && (
                        <span className="font-bold text-[10px] text-foreground">
                          【{step.speaker}】:
                        </span>
                      )}
                      {step.dialogue && (
                        <span className="text-foreground/90 italic">“{step.dialogue}”</span>
                      )}
                      {step.innerThoughts && (
                        <span className="text-sky-400/90 text-[10px] italic">
                          （心理：{step.innerThoughts}）
                        </span>
                      )}
                    </div>
                  )}

                  {/* 悬停快捷操作栏 (台本工作台、上移、下移、编辑、删除) */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background/90 backdrop-blur-xs p-0.5 rounded border border-border shadow-sm">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        openScreenplayWithStep(step.id)
                      }}
                      title="在决斗台本工作台中精修台词与剧情"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                    >
                      <BookOpen className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveStep(step.id, 'up')
                      }}
                      title="上移此步骤"
                      className="h-5 w-5"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      disabled={index === steps.length - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        moveStep(step.id, 'down')
                      }}
                      title="下移此步骤"
                      className="h-5 w-5"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEdit(step)
                      }}
                      title="编辑此步骤"
                      className="h-5 w-5 text-blue-500 hover:text-blue-400"
                    >
                      <MessageSquare className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteStep(step.id)
                      }}
                      title="删除此步骤"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 3. 底部推演控制栏 (对标 MDPro3 播放推进控制器) */}
      <div className="p-2 border-t border-border/60 bg-muted/20 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={handleResetPlayback}
            title="复位至开场"
            className="h-7 w-7 text-muted-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon-xs"
            variant="ghost"
            disabled={steps.length === 0 || currentStepIndex === 0}
            onClick={handlePrevStep}
            title="上一步"
            className="h-7 w-7 text-muted-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon-xs"
            variant="ghost"
            disabled={steps.length === 0 || currentStepIndex === steps.length - 1}
            onClick={handleNextStep}
            title="下一步"
            className="h-7 w-7 text-muted-foreground"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <span className="text-[11px] font-mono font-medium text-muted-foreground">
          {currentStepIndex !== null
            ? `第 ${currentStepIndex + 1} / ${steps.length} 步`
            : '初始局面'}
        </span>
      </div>

      {/* 4. 添加 / 编辑动作步骤浮层弹窗 (Modal) */}
      {showAddModal && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-100"
        >
          <div className="w-[360px] bg-card text-card-foreground border border-border shadow-2xl rounded-xl p-4 flex flex-col gap-3 select-none animate-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            {/* 弹窗顶栏 */}
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="font-bold text-sm flex items-center gap-1.5">
                <Film className="w-4 h-4 text-muted-foreground" />
                <span>{editingStepId ? '编辑对局步骤' : '添加对局新步骤'}</span>
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setShowAddModal(false)}
                className="h-6 w-6 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveStep} className="flex flex-col gap-2.5 text-xs">
              {/* 回合与阶段设置 */}
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
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    决斗阶段
                  </label>
                  <select
                    value={formPhase}
                    onChange={(e) => setFormPhase(e.target.value as DuelPhase)}
                    className="h-7 text-xs rounded border border-border bg-background px-2"
                  >
                    {ALL_PHASES.map((p) => (
                      <option key={p} value={p}>
                        {PHASE_NAMES[p]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 回合玩家与动作执行玩家 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">回合方</label>
                  <select
                    value={formTurnPlayer}
                    onChange={(e) => setFormTurnPlayer(Number(e.target.value) as 0 | 1)}
                    className="h-7 text-xs rounded border border-border bg-background px-2 font-semibold"
                  >
                    <option value={0}>我方回合 (Player 0)</option>
                    <option value={1}>对方回合 (Player 1)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    动作发起人
                  </label>
                  <select
                    value={formActionPlayer}
                    onChange={(e) => setFormActionPlayer(Number(e.target.value) as 0 | 1)}
                    className="h-7 text-xs rounded border border-border bg-background px-2 font-semibold"
                  >
                    <option value={0}>我方发起 (Player 0)</option>
                    <option value={1}>对方发起 (Player 1)</option>
                  </select>
                </div>
              </div>

              {/* 动作类型与连锁序号 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    动作类型
                  </label>
                  <select
                    value={formActionType}
                    onChange={(e) => setFormActionType(e.target.value as DuelActionType)}
                    className="h-7 text-xs rounded border border-border bg-background px-2 font-bold text-foreground"
                  >
                    {ALL_ACTIONS.map((act) => (
                      <option key={act} value={act}>
                        {ACTION_TYPE_NAMES[act]}
                      </option>
                    ))}
                  </select>
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

              {/* 涉及卡密与卡名 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    卡密 (密码)
                  </label>
                  <Input
                    type="text"
                    value={formCardCode}
                    onChange={(e) => setFormCardCode(e.target.value)}
                    placeholder="8位卡片密码"
                    className="h-7 text-xs font-mono font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    卡片名称
                  </label>
                  <Input
                    type="text"
                    value={formCardName}
                    onChange={(e) => setFormCardName(e.target.value)}
                    placeholder="卡片名称"
                    className="h-7 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* 来源与目标区域 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    来源区域
                  </label>
                  <select
                    value={formFromLoc}
                    onChange={(e) => setFormFromLoc(Number(e.target.value))}
                    className="h-7 text-xs rounded border border-border bg-background px-2"
                  >
                    {COMMONLY_USED_LOCATIONS.map((loc) => (
                      <option key={`from_${loc.loc}`} value={loc.loc}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    移动至区域
                  </label>
                  <select
                    value={formToLoc}
                    onChange={(e) => setFormToLoc(Number(e.target.value))}
                    className="h-7 text-xs rounded border border-border bg-background px-2"
                  >
                    {COMMONLY_USED_LOCATIONS.map((loc) => (
                      <option key={`to_${loc.loc}`} value={loc.loc}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                  className="h-7 text-xs"
                >
                  取消
                </Button>
                <Button type="submit" size="sm" className="h-7 px-4 text-xs font-bold">
                  {editingStepId ? '保存修改' : '确认添加'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
