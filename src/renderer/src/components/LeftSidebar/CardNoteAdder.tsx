import { ScrollArea } from '../ui/scroll-area'
import React, { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { CardNoteKind, CdbCard } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { CardRowItem } from '../CardSearch/CardRowItem'
import { CardNoteEditor } from './CardNoteEditor'

interface CardNoteAdderProps {
  onSave: (
    cardCode: number,
    kind: CardNoteKind,
    label: string,
    text: string,
    source?: string
  ) => Promise<boolean>

  existingLabelsFor: (cardCode: number, kind: CardNoteKind) => string[]
  onClose: () => void
}

export const CardNoteAdder: React.FC<CardNoteAdderProps> = ({
  onSave,
  existingLabelsFor,
  onClose
}) => {
  const [keyword, setKeyword] = useState('')

  const [resultState, setResultState] = useState<{ kw: string; list: CdbCard[] }>({
    kw: '',
    list: []
  })
  const [searching, setSearching] = useState(false)
  const results = resultState.kw === keyword.trim() ? resultState.list : []
  const [picked, setPicked] = useState<CdbCard | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const kw = keyword.trim()
    if (!kw) return
    let cancelled = false
    const timer = setTimeout(() => {
      setSearching(true)
      window.api
        .searchCards({ keyword: kw, limit: 24, offset: 0 })
        .then((res) => {
          if (!cancelled) setResultState({ kw, list: res.cards || [] })
        })
        .catch((err) => {
          console.error('[CardNoteAdder] 搜索卡牌失败:', err)
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [keyword])

  if (picked) {
    return (
      <CardNoteEditor
        cardName={`${picked.name} [${picked.id}]`}
        kind="chant"
        initial={{ label: '', text: '' }}
        kindEditable
        existingLabelsForKind={(k) => existingLabelsFor(picked.id, k)}
        onSave={(label, text, k, source) =>
          onSave(picked.id, k, label, text, source).then((ok) => {
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
              placeholder="输入卡名、卡密搜索"
              className="h-8 pl-8 text-xs bg-muted/40"
            />
          </div>
        </div>

        <ScrollArea className="h-72">
          <div className="p-2 space-y-1">
            {searching ? (
              <p className="text-[11px] text-muted-foreground text-center py-8">搜索中…</p>
            ) : results.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <p className="text-[11px] text-muted-foreground">
                  {keyword.trim() ? '没有匹配的卡' : '先在上方搜索卡名'}
                </p>
              </div>
            ) : (
              results.map((card) => (
                <CardRowItem key={card.id} card={card} compact onRowClick={() => setPicked(card)} />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
