import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Sparkles, X, Plus, Check } from 'lucide-react'
import { CardNote, CdbCard } from '@shared/index'
import { getCardImageUrl, CARD_BACK_IMAGE } from '../../utils/cardImage'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { CardNoteEditor } from '../LeftSidebar/CardNoteEditor'
import { cn } from '../../lib/utils'
import { useBackdropClose } from '../../hooks/useBackdropClose'
import { alertDialog } from '../../stores/useDialogStore'

interface CardNotePickerProps {
  cardCode: number | null
  cardName?: string

  currentDialogue?: string
  onPick: (text: string) => void
  onClose: () => void
}

export const CardNotePicker: React.FC<CardNotePickerProps> = ({
  cardCode,
  cardName,
  currentDialogue,
  onPick,
  onClose
}) => {
  const backdropClose = useBackdropClose(onClose)
  const [code, setCode] = useState<number | null>(cardCode)
  const [name, setName] = useState<string | undefined>(cardName)
  const [chants, setChants] = useState<CardNote[]>([])
  const [loading, setLoading] = useState(Boolean(cardCode))
  const [showEditor, setShowEditor] = useState(false)
  const [showSearch, setShowSearch] = useState(!cardCode)

  const [keyword, setKeyword] = useState('')

  const [resultState, setResultState] = useState<{ kw: string; list: CdbCard[] }>({
    kw: '',
    list: []
  })
  const [searching, setSearching] = useState(false)
  const results = resultState.kw === keyword.trim() ? resultState.list : []

  useEffect(() => {
    if (!code) return
    let cancelled = false
    window.api
      .getCardNotes(code, 'chant')
      .then((list) => {
        if (!cancelled) setChants(list)
      })
      .catch((err) => {
        console.error('[CardNotePicker] 读取召唤词失败:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code])

  useEffect(() => {
    if (!showSearch) return
    const kw = keyword.trim()
    if (!kw) return
    let cancelled = false
    const timer = setTimeout(() => {
      setSearching(true)
      window.api
        .searchCards({ keyword: kw, limit: 20, offset: 0 })
        .then((res) => {
          if (!cancelled) setResultState({ kw, list: res.cards || [] })
        })
        .catch((err) => {
          console.error('[CardNotePicker] 搜索卡牌失败:', err)
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [keyword, showSearch])

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

  const handlePick = useCallback(
    (text: string): void => {
      const existing = (currentDialogue || '').trim()
      onPick(existing ? `${existing}\n${text}` : text)
      onClose()
    },
    [currentDialogue, onPick, onClose]
  )

  const title = useMemo(() => {
    if (showSearch) return '选择卡片'
    return '插入召唤词'
  }, [showSearch])

  return (
    <>
      <div
        onMouseDown={backdropClose.onMouseDown}
        onClick={backdropClose.onClick}
        className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100 select-none"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm">{title}</div>
              {name && <div className="text-[10px] text-muted-foreground truncate">{name}</div>}
            </div>
            {code && !showSearch && (
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                title="换一张卡"
                className="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
              >
                换卡
              </button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {showSearch ? (
            <>
              <div className="px-4 py-2.5 border-b border-border/60 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    autoFocus
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="输入卡名搜索"
                    className="h-8 pl-8 text-xs bg-muted/40"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 min-h-40 max-h-80">
                {searching ? (
                  <p className="text-[11px] text-muted-foreground text-center py-8">搜索中…</p>
                ) : results.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-8">
                    {keyword.trim() ? '没有匹配的卡' : '先搜索卡名'}
                  </p>
                ) : (
                  results.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setCode(card.id)
                        setName(`${card.name} [${card.id}]`)
                        setShowSearch(false)
                        setLoading(true)
                      }}
                      className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-primary/10 transition-colors cursor-pointer text-left"
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
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="p-3 space-y-1.5 max-h-80 overflow-y-auto">
              {loading ? (
                <p className="text-[11px] text-muted-foreground text-center py-6">读取中…</p>
              ) : chants.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-[11px] text-foreground/80">这张卡还没有录入召唤词</p>
                  <p className="text-[10px] text-muted-foreground mt-1 px-4 leading-relaxed">
                    召唤词不在 YGOPro 卡库里（str1~str16 存的是效果触发关键词），
                    需要照卡面手工录入。
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditor(true)}
                    className="mt-3 h-7 text-[11px] gap-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>现在录入</span>
                  </Button>
                </div>
              ) : (
                <>
                  {chants.map((chant) => (
                    <button
                      key={chant.label}
                      type="button"
                      onClick={() => handlePick(chant.text)}
                      className={cn(
                        'w-full text-left rounded-lg border border-border/70 bg-background/50 hover:border-primary/60 hover:bg-primary/5 transition-colors px-2.5 py-2 cursor-pointer group'
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold text-primary/90">
                          {chant.label}
                        </span>
                        <Check className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 ml-auto" />
                      </div>
                      <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-3">
                        {chant.text}
                      </p>
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditor(true)}
                    className="w-full h-7 text-[11px] gap-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>再录一条</span>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditor && code && (
        <CardNoteEditor
          cardName={name || `卡密 ${code}`}
          kind="chant"
          initial={{ label: '', text: '' }}
          existingLabels={chants.map((c) => c.label)}
          onSave={async (label, text) => {
            const res = await window.api.saveCardNote({
              cardCode: code,
              kind: 'chant',
              label,
              text
            })
            if (!res.success) {
              void alertDialog(res.error || '保存失败')
              return false
            }
            setChants(await window.api.getCardNotes(code, 'chant'))
            return true
          }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  )
}
