import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { CardNoteKind, CdbCard } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { CardRowItem } from '../CardSearch/CardRowItem'
import { CardNoteEditor } from './CardNoteEditor'
import { useCardPickerSearch } from '../../hooks/useCardPickerSearch'

interface CardNoteAdderProps {
  onSave: (
    cardCode: number,
    kind: CardNoteKind,
    title: string,
    text: string,
    source?: string
  ) => Promise<boolean>

  existingTitlesFor: (cardCode: number, kind: CardNoteKind) => string[]
  onClose: () => void
}

export const CardNoteAdder: React.FC<CardNoteAdderProps> = ({
  onSave,
  existingTitlesFor,
  onClose
}) => {
  const { keyword, setKeyword, results, searching, loadingMore, hasSearched, loadMore } =
    useCardPickerSearch()
  const [picked, setPicked] = useState<CdbCard | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const handleScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 240) void loadMore()
  }

  if (picked) {
    return (
      <CardNoteEditor
        cardName={`${picked.name} [${picked.id}]`}
        kind="chant"
        initial={{ title: '', text: '' }}
        kindEditable
        existingTitlesForKind={(k) => existingTitlesFor(picked.id, k)}
        onSave={(title, text, k, source) =>
          onSave(picked.id, k, title, text, source).then((ok) => {
            if (ok) onClose()
            return ok
          })
        }
        onClose={() => setPicked(null)}
      />
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-100 ring-0 sm:max-w-lg"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border/60 px-4 py-3 shrink-0">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-sm font-bold">选择卡片</DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="px-4 py-2.5 border-b border-border/60 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchRef}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索卡名、卡密、描述、系列"
              className="h-8 pl-8 text-xs bg-muted/40"
            />
          </div>
          <p className="mt-1.5 px-0.5 text-[10px] leading-tight text-muted-foreground/75">
            空格同时匹配、引号短语、-排除、$仅卡名、@系列
          </p>
        </div>

        <div className="h-72 overflow-y-auto" onScroll={handleScroll}>
          <div className="p-2 space-y-1">
            {searching ? (
              <p className="text-[11px] text-muted-foreground text-center py-8">搜索中…</p>
            ) : results.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <p className="text-[11px] text-muted-foreground">
                  {!keyword.trim() ? '先在上方搜索卡牌' : hasSearched ? '没有匹配的卡' : '搜索中…'}
                </p>
              </div>
            ) : (
              <>
                {results.map((card) => (
                  <CardRowItem
                    key={card.id}
                    card={card}
                    compact
                    onRowClick={() => setPicked(card)}
                  />
                ))}
                {loadingMore && (
                  <div className="py-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>加载更多卡片...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
