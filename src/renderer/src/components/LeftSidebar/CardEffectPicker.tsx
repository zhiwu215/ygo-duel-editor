import React, { useEffect, useMemo, useState } from 'react'
import { CdbCard, splitCardEffectText } from '@shared/index'
import { ArrowLeft, Check, Loader2, Search } from 'lucide-react'
import { useDuelStore } from '../../stores/useDuelStore'
import { CardRowItem } from '../CardSearch/CardRowItem'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

interface CardEffectPickerProps {
  onClose: () => void
  onInsert: (text: string) => void
}

export const CardEffectPicker: React.FC<CardEffectPickerProps> = ({ onClose, onInsert }) => {
  const state = useDuelStore((s) => s.state)
  const [cards, setCards] = useState<CdbCard[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedCard, setSelectedCard] = useState<CdbCard | null>(null)
  const [selectedSegments, setSelectedSegments] = useState<Set<number>>(() => new Set())

  const codes = useMemo(() => {
    const unique = new Set<number>()
    for (const card of state.cards || []) {
      if (card.code) unique.add(card.code)
    }
    for (const step of state.steps || []) {
      if (step.cardCode) unique.add(step.cardCode)
    }
    return [...unique]
  }, [state.cards, state.steps])

  useEffect(() => {
    let cancelled = false
    window.api
      .getCardsByIds(codes)
      .then((dict) => {
        if (cancelled) return
        setCards(codes.map((code) => dict[code]).filter((card): card is CdbCard => Boolean(card)))
      })
      .catch(() => {
        if (!cancelled) setCards([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [codes])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return cards
    return cards.filter(
      (card) => card.name.toLowerCase().includes(keyword) || String(card.id).includes(keyword)
    )
  }, [cards, query])

  const segments = useMemo(
    () => (selectedCard ? splitCardEffectText(selectedCard.desc) : []),
    [selectedCard]
  )

  const handleInsert = (text: string): void => {
    onInsert(text)
    onClose()
  }

  const handleInsertSelected = (): void => {
    const text = segments.filter((_, index) => selectedSegments.has(index)).join('\n')
    if (text) handleInsert(text)
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[440px] p-0" showCloseButton>
        <DialogHeader className="border-b border-border/60 px-4 py-3">
          <DialogTitle className="text-sm">插入卡片效果文本</DialogTitle>
        </DialogHeader>

        {!selectedCard ? (
          <div className="flex flex-col gap-2 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索这场决斗中的卡"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  读取卡片…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">没有可插入的卡</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filtered.map((card) => (
                    <CardRowItem
                      key={card.id}
                      card={card}
                      compact
                      onRowClick={() => {
                        setSelectedCard(card)
                        setSelectedSegments(new Set())
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
              <button
                type="button"
                onClick={() => setSelectedCard(null)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                {selectedCard.name}
              </span>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {segments.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">无效果文本</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {segments.map((segment, index) => {
                    const checked = selectedSegments.has(index)
                    return (
                      <div
                        key={`${index}-${segment.slice(0, 12)}`}
                        onClick={() => handleInsert(segment)}
                        className={cn(
                          'flex cursor-pointer items-start gap-2 rounded border px-2 py-1.5 text-[11px] leading-relaxed transition-colors',
                          checked
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border/50 hover:bg-muted/40'
                        )}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedSegments((previous) => {
                              const next = new Set(previous)
                              if (next.has(index)) next.delete(index)
                              else next.add(index)
                              return next
                            })
                          }}
                          className={cn(
                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border'
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </button>
                        <span className="whitespace-pre-wrap">{segment}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-border/60 px-3 py-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={selectedSegments.size === 0}
                onClick={handleInsertSelected}
              >
                插入选中（{selectedSegments.size}）
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
