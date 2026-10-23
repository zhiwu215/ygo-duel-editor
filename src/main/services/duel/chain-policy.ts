import type { TimingPolicy } from '@shared/index'

export type ChainPolicy = TimingPolicy['chain']

interface ChainDecision {
  policy: ChainPolicy
  chainCount: number
  specialCount: number
  forced: boolean
  selectTrigger: boolean
}

export function shouldAutoPassChain({
  policy,
  chainCount,
  specialCount,
  forced,
  selectTrigger
}: ChainDecision): boolean {
  if (selectTrigger || forced) return false
  const ignoreChain = policy === 'ignore'
  const alwaysChain = policy === 'all'
  const whenAvailable = policy === 'available'
  const first = ignoreChain || ((chainCount === 0 || specialCount === 0) && !alwaysChain)
  const second = chainCount === 0 || !whenAvailable
  return first && second
}
