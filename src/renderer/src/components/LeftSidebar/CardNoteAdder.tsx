import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, BookMarked, X, Plus } from 'lucide-react'
import { CardNoteKind, CdbCard } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { CardNoteEditor } from './CardNoteEditor'

interface CardNoteAdderProps {
  onSave: (cardCode: number, kind: CardNoteKind, label: string, text: string) => Promise<boolean>

  existingLabelsFor: (cardCode: number, kind: CardNoteKind) => string[]
  onClose: () => void
}

export const CardNoteAdder: React.FC<CardNoteAdderProps> = ({
  onSave,
  existingLabelsFor,
  onClose
}) => {
  const [kind, setKind] = useState<CardNoteKind>('chant')
  const [keyword, setKeyword] = useState('')

  const [resultState, setResultState] = useState<{ kw: string; list: CdbCard[] }>({
    kw: '',
    list: []
  })
  const [searching, setSearching] = useState(false)
  const results = resultState.kw === keyword.trim() ? resultState.list : []
  const [picked, setPicked] = useState<CdbCard | null>(null)
  const [manualCode, setManualCode] = useState<string>('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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

  const manualValid = useMemo(() => {
    const n = Number(manualCode.trim())
    return Number.isFinite(n) && n > 0
  }, [manualCode])

  if (picked) {
    return (
      <CardNoteEditor
        cardName={`${picked.name} [${picked.id}]`}
        kind={kind}
        initial={{ label: '', text: '' }}
        existingLabels={existingLabelsFor(picked.id, kind)}
        onSave={(label, text) => onSave(picked.id, kind, label, text)}
        onClose={() => setPicked(null)}
      />
    )
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0">
          <BookMarked className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">选择卡片</div>
            <div className="text-[10px] text-muted-foreground">
              召唤词与卡面描述都不在卡库里，先找到那张卡
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {}
        <div className="px-4 py-2.5 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
            <span>记录类型</span>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-md border border-border bg-muted/50">
            {[
              { k: 'chant' as CardNoteKind, label: '召唤词' },
              { k: 'note' as CardNoteKind, label: '描述' }
            ].map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setKind(opt.k)}
                className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  kind === opt.k
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-border/60 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchRef}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入卡名搜索，如「银河眼」「黑魔导」"
              className="h-8 pl-8 text-xs bg-muted/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-40 max-h-96">
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
              <button
                key={card.id}
                type="button"
                onClick={() => setPicked(card)}
                className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-primary/8 transition-colors cursor-pointer text-left"
              >
                <img
                  src={getCardImageUrl(card.id, true)}
                  alt={card.name}
                  className="w-7 h-10 object-cover rounded-sm shrink-0 border border-border/60"
                  onError={(e) => {
                    const el = e.currentTarget
                    if (el.src !== CARD_BACK_IMAGE) el.src = CARD_BACK_IMAGE
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-foreground truncate">
                    {card.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{card.id}</div>
                </div>
                <Plus className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-border/60 shrink-0 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0">找不到？直接输卡密</span>
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="8 位卡密"
            className="h-7 flex-1 text-[11px] bg-muted/40 font-mono"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!manualValid}
            onClick={() => setPicked({ id: Number(manualCode.trim()) } as CdbCard)}
            className="h-7 text-[11px] shrink-0"
          >
            下一步
          </Button>
        </div>
      </div>
    </div>
  )
}
