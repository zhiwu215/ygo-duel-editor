import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import {
  DuelPhase,
  DuelPuzzleState,
  EngineChainMode,
  EngineProbeOptionsResult,
  EngineProbeReplay,
  FieldCard
} from '@shared/index'
import { useConfigStore } from './useConfigStore'
import { useDuelStore } from './useDuelStore'
import { duelStateProbeKey, ruleCheckAllows } from '../utils/ruleCheck'
import type { RuleCheckKind, RuleCheckApi } from '../utils/ruleCheck'

interface RuleCheckState {
  probe: EngineProbeOptionsResult | null
  probeKey: string | null
  pendingKey: string | null
  error: string | null
  attempts: number
  attemptsKey: string | null
  timer: ReturnType<typeof setTimeout> | null
  clearProbe: () => void
  ensureProbe: (
    key: string,
    state: DuelPuzzleState,
    currentPhase: DuelPhase,
    replay?: EngineProbeReplay,
    chainMode?: EngineChainMode
  ) => void
}

const PROBE_DEBOUNCE_MS = 160
const RETRY_DELAY_MS = 2600
const MAX_ATTEMPTS = 3

export const useRuleCheckStore = create<RuleCheckState>((set, get) => {
  const schedule = (
    key: string,
    state: DuelPuzzleState,
    currentPhase: DuelPhase,
    replay: EngineProbeReplay | undefined,
    chainMode: EngineChainMode | undefined,
    delay: number
  ): void => {
    const s = get()
    if (s.timer) clearTimeout(s.timer)
    const timer = setTimeout(() => {
      void runProbe(key, state, currentPhase, replay, chainMode)
    }, delay)
    set({ timer, pendingKey: key })
  }

  const retryIfNeeded = (
    key: string,
    state: DuelPuzzleState,
    currentPhase: DuelPhase,
    replay: EngineProbeReplay | undefined,
    chainMode: EngineChainMode | undefined,
    degradedNow: boolean
  ): void => {
    const s = get()
    const attempts = s.attemptsKey === key ? s.attempts + 1 : 1
    set({ attempts, attemptsKey: key })
    if (degradedNow && attempts < MAX_ATTEMPTS) {
      schedule(key, state, currentPhase, replay, chainMode, RETRY_DELAY_MS)
    }
  }

  const runProbe = async (
    key: string,
    state: DuelPuzzleState,
    currentPhase: DuelPhase,
    replay: EngineProbeReplay | undefined,
    chainMode: EngineChainMode | undefined
  ): Promise<void> => {
    let probe: EngineProbeOptionsResult | null = null
    let error: string | null = null
    try {
      probe = await window.api.duelProbeOptions({ state, currentPhase, replay, chainMode })
    } catch (err) {
      console.error('[useRuleCheckStore] duelProbeOptions failed:', err)
      error = err instanceof Error ? err.message : '规则校验探针异常'
    }
    if (get().pendingKey !== key) return
    set({ probe, probeKey: key, pendingKey: null, error })
    retryIfNeeded(
      key,
      state,
      currentPhase,
      replay,
      chainMode,
      probe === null || !probe.ok || probe.degraded
    )
  }

  return {
    probe: null,
    probeKey: null,
    pendingKey: null,
    error: null,
    attempts: 0,
    attemptsKey: null,
    timer: null,

    clearProbe: () => {
      const timer = get().timer
      if (timer) clearTimeout(timer)
      set({
        probe: null,
        probeKey: null,
        pendingKey: null,
        error: null,
        attempts: 0,
        attemptsKey: null,
        timer: null
      })
    },

    ensureProbe: (key, state, currentPhase, replay, chainMode) => {
      const s = get()
      const cachedUsable = s.probeKey === key && s.probe !== null && s.probe.ok && !s.probe.degraded
      if (cachedUsable) return
      if (s.pendingKey === key && s.timer) return
      if (s.attemptsKey !== key) set({ attempts: 0, attemptsKey: key })
      schedule(key, state, currentPhase, replay, chainMode, PROBE_DEBOUNCE_MS)
    }
  }
})

export function useRuleCheck(): RuleCheckApi {
  const enabled = useConfigStore((s) => s.config.ruleCheckEnabled !== false)
  const state = useDuelStore((s) => s.state)
  const currentPhase = useDuelStore((s) => s.currentPhase)
  const turnLog = useDuelStore((s) => s.turnLog)
  const chainMode = useDuelStore((s) => s.chainMode)
  const probe = useRuleCheckStore((s) => s.probe)
  const error = useRuleCheckStore((s) => s.error)
  const ensureProbe = useRuleCheckStore((s) => s.ensureProbe)
  const clearProbe = useRuleCheckStore((s) => s.clearProbe)

  const replay = useMemo(
    () =>
      turnLog.length > 0
        ? {
            baseline: turnLog[0].preState,
            actions: turnLog.map((e) => ({ action: e.action, selections: e.selections }))
          }
        : undefined,
    [turnLog]
  )

  const key = `${duelStateProbeKey(state, currentPhase, replay)}|cm:${chainMode}`

  useEffect(() => {
    if (enabled) {
      ensureProbe(key, state, currentPhase, replay, chainMode)
    } else {
      clearProbe()
    }
  }, [enabled, key, state, currentPhase, replay, chainMode, ensureProbe, clearProbe])

  const turnPlayer = (state.turnPlayer ?? 0) as 0 | 1
  const active = enabled && probe !== null && probe.ok && !probe.degraded
  const degraded = enabled && (error !== null || (probe !== null && (!probe.ok || probe.degraded)))
  const warnings = probe?.warnings ?? (error ? [error] : [])

  return {
    active,
    degraded,
    warnings,
    allows: (card: FieldCard, kind: RuleCheckKind): boolean =>
      ruleCheckAllows(active, turnPlayer, probe, card, kind)
  }
}
