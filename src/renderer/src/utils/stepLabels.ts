import { ACTION_TYPE_NAMES, DuelStep } from '@shared/index'

export function duelActionLabel(
  step: Pick<DuelStep, 'actionType' | 'targetPlayer'> & { description?: string }
): string {
  if (step.actionType === 'ATTACK' && step.targetPlayer !== undefined) return '直接攻击'
  if (step.actionType === 'PHASE_CHANGE' && step.description?.includes('结束回合')) {
    return '回合结束'
  }
  return ACTION_TYPE_NAMES[step.actionType] || step.actionType
}
