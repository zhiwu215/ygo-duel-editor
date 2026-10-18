import { useEffect, useState } from 'react'
import { useDuelEngineStore } from '../stores/useDuelEngineStore'

/** 洗牌动画与提示的持续时长（毫秒） */
export const HAND_SHUFFLE_PULSE_MS = 1600

export interface HandShufflePulse {
  /** 最近一次切洗的信号 id：作为动画 key，变化即重播一次洗牌动画 */
  tick: number
  /** 提示是否仍在展示（约 1.6 秒后自动收起） */
  active: boolean
}

/**
 * 订阅引擎的手牌切洗信号，按阵营返回一次性的动画/提示状态。
 * 引擎不会为切洗单独停下询问，若不提示，玩家只会看到手牌凭空位移。
 */
export function useHandShufflePulse(controller: 0 | 1): HandShufflePulse {
  const signal = useDuelEngineStore((s) => s.handShuffle)
  const [expiredId, setExpiredId] = useState(0)
  const signalId = signal && signal.players.includes(controller) ? signal.id : 0

  useEffect(() => {
    if (!signalId) return
    const timer = setTimeout(() => setExpiredId(signalId), HAND_SHUFFLE_PULSE_MS)
    return () => clearTimeout(timer)
  }, [signalId])

  return { tick: signalId, active: signalId !== 0 && signalId !== expiredId }
}
