import React, { useEffect, useMemo, useState } from 'react'
import { DeckData } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { DeckApplyModal } from './DeckApplyModal'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import {
  Layers,
  Plus,
  FolderOpen,
  Search,
  Tag,
  Swords,
  Edit3,
  Copy,
  Trash2,
  Download,
  Sparkles,
  Clock,
  BookOpen
} from 'lucide-react'
import { cn } from '../../lib/utils'

export const DeckLibraryView: React.FC = () => {
  const {
    deckList,
    selectedTag,
    searchKeyword,
    cardDetails,
    fetchDeckList,
    setSelectedTag,
    setSearchKeyword,
    openDeck,
    createNewDeck,
    deleteDeckFromLibrary,
    duplicateDeckInLibrary,
    importDeckFileToLibrary,
    applyToDuel
  } = useDeckEditorStore()

  // 快捷送入决斗盘模态框
  const [deckToApply, setDeckToApply] = useState<DeckData | null>(null)

  // 初始拉取卡组列表
  useEffect(() => {
    void fetchDeckList()
  }, [fetchDeckList])

  // 聚合当前所有卡组中包含的全部 Tags（去重）
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const d of deckList) {
      if (d.tags && Array.isArray(d.tags)) {
        for (const t of d.tags) {
          const trimmed = t.trim()
          if (trimmed) set.add(trimmed)
        }
      }
    }
    return Array.from(set)
  }, [deckList])

  // 依据搜索关键词与选中的 Tag 进行筛选
  const filteredDecks = useMemo(() => {
    return deckList.filter((deck) => {
      // 1. Tag 过滤
      if (selectedTag) {
        if (!deck.tags || !deck.tags.includes(selectedTag)) {
          return false
        }
      }

      // 2. 关键词模糊过滤 (匹配名称、描述、Tags)
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase()
        const matchName = deck.name.toLowerCase().includes(kw)
        const matchDesc = deck.description?.toLowerCase().includes(kw)
        const matchTag = deck.tags?.some((t) => t.toLowerCase().includes(kw))
        if (!matchName && !matchDesc && !matchTag) {
          return false
        }
      }

      return true
    })
  }, [deckList, selectedTag, searchKeyword])

  // 获取卡组封面卡密
  const getCoverCode = (deck: DeckData): number | undefined => {
    if (deck.coverCard) return deck.coverCard
    if (deck.extra && deck.extra.length > 0) return deck.extra[0]
    if (deck.main && deck.main.length > 0) return deck.main[0]
    return undefined
  }

  // 导出单个卡组为 .ydk
  const handleExportSingle = async (deck: DeckData, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    const res = await window.api.saveDeckFile(deck)
    if (res.success && res.filePath) {
      alert(`卡组已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      alert(`导出失败: ${res.error}`)
    }
  }

  // 复制卡组
  const handleDuplicate = async (deck: DeckData, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (deck.id) {
      await duplicateDeckInLibrary(deck.id)
    }
  }

  // 删除卡组
  const handleDelete = async (deck: DeckData, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!deck.id) return
    if (confirm(`确认删除卡组「${deck.name}」？此操作不可逆。`)) {
      await deleteDeckFromLibrary(deck.id)
    }
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-background text-foreground select-none overflow-hidden font-sans">
      {/* 1. 顶栏导航 */}
      <header className="h-14 px-6 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between shrink-0">
        {/* 左侧：标题与定位 */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground">卡组资产库</h1>
              <Badge variant="secondary" className="text-[11px] font-mono px-1.5 py-0 h-4.5">
                {deckList.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">决斗推演、同人剧情编排与 Combo 展开资产</p>
          </div>
        </div>

        {/* 中间：搜索框 */}
        <div className="relative w-80 max-w-sm">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="搜索卡组名称、剧情描述或标签..."
            className="pl-8.5 h-8 text-xs bg-muted/40 border-border/80 focus-visible:ring-1"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => setSearchKeyword('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>

        {/* 右侧：动作按钮 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void importDeckFileToLibrary()}
            className="h-8 text-xs gap-1.5 font-medium"
          >
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span>导入 YDK</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={createNewDeck}
            className="h-8 text-xs gap-1.5 font-bold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>新建卡组</span>
          </Button>
        </div>
      </header>

      {/* 2. Tag 标签分类筛选横条 */}
      <div className="px-6 py-2.5 bg-muted/20 border-b border-border/60 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground shrink-0 mr-1">
          <Tag className="w-3.5 h-3.5" />
          <span>分类筛选:</span>
        </div>

        {/* 全部按钮 */}
        <button
          type="button"
          onClick={() => setSelectedTag(null)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer',
            selectedTag === null
              ? 'bg-primary text-primary-foreground font-bold shadow-xs'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          全部 ({deckList.length})
        </button>

        {/* 动态 Tags 药丸 */}
        {allTags.map((tag) => {
          const count = deckList.filter((d) => d.tags?.includes(tag)).length
          const isActive = selectedTag === tag
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(isActive ? null : tag)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1',
                isActive
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span>{tag}</span>
              <span className="text-[10px] opacity-75 font-mono">({count})</span>
            </button>
          )
        })}
      </div>

      {/* 3. 卡组卡片网格舞台 */}
      <main className="flex-1 overflow-y-auto p-6 min-h-0 bg-background/50">
        {filteredDecks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDecks.map((deck) => {
              const coverCode = getCoverCode(deck)
              const coverCard = coverCode ? cardDetails[coverCode] : undefined
              const isStoryExtra = deck.extra.length > 15

              return (
                <div
                  key={deck.id || deck.name}
                  onClick={() => void openDeck(deck)}
                  className="group relative flex flex-col rounded-xl bg-card border border-border/70 hover:border-primary/60 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden cursor-pointer"
                >
                  {/* 顶部横幅 / 封面预览区域 */}
                  <div className="h-44 w-full bg-slate-950/80 relative overflow-hidden flex items-center justify-center border-b border-border/40">
                    {/* 卡图立绘 */}
                    <img
                      src={getCardImageUrl(coverCode)}
                      alt={deck.name}
                      onError={(e) => {
                        e.currentTarget.src = CARD_BACK_IMAGE
                      }}
                      className="h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* 突破常规·额外 > 15 特权徽章 */}
                    {isStoryExtra && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-purple-950/90 text-purple-300 border border-purple-500/40 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-xs">
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        <span>{deck.extra.length} 额外·剧情特权</span>
                      </div>
                    )}

                    {/* 封面怪兽名称角标 */}
                    {coverCard && (
                      <div className="absolute bottom-1.5 left-2 max-w-[85%] truncate text-[11px] font-medium text-white/90 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded">
                        王牌: {coverCard.name}
                      </div>
                    )}
                  </div>

                  {/* 卡片详情主体 */}
                  <div className="p-3.5 flex flex-col flex-1 gap-2.5">
                    {/* 名称与时间 */}
                    <div>
                      <h3
                        className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1"
                        title={deck.name}
                      >
                        {deck.name}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>
                          {deck.updatedAt
                            ? new Date(deck.updatedAt).toLocaleDateString()
                            : '未同步'}
                        </span>
                      </div>
                    </div>

                    {/* Tags 标签徽章 */}
                    {deck.tags && deck.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {deck.tags.map((t) => (
                          <span
                            key={t}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTag(t)
                            }}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/80 hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground border border-border/40"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 描述说明 */}
                    <div className="text-xs text-muted-foreground line-clamp-2 min-h-8">
                      {deck.description ? (
                        <span>{deck.description}</span>
                      ) : (
                        <span className="italic text-muted-foreground/60">
                          暂无背景描述或 Combo 说明
                        </span>
                      )}
                    </div>

                    {/* 容量状态条 */}
                    <div className="flex items-center justify-between text-[11px] font-mono font-medium px-2 py-1.5 rounded-md bg-muted/40 border border-border/40 mt-auto">
                      <span className="text-foreground">
                        主 <span className="font-bold">{deck.main.length}</span>
                      </span>
                      <span
                        className={isStoryExtra ? 'text-purple-400 font-bold' : 'text-foreground'}
                      >
                        额外 <span className="font-bold">{deck.extra.length}</span>
                      </span>
                      <span className="text-muted-foreground">
                        副 <span>{deck.side.length}</span>
                      </span>
                    </div>

                    {/* 底部动作工具栏 */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-1.5">
                      {/* 送入决斗盘 */}
                      <Button
                        variant="default"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeckToApply(deck)
                        }}
                        className="h-7 text-xs font-bold gap-1 px-2.5 flex-1"
                        title="将该卡组载入主窗口决斗盘"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>装载对局</span>
                      </Button>

                      {/* 编辑 */}
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          void openDeck(deck)
                        }}
                        className="h-7 text-xs font-semibold gap-1 px-2"
                        title="编辑卡组详情与卡位"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>编辑</span>
                      </Button>

                      {/* 复制 */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => void handleDuplicate(deck, e)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="复制副本"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>

                      {/* 导出 YDK */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => void handleExportSingle(deck, e)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="导出为 .ydk 文件"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>

                      {/* 删除 */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => void handleDelete(deck, e)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="删除卡组"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">没有找到匹配的卡组</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchKeyword || selectedTag
                  ? '尝试切换筛选 Tag 或清除搜索关键词'
                  : '暂无卡组，点击上方按钮新建或导入 YDK 卡组'}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {(searchKeyword || selectedTag) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchKeyword('')
                    setSelectedTag(null)
                  }}
                  className="h-8 text-xs"
                >
                  清除所有筛选
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={createNewDeck}
                className="h-8 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建卡组</span>
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* 4. 独立装载到决斗盘模态框 */}
      {deckToApply && (
        <DeckApplyModal
          deck={deckToApply}
          onClose={() => setDeckToApply(null)}
          onApply={async (player, drawCount) => {
            const ok = await applyToDuel(player, drawCount, deckToApply)
            if (ok) {
              setDeckToApply(null)
            }
          }}
        />
      )}
    </div>
  )
}
