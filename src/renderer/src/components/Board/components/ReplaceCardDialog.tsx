import React, { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import {
  EngineCardEditTarget,
  useEngineCardEditStore
} from '../../../stores/useEngineCardEditStore'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { CdbCard } from '@shared/index'
import { searchCardsByQuery } from '../../../utils/cardSearch'
import { ArrowLeftRight, Loader2, Search } from 'lucide-react'

export const ReplaceCardDialog: React.FC = () => {
  const replaceTarget = useEngineCardEditStore((s) => s.replaceTarget)
  const closeReplace = useEngineCardEditStore((s) => s.closeReplace)

  return (
    <Dialog open={Boolean(replaceTarget)} onOpenChange={(open) => !open && closeReplace()}>
      <DialogContent className="max-w-lg">
        {replaceTarget && <ReplaceCardForm target={replaceTarget} onClose={closeReplace} />}
      </DialogContent>
    </Dialog>
  )
}

const ReplaceCardForm: React.FC<{
  target: EngineCardEditTarget
  onClose: () => void
}> = ({ target, onClose }) => {
  const loading = useDuelEngineStore((s) => s.loading)
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<CdbCard[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const doSearch = async (): Promise<void> => {
    const query = keyword.trim()
    if (!query || searching) return
    setSearching(true)
    setSearchError(null)
    try {
      setResults(await searchCardsByQuery(query, 30))
    } catch {
      setResults([])
      setSearchError('搜索失败，请重试')
    } finally {
      setSearching(false)
    }
  }

  const pick = async (card: CdbCard): Promise<void> => {
    const ok = await useDuelEngineStore.getState().replaceCard(target.ref, card.id)
    if (ok) onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-sm">
          <ArrowLeftRight className="w-4 h-4 text-blue-400" />
          <span>替换卡片 — {target.name}</span>
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void doSearch()
        }}
      >
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入卡名或卡密搜索"
            className="h-8 pl-8 text-xs"
            autoFocus
          />
        </div>
        <Button type="submit" size="sm" disabled={searching || !keyword.trim()}>
          {searching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          搜索
        </Button>
      </form>

      {searchError && <p className="text-xs text-rose-500">{searchError}</p>}

      <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
        {results.map((card) => (
          <button
            key={card.id}
            type="button"
            disabled={loading}
            onClick={() => void pick(card)}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-border/60 bg-card/60 hover:border-blue-400/60 hover:bg-card text-left transition-colors disabled:opacity-50"
          >
            <span className="text-xs font-medium truncate">{card.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">{card.id}</span>
          </button>
        ))}
        {results.length === 0 && !searching && !searchError && (
          <p className="text-xs text-muted-foreground py-6 text-center">
            搜索后点击结果即可替换（将自动重演到当前步骤）
          </p>
        )}
      </div>

      <DialogFooter>
        <Button size="sm" variant="outline" onClick={onClose}>
          取消
        </Button>
      </DialogFooter>
    </>
  )
}
