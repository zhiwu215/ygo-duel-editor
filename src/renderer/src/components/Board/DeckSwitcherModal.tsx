import React, { useEffect, useMemo, useState } from 'react'
import { DeckData } from '@shared/index'
import { useDeckSwitcherStore } from '../../stores/useDeckSwitcherStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { ArrowLeftRight, X, Search, Layers } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

/**
 * 主卡组「切换卡组」弹窗。
 * 由决斗盘主卡组格的右键菜单唤起（卡组为空时右键格子同样可唤起），
 * 从卡组库里挑一副卡组整体载入到该控制者 —— 清空其主卡组与额外卡组后重建，
 * 并可按「载入手牌」决定是否顺带模拟起手抽 5 张。
 *
 * 遮罩与 PileListModal 一致，锚定在 DuelBoard 中央战场容器内，
 * 左右两侧的卡片详情 / 检索面板保持清晰可读。
 */
export const DeckSwitcherModal: React.FC = () => {
  const controller = useDeckSwitcherStore((s) => s.controller)

  if (controller === null) return null

  return <DeckSwitcherContent key={controller} controller={controller} />
}

const DeckSwitcherContent: React.FC<{ controller: 0 | 1 }> = ({ controller }) => {
  const closeDeckSwitcher = useDeckSwitcherStore((s) => s.closeDeckSwitcher)
  const applyDeckToPlayer = useDuelStore((s) => s.applyDeckToPlayer)

  const [decks, setDecks] = useState<DeckData[]>([])
  // 初值 true：挂载即取一次卡组库，取回前显示加载中（由 promise 收尾置 false）。
  // 不在 effect 体内同步 setState，避免触发 cascading renders。
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [query, setQuery] = useState<string>('')
  // 「载入手牌」的选择记忆在全局配置里 (AppConfig.deckLoadDrawCount)，
  // 关掉软件重启后仍保持上次的选择。未设置过时按「无」处理。
  const drawCount: 0 | 5 = useConfigStore((s) => (s.config.deckLoadDrawCount === 5 ? 5 : 0))
  const setDeckLoadDrawCount = useConfigStore((s) => s.setDeckLoadDrawCount)

  useEffect(() => {
    let cancelled = false
    window.api
      .getDeckList()
      .then((list) => {
        if (!cancelled) setDecks(list)
      })
      .catch(() => {
        if (!cancelled) setDecks([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeDeckSwitcher()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeDeckSwitcher])

  const filteredDecks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return decks
    return decks.filter((d) =>
      [d.name, d.group, ...(d.tags || [])].filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }, [decks, query])

  const handleApply = (deck: DeckData): void => {
    applyDeckToPlayer(controller, deck, drawCount)
    closeDeckSwitcher()
  }

  const ctrlLabel = controller === 0 ? '我方' : '对方'

  return (
    <div
      className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in"
      onClick={closeDeckSwitcher}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[92%] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-blue-500" />
            <h2 className="font-bold text-sm tracking-tight">切换卡组</h2>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full border text-[10px] font-bold leading-none',
                controller === 0
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/40'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40'
              )}
            >
              {ctrlLabel}主卡组
            </span>
          </div>

          <button
            type="button"
            onClick={closeDeckSwitcher}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
            title="关闭 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 工具条：载入手牌 + 卡组库搜索 */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>载入手牌</span>
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              {([0, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => void setDeckLoadDrawCount(n)}
                  className={cn(
                    'px-2.5 py-0.5 text-[11px] transition-colors cursor-pointer',
                    drawCount === n
                      ? 'bg-primary/15 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {n === 0 ? '无' : '抽 5'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索卡组名 / 分组 / 标签..."
              className="h-7 text-xs pl-8 pr-2"
            />
          </div>
        </div>

        {/* 卡组库列表 */}
        <div className="flex-1 min-h-[240px] overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-12 text-center">正在读取卡组库...</p>
          ) : filteredDecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Layers className="w-9 h-9 opacity-25 stroke-[1.5]" />
              <p className="text-xs">
                {decks.length === 0
                  ? '卡组库还是空的 —— 先在「卡组」窗口里创建并保存一副卡组吧'
                  : '没有匹配的卡组'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
              {filteredDecks.map((deck) => {
                const cover = deck.coverCard || deck.extra[0] || deck.main[0]
                return (
                  <button
                    key={deck.id || deck.name}
                    type="button"
                    onClick={() => handleApply(deck)}
                    className="flex items-center gap-2.5 p-2 rounded-lg border border-border/70 hover:border-blue-500/70 hover:bg-blue-500/[0.06] text-left transition-colors cursor-pointer"
                  >
                    <img
                      src={getCardImageUrl(cover, true)}
                      alt={deck.name}
                      className="w-8 h-[46px] object-cover rounded shrink-0 border border-border/60"
                      onError={(e) => {
                        const el = e.currentTarget
                        if (el.src !== CARD_BACK_IMAGE) el.src = CARD_BACK_IMAGE
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate" title={deck.name}>
                        {deck.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        主 {deck.main.length} / 额外 {deck.extra.length}
                      </p>
                      {(deck.group || (deck.tags && deck.tags.length > 0)) && (
                        <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                          {[deck.group, ...(deck.tags || [])].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
          <Button size="sm" onClick={closeDeckSwitcher} className="px-5 h-7 text-xs">
            取消
          </Button>
        </div>
      </div>
    </div>
  )
}
