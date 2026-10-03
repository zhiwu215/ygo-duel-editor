import React from 'react'
import { Plus } from 'lucide-react'
import { CardLocation, CardPosition, CdbCard } from '@shared/index'
import { useDuelStore } from '../../../stores/useDuelStore'
import { ZoneSlot } from '../ZoneSlot'
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
        moveCard(movedInstanceId, CardLocation.HAND, handCards.length, controller)
        return
      }

      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return
      const droppedCard = JSON.parse(dataStr) as CdbCard
      const defaultPos = isOpponent ? CardPosition.FACEDOWN : CardPosition.FACEUP
      addCardToZone(droppedCard, controller, CardLocation.HAND, handCards.length, defaultPos)
    } catch (err) {
      console.error('[HandTray] Drop failed:', err)
    }
  }

  return (
    <div
      className={`w-full max-w-5xl shrink-0 p-2 rounded-xl bg-card/60 backdrop-blur-md border shadow-lg flex flex-col gap-1.5 ${
        isOpponent ? 'border-red-500/25' : 'border-blue-500/25'
      }`}
    >
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <span
            className={`font-bold tracking-wide text-xs ${isOpponent ? 'text-red-400' : 'text-blue-400'}`}
          >
            {isOpponent ? '对方手牌' : '我方手牌'} ({handCards.length} 张)
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 font-medium ${
              isOpponent
                ? 'bg-red-950/60 text-red-300 border-red-500/30'
                : 'bg-blue-950/60 text-blue-300 border-blue-500/30'
            }`}
          >
            {isOpponent ? '剧情 / 应对' : '我方'}
          </Badge>
        </div>
        <span className="text-[11px] text-muted-foreground/80 hidden sm:inline">
          {isOpponent
            ? '可直接拖拽卡片至此（默认里侧，右键可公开或转移）'
            : '可从左侧搜索列表直接拖拽卡片至此处放入手牌'}
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
        className={`h-[114px] w-full px-2 py-1 rounded-lg bg-black/40 border border-dashed flex items-center gap-2 overflow-x-auto shadow-inner transition-colors ${
          isOpponent
            ? 'border-red-500/25 hover:border-red-500/50'
            : 'border-blue-500/25 hover:border-blue-500/50'
        }`}
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
              isOpponent ? 'text-red-300/50' : 'text-blue-300/50'
            }`}
          >
            <Plus
              className={`w-3.5 h-3.5 ${isOpponent ? 'text-red-400/50' : 'text-blue-400/50'}`}
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
