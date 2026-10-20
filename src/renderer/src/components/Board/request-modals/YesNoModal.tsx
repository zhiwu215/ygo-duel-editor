import React from 'react'
import { Crosshair, Swords } from 'lucide-react'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { Button } from '../../ui/button'
import { RequestModalShell } from './RequestModalShell'
import { DataOf, submitAnswer } from './engine'

const DIRECT_ATTACK_YESNO_DESC = 31

const PROMPT_TITLE = '请选择'

const DIRECT_ATTACK_HINT =
  '对方场上存在怪兽：直接攻击玩家，或选择一只怪兽作为攻击对象。'

export const YesNoModal: React.FC<{ request: EngineRequest; data: DataOf<'yesno'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const isDirectAttackPrompt = data.desc === DIRECT_ATTACK_YESNO_DESC

  return (
    <RequestModalShell
      title={PROMPT_TITLE}
      width="max-w-sm"
      footer={
        isDirectAttackPrompt ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => submitAnswer({ kind: 'yesno', yes: false })}
            >
              <Crosshair />
              选择攻击对象
            </Button>
            <Button size="sm" disabled={loading} onClick={() => submitAnswer({ kind: 'yesno', yes: true })}>
              <Swords />
              直接攻击
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => submitAnswer({ kind: 'yesno', yes: false })}
            >
              否
            </Button>
            <Button size="sm" disabled={loading} onClick={() => submitAnswer({ kind: 'yesno', yes: true })}>
              是
            </Button>
          </>
        )
      }
    >
      <div className="whitespace-pre-line break-words text-xs leading-relaxed text-foreground">
        {request.title}
        {isDirectAttackPrompt ? `\n${DIRECT_ATTACK_HINT}` : ''}
      </div>
    </RequestModalShell>
  )
}
