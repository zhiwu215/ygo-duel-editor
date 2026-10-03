import React, { useState, useEffect } from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { CardUtils, ATTRIBUTE_NAMES } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Shield, Swords, Layers, HelpCircle, ZoomIn, X, Copy, Check } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'

export const CardDetailPanel: React.FC = () => {
  const { hoveredCard, selectedCardId, state } = useDuelStore()
  /** 是否打开卡图高清放大查看弹窗 (Modal) */
  const [showImageModal, setShowImageModal] = useState<boolean>(false)
  /** 卡片效果描述文本是否刚刚完成复制（用于展示 1.5 秒「已复制」反馈） */
  const [copiedDesc, setCopiedDesc] = useState<boolean>(false)
  /** 卡片密码（ID）是否刚刚完成复制（用于展示 1.5 秒「已复制」反馈） */
  const [copiedId, setCopiedId] = useState<boolean>(false)

  // 如果没有悬停的卡，优先使用当前选中的场上卡片
  let currentCard = hoveredCard
  if (!currentCard && selectedCardId) {
    const selectedFieldCard = state.cards.find((c) => c.instanceId === selectedCardId)
    if (selectedFieldCard?.card) {
      currentCard = selectedFieldCard.card
    }
  }

  // 监听 Esc 键关闭大图弹窗
  useEffect(() => {
    if (!showImageModal) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setShowImageModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showImageModal])

  const handleCopyDesc = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!currentCard?.desc) return
    try {
      await navigator.clipboard.writeText(currentCard.desc)
      setCopiedDesc(true)
      setTimeout(() => setCopiedDesc(false), 1500)
    } catch (err) {
      console.error('[CardDetailPanel] Failed to copy description:', err)
    }
  }

  const handleCopyId = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!currentCard?.id) return
    try {
      await navigator.clipboard.writeText(String(currentCard.id))
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 1500)
    } catch (err) {
      console.error('[CardDetailPanel] Failed to copy password:', err)
    }
  }

  if (!currentCard) {
    return (
      <aside className="w-80 h-full border-r border-border bg-card/30 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none shrink-0">
        <HelpCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="font-medium text-foreground/80">尚未选择卡片</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">
          将鼠标悬停在右侧卡片列表或场上卡片上，即可在此处查阅超高清卡图与详细效果说明。
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
    <>
      <aside className="w-80 h-full border-r border-border bg-card/40 flex flex-col shrink-0 overflow-hidden">
        {/* 卡图展示区域 */}
        <div className="p-4 flex flex-col items-center bg-muted/20 select-none">
          <div
            className="group relative cursor-zoom-in rounded-md overflow-hidden shadow-lg border border-border/80 bg-black/40"
            onClick={() => setShowImageModal(true)}
            title="点击放大查看卡图"
          >
            <img
              src={getCardImageUrl(currentCard.id)}
              alt={currentCard.name}
              className="w-48 h-70 object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src !== CARD_BACK_IMAGE) {
                  target.src = CARD_BACK_IMAGE
                }
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-medium backdrop-blur-sm shadow-md">
                <ZoomIn className="w-3.5 h-3.5" />
                <span>点击放大</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={handleCopyId}
              className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-background/50 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="点击复制卡密"
            >
              <span className="font-mono text-[11px]">密码: {currentCard.id}</span>
              {copiedId ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>
        </div>

        <Separator />

        {/* 卡片详情数据 - 严格限制 flex-1 min-h-0 并启用流畅暗色定制滚动条 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 select-text">
          <div className="space-y-3">
            {/* 卡名 */}
            <div>
              <h3 className="font-bold text-base text-foreground leading-snug cursor-text selection:bg-primary/25">
                {currentCard.name}
              </h3>
              {/* 属性与种族标签 */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap select-none">
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
              <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-muted/40 border border-border/50 text-xs select-none">
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
              <div className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center justify-between select-none">
                <div className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>【卡片效果 / 描述】</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyDesc}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/50 hover:bg-muted/70 transition-colors"
                  title="一键复制卡片效果描述"
                >
                  {copiedDesc ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500 font-medium">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed p-2.5 rounded-lg bg-muted/30 border border-border/40 font-sans cursor-text selection:bg-primary/25 selection:text-foreground">
                {currentCard.desc}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 卡图放大查看 Lightbox 弹窗 */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none animate-in fade-in"
          onClick={() => setShowImageModal(false)}
        >
          {/* 顶部工具栏 */}
          <div
            className="absolute top-4 right-4 flex items-center gap-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white/90 text-xs font-medium bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
              {currentCard.name}
            </div>
            <button
              type="button"
              onClick={() => setShowImageModal(false)}
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center transition-colors border border-white/15 cursor-pointer"
              title="关闭 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 高清卡图主体 */}
          <div
            className="relative max-h-[85vh] max-w-[90vw] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getCardImageUrl(currentCard.id)}
              alt={currentCard.name}
              className="max-h-[82vh] max-w-[85vw] object-contain rounded-lg shadow-2xl border border-white/10"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src !== CARD_BACK_IMAGE) {
                  target.src = CARD_BACK_IMAGE
                }
              }}
            />
          </div>

          <p className="mt-3 text-white/50 text-[11px]">按 Esc 或点击任意空白处关闭</p>
        </div>
      )}
    </>
  )
}
