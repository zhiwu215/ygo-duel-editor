import React from 'react'
import { DuelPhase } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useRuleCheck } from '../../stores/useRuleCheckStore'
import { cn } from '../../lib/utils'

const PHASE_LABELS: Record<DuelPhase, string> = {
  DP: 'D P',
  SP: 'S P',
  M1: 'M 1',
  BP: 'B P',
  M2: 'M 2',
  EP: 'E P'
}

export const PhaseStatusButton: React.FC = () => {
  const currentPhase = useDuelStore((s) => s.currentPhase)
  return (
    <div
      className={cn(
        'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest',
        'border-neutral-400/80 dark:border-neutral-600 bg-neutral-300/90 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-inner'
      )}
    >
      {PHASE_LABELS[currentPhase] || currentPhase}
    </div>
  )
}

export const PhaseMiddleButton: React.FC = () => {
  const currentPhase = useDuelStore((s) => s.currentPhase)
  const activeTurnPlayer = useDuelStore((s) => s.activeTurnPlayer)
  const executePhaseChange = useDuelStore((s) => s.executePhaseChange)
  const executeDrawCard = useDuelStore((s) => s.executeDrawCard)
  const rule = useRuleCheck()

  if (currentPhase === 'DP') {
    return (
      <button
        type="button"
        onClick={() => executeDrawCard(activeTurnPlayer)}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-sans text-[10px] font-bold tracking-tight cursor-pointer transition-colors',
          'border-sky-400/80 dark:border-sky-500/80 bg-sky-100/90 dark:bg-sky-950/60 hover:bg-sky-200 dark:hover:bg-sky-900/80 text-sky-900 dark:text-sky-200 shadow-xs'
        )}
      >
        抽卡
      </button>
    )
  }

  if (currentPhase === 'M1') {
    const canBp = !rule.active || rule.probe?.toBp === true
    if (!canBp) return null
    return (
      <button
        type="button"
        onClick={() => void executePhaseChange('BP')}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest cursor-pointer transition-colors',
          'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
        )}
      >
        B P
      </button>
    )
  }

  if (currentPhase === 'BP') {
    const canM2 = !rule.active || rule.probe?.toM2 === true
    if (!canM2) return null
    return (
      <button
        type="button"
        onClick={() => void executePhaseChange('M2')}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest cursor-pointer transition-colors',
          'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
        )}
      >
        M 2
      </button>
    )
  }

  return null
}

export const PhaseEpButton: React.FC = () => {
  const currentPhase = useDuelStore((s) => s.currentPhase)
  const setCurrentPhase = useDuelStore((s) => s.setCurrentPhase)
  const executePhaseChange = useDuelStore((s) => s.executePhaseChange)
  const nextTurn = useDuelStore((s) => s.nextTurn)
  const rule = useRuleCheck()

  if (currentPhase === 'DP' || currentPhase === 'SP') {
    return (
      <button
        type="button"
        onClick={() => setCurrentPhase('M1')}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest cursor-pointer transition-colors',
          'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
        )}
      >
        M 1
      </button>
    )
  }

  if (currentPhase === 'M1' || currentPhase === 'BP' || currentPhase === 'M2') {
    const canEp = !rule.active || rule.probe?.toEp === true
    if (!canEp) return null
    return (
      <button
        type="button"
        onClick={() => void executePhaseChange('EP')}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest cursor-pointer transition-colors',
          'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
        )}
      >
        E P
      </button>
    )
  }

  if (currentPhase === 'EP') {
    return (
      <button
        type="button"
        onClick={() => nextTurn()}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-sans text-[10px] font-bold tracking-tight cursor-pointer transition-colors',
          'border-amber-400/80 dark:border-amber-500/80 bg-amber-100/90 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/80 text-amber-900 dark:text-amber-200 shadow-xs'
        )}
      >
        下回合
      </button>
    )
  }

  return null
}
