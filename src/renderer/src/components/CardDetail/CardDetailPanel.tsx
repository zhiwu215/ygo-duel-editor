import React from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { CardUtils, ATTRIBUTE_NAMES } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Shield, Swords, Layers, HelpCircle } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'

export const CardDetailPanel: React.FC = () => {
  const { hoveredCard, selectedCardId, state } = useDuelStore()

  // 如果没有悬停的卡，优先使用当前选中的场上卡片
  let currentCard = hoveredCard
  if (!currentCard && selectedCardId) {
    const selectedFieldCard = state.cards.find((c) => c.instanceId === selectedCardId)
    if (selectedFieldCard?.card) {
      currentCard = selectedFieldCard.card
    }
  }

  if (!currentCard) {
    return (
      <aside className="w-72 h-full border-l border-border bg-card/30 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none">
        <HelpCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="font-medium text-foreground/80">尚未选择卡片</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">
          将鼠标悬停在左侧搜索列表或场上卡片上，即可在此处查看超高清卡图与详细效果说明。
        </p>
      </aside>
    )
  }

  const isMonster = CardUtils.isMonster(currentCard.type)
  const isXyz = CardUtils.isXyz(currentCard.type)
  const isLink = CardUtils.isLink(currentCard.type)
  const isPendulum = CardUtils.isPendulum(currentCard.type)
  const star = CardUtils.getStarLevel(currentCard.level, currentCard.type)
  const attrName = ATTRIBUTE_NAMES[currentCard.attribute] || '无'
  const pScale = isPendulum ? CardUtils.getPendulumScales(currentCard.level) : null

  return (
    <aside className="w-80 h-full border-l border-border bg-card/40 flex flex-col shrink-0 select-none overflow-hidden">
      {/* 卡图展示区域 */}
      <div className="p-4 flex flex-col items-center bg-muted/20">
        <img
          src={getCardImageUrl(currentCard.id)}
          alt={currentCard.name}
          className="w-48 h-70 object-cover rounded-md shadow-lg border border-border/80 bg-black/40"
          onError={(e) => {
            const target = e.currentTarget
            if (target.src !== CARD_BACK_IMAGE) {
              target.src = CARD_BACK_IMAGE
            }
          }}
        />
        <div className="flex items-center gap-2 mt-2.5">
          <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
            密码: {currentCard.id}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* 卡片详情数据 - 严格限制 flex-1 min-h-0 并启用流畅暗色定制滚动条 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-3">
          {/* 卡名 */}
          <div>
            <h3 className="font-bold text-base text-foreground leading-snug">{currentCard.name}</h3>
            {/* 属性与种族标签 */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 text-[11px]"
              >
                {attrName}属性
              </Badge>
              {isMonster && (
                <Badge variant="secondary" className="text-[11px]">
                  {isXyz ? `Rank ${star}` : isLink ? `Link ${star}` : `★ ${star}`}
                </Badge>
              )}
              {isPendulum && pScale && (
                <Badge
                  variant="outline"
                  className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[11px]"
                >
                  刻度 {pScale.lscale}
                </Badge>
              )}
            </div>
          </div>

          {/* 攻防数值面板 (仅怪兽) */}
          {isMonster && (
            <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-muted/40 border border-border/50 text-xs">
              <div className="flex items-center gap-1.5 font-mono">
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-muted-foreground">ATK:</span>
                <span className="font-bold text-foreground">
                  {currentCard.atk >= 0 ? currentCard.atk : '?'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-muted-foreground">DEF:</span>
                <span className="font-bold text-foreground">
                  {isLink ? '-' : currentCard.def >= 0 ? currentCard.def : '?'}
                </span>
              </div>
            </div>
          )}

          {/* 效果描述文本 */}
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>【卡片效果 / 描述】</span>
            </div>
            <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed p-2.5 rounded-lg bg-muted/30 border border-border/40 font-sans">
              {currentCard.desc}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
