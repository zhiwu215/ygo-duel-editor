import React from 'react'
import { CardLocation, CardPosition } from '@shared/index'
import { useAttackTargetingStore } from '../../../stores/useAttackTargetingStore'
import { useDuelStore } from '../../../stores/useDuelStore'
import { executeEditorAttack } from '../../../utils/editorBattle'
import { Button } from '../../ui/button'

export const AttackTargetingBar: React.FC = () => {
  const attacker = useAttackTargetingStore((s) => s.attacker)
  const cancel = useAttackTargetingStore((s) => s.cancel)
  const cards = useDuelStore((s) => s.state.cards)

  if (!attacker) return null

  const attackerName = attacker.card?.name ?? '怪兽'
  const opponent = attacker.controller === 0 ? 1 : 0
  const opponentMonsters = cards.filter(
    (c) => c.controller === opponent && c.location === CardLocation.MZONE
  )
  const canDirect = opponentMonsters.length === 0
  const hasFaceupTarget = opponentMonsters.some(
    (c) =>
      c.position !== CardPosition.FACEDOWN_DEFENSE && c.position !== CardPosition.FACEDOWN_ATTACK
  )

  return (
    <div className="fixed bottom-[172px] left-1/2 z-[60] flex max-w-[720px] -translate-x-1/2 items-center gap-3 rounded-xl border border-rose-500/40 bg-card/95 px-4 py-2 shadow-2xl backdrop-blur select-none">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-semibold text-foreground">
          【{attackerName}】攻击宣言 — 点击对方场上的表侧怪兽作为目标
        </span>
        {!hasFaceupTarget && !canDirect && (
          <span className="text-[11px] text-muted-foreground">对方怪兽均为盖放，无法选择目标</span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {canDirect && (
          <Button size="sm" onClick={() => executeEditorAttack(attacker, null)}>
            直接攻击
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={cancel}>
          取消
        </Button>
      </div>
    </div>
  )
}
