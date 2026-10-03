import React, { useState, useEffect } from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import {
  formatCardTypeLine,
  formatCardStatsLine,
  formatCardSeriesLine
} from '../../utils/cardFormat'
import { HelpCircle, ZoomIn, X, Copy, Check } from 'lucide-react'

export const CardDetailPanel: React.FC = () => {
  const { hoveredCard, selectedCardId, state } = useDuelStore()
  /** 是否打开卡图高清放大查看弹窗 (Modal) */
  const [showImageModal, setShowImageModal] = useState<boolean>(false)
  /** 卡片名称是否刚刚完成复制（用于展示 1.5 秒「已复制」反馈） */
  const [copiedName, setCopiedName] = useState<boolean>(false)

  // 如果没有悬停的卡，优先使用当前选中的场上卡片
  let currentCard = hoveredCard
  const selectedFieldCard = selectedCardId
    ? state.cards.find((c) => c.instanceId === selectedCardId)
    : undefined
  if (!currentCard && selectedFieldCard?.card) {
    currentCard = selectedFieldCard.card
  }

  // 如果选中卡片暂缺 CDB 详情，异步拉取并自动回填
  useEffect(() => {
    if (!currentCard && selectedFieldCard && !selectedFieldCard.card) {
      window.api
        .getCardsByIds([selectedFieldCard.code])
        .then((cardMap) => {
          const cardData = cardMap[selectedFieldCard.code]
          if (cardData) {
            useDuelStore.getState().setCardData(selectedFieldCard.instanceId, cardData)
          }
        })
        .catch((err) => {
          void err
        })
    }
  }, [currentCard, selectedFieldCard])

  // 监听 Esc 键关闭大图弹窗 (捕获阶段拦截，阻止冒泡到列表弹窗等底层组件)
  useEffect(() => {
    if (!showImageModal) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        setShowImageModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [showImageModal])

  const handleCopyName = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!currentCard?.name) return
    try {
      await navigator.clipboard.writeText(currentCard.name)
      setCopiedName(true)
      setTimeout(() => setCopiedName(false), 1500)
    } catch (err) {
      console.error('[CardDetailPanel] Failed to copy card name:', err)
    }
  }

  if (!currentCard) {
    return (
      <aside className="w-80 h-full border-r border-border bg-card/30 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs select-none shrink-0">
        <HelpCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="font-medium text-foreground/80">尚未选择卡片</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">
          点击或悬停在卡片搜索列表、或者场上的卡片上，即可在此处查阅超高清卡图与详细效果说明。
        </p>
      </aside>
    )
  }

  const statsLine = formatCardStatsLine(currentCard)
  const seriesLine = formatCardSeriesLine(currentCard)

  return (
    <>
      <aside className="w-80 h-full border-r border-border bg-card/40 flex flex-col shrink-0 overflow-hidden">
        {/* 卡图展示区域 (原生 59:86 卡牌黄金比例，居中高质感渲染) */}
        <div className="pt-3 pb-2.5 px-4 flex flex-col items-center select-none shrink-0">
          <div
            className="group relative cursor-zoom-in rounded-md overflow-hidden shadow-md border border-border/80 bg-black/40"
            onClick={() => setShowImageModal(true)}
            title="点击放大查看卡图"
          >
            <img
              src={getCardImageUrl(currentCard.id)}
              alt={currentCard.name}
              className="w-[200px] h-[291px] object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src !== CARD_BACK_IMAGE) {
                  target.src = CARD_BACK_IMAGE
                }
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-medium backdrop-blur-sm shadow-md">
                <ZoomIn className="w-3.5 h-3.5" />
                <span>点击放大</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* 卡片详情数据区 (游戏王经典结构化排版) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2 select-text">
          {/* 标题横幅: 卡名[卡密] (点击快速复制卡名) */}
          <div
            onClick={handleCopyName}
            className="group relative flex items-center justify-center px-2 py-1 rounded border border-border/70 bg-muted/60 dark:bg-muted/30 shadow-inner text-center cursor-pointer hover:bg-muted/80 transition-colors select-none"
            title="点击快速复制卡名"
          >
            <span className="font-bold text-xs text-foreground truncate">
              {currentCard.name}[{currentCard.id}]
            </span>
            <span className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
              {copiedName ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </span>
          </div>

          {/* 经典蓝色元信息行 */}
          <div className="flex flex-col gap-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 select-text leading-snug">
            {/* 类别与种族/属性行 */}
            <div>{formatCardTypeLine(currentCard)}</div>

            {/* 星级/阶级与攻防行 (仅怪兽) */}
            {statsLine && <div>{statsLine}</div>}

            {/* 系列字段行 (若有) */}
            {seriesLine && <div>{seriesLine}</div>}
          </div>

          {/* 效果描述文本 (支持原生鼠标划选复制，无浮动按钮遮挡) */}
          <div className="pt-1 text-xs text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap select-text cursor-text selection:bg-primary/25">
            {currentCard.desc}
          </div>
        </div>
      </aside>

      {/* 卡图放大查看 Lightbox 弹窗 */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none animate-in fade-in"
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
