import React, { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { CdbCard } from '@shared/index'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { searchCardsByQuery } from '../../../utils/cardSearch'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { CardImage } from '../../ui/CardImage'
import { cn } from '../../../lib/utils'

interface AnnounceCardPickerProps {
  requiredCount: number
  pickedCard: CdbCard | null
  onPick: (card: CdbCard) => void
}

export const AnnounceCardPicker: React.FC<AnnounceCardPickerProps> = ({
  requiredCount,
  pickedCard,
  onPick
}) => {
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={keyword}
          placeholder="输入卡名 / 关键字搜索（纯数字按卡密搜索）"
          className="h-8 text-xs"
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void doSearch()
          }}
        />
        <Button
          size="sm"
          className="h-8 shrink-0 text-xs"
          disabled={loading || searching || !keyword.trim()}
          onClick={() => void doSearch()}
        >
          <Search />
          {searching ? '搜索中' : '搜索'}
        </Button>
      </div>
      {requiredCount > 1 && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          引擎要求宣言 {requiredCount} 张卡，当前简化版一次只提交 1 张。
        </p>
      )}
      {searchError && <p className="text-[11px] text-destructive">{searchError}</p>}
      <div className="flex flex-wrap gap-2">
        {results.map((card) => {
          const selected = pickedCard?.id === card.id
          return (
            <button
              key={card.id}
              type="button"
              disabled={loading}
              onClick={() => onPick(card)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg border p-1.5 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
                  : 'border-border/70 bg-background/60 hover:border-primary/60 hover:bg-muted/40'
              )}
            >
              <CardImage
                code={card.id}
                small
                alt={card.name}
                className="h-14 w-10 shrink-0 rounded border border-border/60 object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-foreground">
                  {card.name}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-muted-foreground">
                  {card.desc}
                </span>
              </span>
              {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          )
        })}
        {!searching && results.length === 0 && !searchError && (
          <p className="w-full py-6 text-center text-xs text-muted-foreground">
            输入关键词搜索后选择要宣言的卡片
          </p>
        )}
      </div>
    </div>
  )
}
