import React, { useState } from 'react'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { DeckDetailCard } from './DeckDetailCard'
import { DeckGrid } from './DeckGrid'
import { DeckStatsBar } from './DeckStatsBar'
import { DeckSearchPanel } from './DeckSearchPanel'
import { DeckTestHandModal } from './DeckTestHandModal'
import { DeckApplyModal } from './DeckApplyModal'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import {
  SquareStack,
  FolderOpen,
  Save,
  ArrowUpDown,
  Dices,
  Swords,
  Trash2,
  FilePlus2
} from 'lucide-react'

export const DeckEditorApp: React.FC = () => {
  const {
    deck,
    cardDetails,
    selectedCard,
    testHandCards,
    setSelectedCard,
    setDeckName,
    addCard,
    removeCard,
    clearDeck,
    sortDeck,
    drawTestHand,
    closeTestHand,
    saveDeckFile,
    importDeckFile,
    applyToDuel,
    getStats
  } = useDeckEditorStore()

  const [showApplyModal, setShowApplyModal] = useState<boolean>(false)

  const stats = getStats()

  const handleSave = async (): Promise<void> => {
    const res = await saveDeckFile()
    if (res.success && res.filePath) {
      alert(`卡组已成功保存：\n${res.filePath}`)
    } else if (res.error) {
      alert(`保存失败: ${res.error}`)
    }
  }

  const handleImport = async (): Promise<void> => {
    const ok = await importDeckFile()
    if (!ok) {
      // 用户取消
    }
  }

  const handleClear = (): void => {
    if (deck.main.length > 0 || deck.extra.length > 0 || deck.side.length > 0) {
      if (confirm('确认清空当前编辑的卡组？')) {
        clearDeck()
      }
    }
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-background text-foreground select-none overflow-hidden font-sans">
      {/* 1. 顶部操作工具栏 (严禁 emoji，使用标准 Lucide 图标) */}
      <header className="h-11 px-3 border-b border-border bg-card flex items-center justify-between shrink-0">
        {/* 左侧：卡组图标与卡组名称行内编辑 */}
        <div className="flex items-center gap-2">
          <SquareStack className="w-4 h-4 text-primary" />
          <Input
            type="text"
            value={deck.name}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="卡组名称"
            className="h-7 w-48 text-xs font-bold bg-background/70 border-border/70"
            title="点击修改卡组名称"
          />
        </div>

        {/* 右侧：动作按钮组 */}
        <div className="flex items-center gap-1.5">
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
            onClick={handleImport}
            title="导入外部 .ydk 卡组文件"
            className="h-7 px-2 gap-1 text-xs"
          >
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span>导入 YDK</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={handleSave}
            title="保存卡组为标准 .ydk 文件"
            className="h-7 px-2 gap-1 text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5 text-muted-foreground" />
            <span>保存</span>
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
        </div>
      </header>

      {/* 2. MDPro3 风格三栏主舞台 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 左栏：卡片大图与详细效果展示 */}
        <DeckDetailCard card={selectedCard} />

        {/* 中栏：卡组统计条 + 卡片矩阵网格 */}
        <main className="flex-1 flex flex-col p-2.5 gap-2.5 min-w-0 min-h-0 bg-background/50">
          <DeckStatsBar stats={stats} />
          <DeckGrid
            deck={deck}
            cardDetails={cardDetails}
            onSelectCard={setSelectedCard}
            onRemoveCard={removeCard}
          />
        </main>

        {/* 右栏：卡片检索列表与 ⭐ 收藏夹 */}
        <DeckSearchPanel onSelectCard={setSelectedCard} onAddCard={(card) => addCard(card)} />
      </div>

      {/* 3. 模态弹窗 */}
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
          deckName={deck.name}
          mainCount={deck.main.length}
          extraCount={deck.extra.length}
          onConfirm={async (player, drawCount) => {
            return applyToDuel(player, drawCount)
          }}
          onClose={() => setShowApplyModal(false)}
        />
      )}
    </div>
  )
}
