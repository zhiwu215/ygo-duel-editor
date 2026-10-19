import React from 'react'
import { Check, Crosshair, Swords, X } from 'lucide-react'
import type { EngineRequest } from '@shared/engine/protocol'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../../utils/cardImage'
import { Button } from '../../ui/button'
import { RequestModalShell } from './RequestModalShell'
import { DataOf, submitAnswer } from './engine'
import { cardNameOf, useCardMeta } from './useCardMeta'

const DIRECT_ATTACK_YESNO_DESC = 31

export const YesNoModal: React.FC<{ request: EngineRequest; data: DataOf<'yesno'> }> = ({
  request,
  data
}) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const meta = useCardMeta(data.card ? [data.card] : [])
  const card = data.card && data.card.code > 0 ? data.card : null
  const cardData = card ? meta[card.code] : undefined
  const isDirectAttackPrompt = data.desc === DIRECT_ATTACK_YESNO_DESC

  return (
    <RequestModalShell
      title={request.title}
      subtitle={request.subtitle}
      width="max-w-sm"
      footer={
        isDirectAttackPrompt ? (
          <>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => submitAnswer({ kind: 'yesno', yes: false })}
            >
              <Crosshair />
              选择攻击对象
            </Button>
            <Button disabled={loading} onClick={() => submitAnswer({ kind: 'yesno', yes: true })}>
              <Swords />
              直接攻击
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => submitAnswer({ kind: 'yesno', yes: false })}
            >
              <X />否
            </Button>
            <Button disabled={loading} onClick={() => submitAnswer({ kind: 'yesno', yes: true })}>
              <Check />是
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {card && (
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/20 p-2">
            <img
              src={getCardImageUrl(card.code, true)}
              alt={cardNameOf(meta, card.code)}
              className="h-[106px] w-[76px] shrink-0 rounded border border-border/60 object-cover"
              onError={(e) => {
                if (e.currentTarget.src !== UNKNOWN_CARD_IMAGE) {
                  e.currentTarget.src = UNKNOWN_CARD_IMAGE
                }
              }}
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground">{cardNameOf(meta, card.code)}</div>
              {cardData?.desc && (
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[10px] leading-relaxed text-muted-foreground">
                  {cardData.desc}
                </p>
              )}
            </div>
          </div>
        )}
        <p className="text-center text-xs font-medium text-foreground/90">
          {isDirectAttackPrompt
            ? '对方场上存在怪兽：直接攻击玩家，或选择一只怪兽作为攻击对象。'
            : '是否执行上述效果 / 操作？'}
        </p>
      </div>
    </RequestModalShell>
  )
}
