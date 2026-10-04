import React from 'react'
import { Plus } from 'lucide-react'
import { CardLocation, CdbCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { ZoneSlot } from '../ZoneSlot'
import { getDropPosOverride } from '../../../utils/zoneDrop'
import { Badge } from '../../ui/badge'

interface HandTrayProps {
  controller: 0 | 1
  ruleName?: string
}

export const HandTray: React.FC<HandTrayProps> = ({ controller, ruleName }) => {
  const { state, addCardToZone, moveCard } = useDuelStore()

  const isOpponent = controller === 1
  const handCards = state.cards.filter(
    (c) => c.controller === controller && c.location === CardLocation.HAND
  )

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    try {
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')
      if (movedInstanceId) {
        const { state, isAutoRecording, recordAction } = useDuelStore.getState()
        const srcCard = state.cards.find((c) => c.instanceId === movedInstanceId)
        if (isAutoRecording && srcCard && srcCard.location === CardLocation.DECK) {
          recordAction({
            actionType: 'DRAW',
            actionPlayer: controller,
            card: { code: srcCard.code, name: srcCard.card?.name },
            fromLocation: CardLocation.DECK,
            toLocation: CardLocation.HAND,
            description: `${controller === 0 ? '我方' : '对方'}抽卡【${srcCard.card?.name || srcCard.code}】`
          })
        }
        // Ctrl 拖入 = 公开手牌；默认未公开 (store 侧默认)
        moveCard(
          movedInstanceId,
          CardLocation.HAND,
          handCards.length,
          controller,
          getDropPosOverride(CardLocation.HAND, e.ctrlKey)
        )
        return
      }

      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return
      const droppedCard = JSON.parse(dataStr) as CdbCard
      addCardToZone(
        droppedCard,
        controller,
        CardLocation.HAND,
        handCards.length,
        getDropPosOverride(CardLocation.HAND, e.ctrlKey)
      )
    } catch (err) {
      console.error('[HandTray] Drop failed:', err)
    }
  }

  return (
    <div className="relative z-10 w-full max-w-5xl shrink-0 p-2 rounded-lg bg-card border border-border shadow-sm flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <span
            className={`font-bold tracking-wide text-xs ${
              isOpponent ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
            }`}
          >
            {isOpponent ? '对方手牌' : '我方手牌'} ({handCards.length} 张)
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium">
            {isOpponent ? '剧情 / 应对' : '我方'}
          </Badge>
        </div>
        <span className="text-[11px] text-muted-foreground/80 hidden sm:inline">
          {isOpponent
            ? '可直接拖拽卡片至此（默认未公开，右键可设为公开或转移）'
            : '可从左侧搜索列表直接拖拽卡片至此放入手牌（Ctrl 拖入 = 公开）'}
        </span>
        {ruleName && (
          <Badge variant="secondary" className="text-[10px] h-4 font-mono opacity-80">
            场地: {ruleName}
          </Badge>
        )}
      </div>

      {/* 手牌横向排布流 (卡多时横向滚动，纵向高度恒定) */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="h-[114px] w-full px-2 py-1 rounded border border-dashed border-border hover:border-blue-400/60 bg-muted/30 dark:bg-black/25 flex items-center gap-2 overflow-x-auto transition-colors"
      >
        {handCards.map((c, idx) => (
          <div key={c.instanceId} className="shrink-0">
            <ZoneSlot
              label={`${isOpponent ? '对方手牌' : '我方手牌'} ${idx + 1}`}
              controller={controller}
              location={CardLocation.HAND}
              sequence={c.sequence}
              card={c}
            />
          </div>
        ))}

        {handCards.length === 0 && (
          <div
            className={`w-full h-full flex items-center justify-center text-xs gap-1.5 pointer-events-none ${
              isOpponent
                ? 'text-red-600/60 dark:text-red-300/50'
                : 'text-blue-600/60 dark:text-blue-300/50'
            }`}
          >
            <Plus
              className={`w-3.5 h-3.5 ${isOpponent ? 'text-red-600/70 dark:text-red-400/50' : 'text-blue-600/70 dark:text-blue-400/50'}`}
            />
            <span>
              {isOpponent
                ? '对方手牌为空，可将手坑、解场或剧情卡片拖拽至此'
                : '手牌为空，可将卡片拖拽至此放入起手手牌'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
