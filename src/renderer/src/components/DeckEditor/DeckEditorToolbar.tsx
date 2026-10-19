import React from 'react'
import { groupLeafName } from '@shared/index'
import { useDeckEditorStore } from '../../stores/useDeckEditorStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { WindowControls } from '../ui/window-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { FilterDrawer } from '../CardSearch/FilterDrawer'
import { Dices, Download, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export const NONE_GROUP_VALUE = '__none__'

const PanelButton: React.FC<{
  label: string
  title?: string
  emphasize?: boolean
  disabled?: boolean
  onClick?: () => void
}> = ({ label, title, emphasize, disabled, onClick }) => (
  <Button
    type="button"
    variant="outline"
    size="xs"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'w-[58px] shrink-0 px-0 bg-background/70 text-[11px] font-normal text-muted-foreground hover:text-foreground',
      emphasize && 'font-semibold text-foreground'
    )}
  >
    {label}
  </Button>
)

const MiniButton: React.FC<{
  icon: LucideIcon
  label: string
  title?: string
  emphasize?: boolean
  disabled?: boolean
  onClick?: () => void
}> = ({ icon: Icon, label, title, emphasize, disabled, onClick }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-background/60 px-0.5 text-[10px] leading-none text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground cursor-pointer disabled:pointer-events-none disabled:opacity-40',
      emphasize &&
        'border-primary/50 bg-primary/10 text-primary font-semibold hover:bg-primary/20 hover:text-primary'
    )}
  >
    <Icon className="w-3 h-3 shrink-0" />
    <span className="max-w-full truncate">{label}</span>
  </button>
)

interface DeckEditorToolbarProps {
  browsedCategory: string
  onBrowseCategory: (value: string | null) => void
  saveToast: string | null
  onLeaveEditor: () => void
  onManageDecks: () => void
  onSave: () => void
  onExportYdk: () => void
  onClear: () => void
  onDelete: () => void
}

export const DeckEditorToolbar: React.FC<DeckEditorToolbarProps> = ({
  browsedCategory,
  onBrowseCategory,
  saveToast,
  onLeaveEditor,
  onManageDecks,
  onSave,
  onExportYdk,
  onClear,
  onDelete
}) => {
  const { deck, deckGroups, returnToMain, drawTestHand, shuffleDeck, sortDeck, setDeckName, setDeckDescription } =
    useDeckEditorStore()

  return (
    <div className="relative shrink-0 bg-card border-b border-border px-3 py-2 flex items-stretch gap-2 [-webkit-app-region:drag]">
      <div className="flex flex-col gap-1 w-[124px] shrink-0 [-webkit-app-region:no-drag]">
        <button
          type="button"
          onClick={onLeaveEditor}
          title={returnToMain ? '返回主界面' : '返回卡组总览库'}
          className="flex-1 min-h-0 rounded-md border border-border bg-muted/40 text-sm font-bold text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
        >
          退出编辑
        </button>
        <div className="grid grid-cols-1 gap-1 h-16 shrink-0">
          <MiniButton
            icon={Download}
            label="导出 YDK"
            title="导出卡组为标准 .ydk 文件"
            onClick={onExportYdk}
          />
          <MiniButton
            icon={Dices}
            label="手牌测试"
            title="模拟起手随机抽取 5 张手牌"
            onClick={drawTestHand}
            disabled={deck.main.length === 0}
          />
        </div>
      </div>

      <div className="w-[430px] shrink-0 rounded-md border border-border bg-muted/20 p-2 flex flex-col gap-1 justify-between [-webkit-app-region:no-drag]">
        <div className="flex items-center gap-1.5">
          <span className="w-14 shrink-0 text-[11px] text-muted-foreground">卡组分类：</span>
          <Select value={browsedCategory} onValueChange={onBrowseCategory}>
            <SelectTrigger size="sm" className="h-6 flex-1 min-w-0 bg-background/70 text-xs">
              <SelectValue>
                {browsedCategory === NONE_GROUP_VALUE
                  ? '未分组'
                  : browsedCategory.split('/').map(groupLeafName).join(' / ')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start" className="max-h-72">
              <SelectItem value={NONE_GROUP_VALUE}>未分组</SelectItem>
              {deckGroups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g.split('/').map(groupLeafName).join(' / ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PanelButton label="管理" title="打开卡组库管理分组与卡组" onClick={onManageDecks} />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-14 shrink-0 text-[11px] text-muted-foreground">卡组名称：</span>
          <Input
            type="text"
            value={deck.name}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="输入卡组名称"
            className="h-6 flex-1 min-w-0 bg-background/70 text-xs"
          />
          <PanelButton label="保存" title="保存当前卡组到卡组库" emphasize onClick={onSave} />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-14 shrink-0 text-[11px] text-muted-foreground">描述：</span>
          <Input
            type="text"
            value={deck.description || ''}
            onChange={(e) => setDeckDescription(e.target.value)}
            placeholder="描述"
            className="h-6.5 flex-1 min-w-0 bg-background/60 border-border/60 text-[11.5px]"
          />
          {saveToast && (
            <span className="text-[11px] font-bold text-emerald-500 animate-in fade-in duration-150 shrink-0">
              {saveToast}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <PanelButton
            label="打乱"
            title="随机打乱主卡组顺序"
            onClick={shuffleDeck}
            disabled={deck.main.length === 0}
          />
          <PanelButton
            label="排序"
            title="卡组智能排序 (怪兽/魔陷/星级/攻击力)"
            onClick={sortDeck}
            disabled={deck.main.length === 0 && deck.extra.length === 0}
          />
          <PanelButton label="清空" title="清空正在编辑的卡组" onClick={onClear} />
          <div className="flex-1" />
          <PanelButton
            label="删除"
            title="从卡组库删除当前卡组"
            onClick={onDelete}
            disabled={!deck.id}
          />
        </div>
      </div>

      <FilterDrawer
        variant="band"
        className="flex-1 min-w-0"
        headerSlot={<WindowControls size="sm" actions={['maximize']} className="-mr-1" />}
      />
    </div>
  )
}
