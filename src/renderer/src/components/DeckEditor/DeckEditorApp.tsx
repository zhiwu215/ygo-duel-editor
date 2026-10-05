import React, { useState } from 'react'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { DeckLibraryView } from './DeckLibraryView'
import { DeckDetailCard } from './DeckDetailCard'
import { DeckGrid } from './DeckGrid'
import { DeckStatsBar } from './DeckStatsBar'
import { DeckSearchPanel } from './DeckSearchPanel'
import { DeckTestHandModal } from './DeckTestHandModal'
import { DeckApplyModal } from './DeckApplyModal'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { WindowControls } from '../ui/window-controls'
import {
  ArrowLeft,
  Folder,
  Save,
  ArrowUpDown,
  Dices,
  Swords,
  Trash2,
  FilePlus2,
  Download,
  Tag,
  FileText,
  Plus,
  X
} from 'lucide-react'

export const DeckEditorApp: React.FC = () => {
  const {
    viewMode,
    deck,
    cardDetails,
    selectedCard,
    testHandCards,
    deckGroups,
    setSelectedCard,
    setDeckName,
    setDeckDescription,
    setDeckGroup,
    addDeckTag,
    removeDeckTag,
    setDeckCover,
    addCard,
    removeCard,
    moveCard,
    clearDeck,
    sortDeck,
    drawTestHand,
    closeTestHand,
    saveDeckFile,
    saveCurrentDeckToLibrary,
    backToLibrary,
    applyToDuel,
    getStats
  } = useDeckEditorStore()

  const [showApplyModal, setShowApplyModal] = useState<boolean>(false)
  const [newTagInput, setNewTagInput] = useState<string>('')
  const [saveToast, setSaveToast] = useState<string | null>(null)

  // 1. 若当前为卡组资产库视图，渲染总览卡组库
  if (viewMode === 'library') {
    return <DeckLibraryView />
  }

  // 2. 当前为卡组三栏编辑台
  const stats = getStats()

  // 保存到本地卡组库
  const handleSaveToLibrary = async (): Promise<void> => {
    const ok = await saveCurrentDeckToLibrary()
    if (ok) {
      setSaveToast('卡组已成功保存到资产库')
      setTimeout(() => setSaveToast(null), 2000)
    } else {
      alert('保存到卡组库失败')
    }
  }

  // 导出为 .ydk
  const handleExportYdk = async (): Promise<void> => {
    const res = await saveDeckFile()
    if (res.success && res.filePath) {
      alert(`卡组已成功导出：\n${res.filePath}`)
    } else if (res.error) {
      alert(`导出失败: ${res.error}`)
    }
  }

  // 清空
  const handleClear = (): void => {
    if (deck.main.length > 0 || deck.extra.length > 0 || deck.side.length > 0) {
      if (confirm('确认清空当前卡组的所有卡片？')) {
        clearDeck()
      }
    }
  }

  // 添加 Tag
  const handleAddTag = (): void => {
    if (newTagInput.trim()) {
      addDeckTag(newTagInput.trim())
      setNewTagInput('')
    }
  }

  // 切换封面
  const handleToggleCover = (): void => {
    if (!selectedCard) return
    if (deck.coverCard === selectedCard.id) {
      setDeckCover(undefined)
    } else {
      setDeckCover(selectedCard.id)
    }
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-background text-foreground select-none overflow-hidden font-sans">
      {/* 1. 顶部操作工具栏 (无 emoji，纯 Lucide 矢量图标)；整行兼作无边框窗口的标题栏 */}
      <header className="h-11 px-3 border-b border-border bg-card flex items-center justify-between shrink-0 [-webkit-app-region:drag]">
        {/* 左侧：返回卡组库与卡组名称 */}
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void backToLibrary()}
            className="h-7 px-2 gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            title="返回卡组总览库"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回卡组库</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Input
            type="text"
            value={deck.name}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="卡组名称"
            className="h-7 w-52 text-xs font-bold bg-background/80 border-border/80"
            title="点击修改卡组名称"
          />

          {saveToast && (
            <span className="text-[11px] font-bold text-emerald-500 animate-in fade-in duration-150">
              {saveToast}
            </span>
          )}
        </div>

        {/* 右侧：动作按钮组 */}
        <div className="flex items-center gap-1.5 [-webkit-app-region:no-drag]">
          <Button
            variant="default"
            size="xs"
            onClick={() => void handleSaveToLibrary()}
            title="保存卡组修改至本地卡组资产库"
            className="h-7 px-2.5 gap-1 text-xs font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存到库</span>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={clearDeck}
            title="新建空白卡组"
            className="h-7 px-2 gap-1 text-xs"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>新建</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => void handleExportYdk()}
            title="导出卡组为标准 .ydk 文件"
            className="h-7 px-2 gap-1 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>导出 YDK</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Button
            variant="ghost"
            size="xs"
            onClick={sortDeck}
            disabled={deck.main.length === 0 && deck.extra.length === 0}
            title="卡组智能排序 (怪兽/魔陷/星级/攻击力)"
            className="h-7 px-2 gap-1 text-xs"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            <span>排序</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={drawTestHand}
            disabled={deck.main.length === 0}
            title="模拟起手随机抽取 5 张手牌"
            className="h-7 px-2.5 gap-1 text-xs font-semibold"
          >
            <Dices className="w-3.5 h-3.5 text-primary" />
            <span>手牌测试</span>
          </Button>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* 送入决斗盘核心联动按钮 */}
          <Button
            variant="default"
            size="xs"
            onClick={() => setShowApplyModal(true)}
            disabled={deck.main.length === 0 && deck.extra.length === 0}
            title="将当前卡组直接装载到主界面的决斗盘中"
            className="h-7 px-3 gap-1.5 text-xs font-bold shadow-xs"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>送入决斗盘</span>
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleClear}
            title="清空当前卡组"
            className="h-7 w-7 text-muted-foreground hover:text-destructive ml-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>

          {/* 无边框窗口自绘控件 (用 -mr-3 抵消 header 的 px-3，使按钮贴齐窗口右缘) */}
          <WindowControls className="-mr-3 ml-0.5" />
        </div>
      </header>

      {/* 2. 创作元数据横条 (描述说明、分类标签管理、封面设定) */}
      <div className="px-3 py-1.5 bg-muted/30 border-b border-border/70 flex items-center justify-between gap-3 text-xs shrink-0">
        {/* 描述编辑 */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            type="text"
            value={deck.description || ''}
            onChange={(e) => setDeckDescription(e.target.value)}
            placeholder="输入卡组描述、同人剧情背景或 Combo 做场要点..."
            className="h-6.5 text-[11.5px] bg-background/60 border-border/60 flex-1 min-w-0"
          />
        </div>

        <Separator orientation="vertical" className="h-4" />

        <div className="flex items-center gap-1.5 shrink-0">
          <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {/* 用原生 datalist 把已存在的分组变成可选项：既能下拉挑，也能手打新名字。
              存盘时 deckService 会把新名字自动补进分组列表。 */}
          <datalist id="deck-group-options">
            {deckGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <Input
            type="text"
            list="deck-group-options"
            value={deck.group || ''}
            onChange={(e) => setDeckGroup(e.target.value)}
            placeholder="剧情分组"
            className="h-6.5 w-28 text-[11.5px] bg-background/60 border-border/60"
            title="所属剧情分组：可从已有分组下拉选择，也可直接输入新名字（保存时自动创建）"
          />
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* 分类 Tags 管理 */}
        <div className="flex items-center gap-1.5 shrink-0 max-w-[420px] overflow-x-auto scrollbar-none">
          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

          {deck.tags &&
            deck.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-muted/80 text-foreground border border-border/60 shrink-0"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => removeDeckTag(tag)}
                  className="text-muted-foreground hover:text-destructive cursor-pointer"
                  title="移除标签"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}

          <div className="flex items-center gap-1">
            <Input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              placeholder="+ 标签回车"
              className="h-6 w-20 text-[11px] bg-background/60 border-border/60 px-1.5"
            />
            {newTagInput && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleAddTag}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3. MDPro3 风格三栏主舞台 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 左栏：卡片大图与详细效果展示 + 设为封面 */}
        <DeckDetailCard
          card={selectedCard}
          isCover={selectedCard ? deck.coverCard === selectedCard.id : false}
          onToggleCover={handleToggleCover}
        />

        {/* 中栏：卡组统计条 + 卡片矩阵网格 (无死锁限制，允许自由创作) */}
        <main className="flex-1 flex flex-col p-2.5 gap-2.5 min-w-0 min-h-0 bg-background/50">
          <DeckStatsBar stats={stats} />
          <DeckGrid
            deck={deck}
            cardDetails={cardDetails}
            onSelectCard={setSelectedCard}
            onRemoveCard={removeCard}
            onMoveCard={moveCard}
          />
        </main>

        {/* 右栏：卡片检索列表与 ⭐ 收藏夹 */}
        <DeckSearchPanel onSelectCard={setSelectedCard} onAddCard={(card) => addCard(card)} />
      </div>

      {/* 4. 模态弹窗 */}
      {testHandCards && (
        <DeckTestHandModal
          cards={testHandCards}
          cardDetails={cardDetails}
          onRedraw={drawTestHand}
          onClose={closeTestHand}
        />
      )}

      {showApplyModal && (
        <DeckApplyModal
          deck={deck}
          onConfirm={async (player, drawCount) => {
            return applyToDuel(player, drawCount)
          }}
          onClose={() => setShowApplyModal(false)}
        />
      )}
    </div>
  )
}
