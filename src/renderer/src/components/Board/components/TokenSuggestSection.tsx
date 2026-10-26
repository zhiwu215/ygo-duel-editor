import React, { useMemo, useState } from 'react'
import { CdbCard, CardPosition, POSITION_NAMES } from '@shared/index'
import { useTokenStore } from '../../../stores/useTokenStore'
import {
  filterTokenCatalog,
  matchTokenSuggestions,
  tokenCatalogKey
} from '../../../utils/tokenCatalog'
import type { TokenSuggestion } from '../../../utils/tokenCatalog'
import { Button } from '../../ui/button'
import { CardImage } from '../../ui/CardImage'
import { X, Loader2, Search } from 'lucide-react'
import { cn } from '../../../lib/utils'

const SEARCH_PAGE_SIZE = 40

const formatTokenStat = (value: number | undefined): string =>
  value === undefined || value < 0 ? '?' : String(value)

const TokenRow: React.FC<{
  token: CdbCard
  count: number | null
  armed: boolean
  onPick: () => void
}> = ({ token, count, armed, onPick }) => (
  <button
    type="button"
    onClick={onPick}
    className={cn(
      'flex items-center gap-1.5 p-1 rounded border text-left transition-colors cursor-pointer',
      armed
        ? 'border-emerald-400/70 bg-emerald-500/10'
        : 'border-border/50 bg-muted/40 hover:border-emerald-400/50 hover:bg-emerald-500/5'
    )}
  >
    <CardImage
      code={token.id}
      small
      loading="lazy"
      alt={token.name}
      className="w-[22px] h-[32px] object-cover rounded shrink-0 border border-border/60 bg-black/40"
    />
    <span
      className={cn(
        'text-[11px] font-medium truncate',
        armed ? 'text-emerald-500' : 'text-foreground/90'
      )}
    >
      {token.name}
    </span>
    {count !== null && (
      <span className="font-mono text-[10px] text-emerald-500 shrink-0">×{count}</span>
    )}
    <span className="ml-auto font-mono text-[10px] text-muted-foreground/80 shrink-0">
      {formatTokenStat(token.atk)}/{formatTokenStat(token.def)}
    </span>
  </button>
)

export const TokenSuggestSection: React.FC<{ sourceCard: CdbCard | undefined }> = ({
  sourceCard
}) => {
  const tokenCatalog = useTokenStore((s) => s.catalog)
  const isTokenCatalogLoading = useTokenStore((s) => s.isCatalogLoading)
  const pending = useTokenStore((s) => s.pending)
  const armToken = useTokenStore((s) => s.armToken)
  const cancelPendingToken = useTokenStore((s) => s.cancelPending)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(SEARCH_PAGE_SIZE)

  const suggestions = useMemo(
    () => (tokenCatalog && sourceCard ? matchTokenSuggestions(tokenCatalog, sourceCard) : []),
    [tokenCatalog, sourceCard]
  )
  const searchResults = useMemo(
    () =>
      tokenCatalog && query.trim()
        ? filterTokenCatalog(tokenCatalog, query).map((token) => {
            const hit = suggestions.find((item) => item.token.name === token.name)
            return {
              token,
              count: hit?.count ?? null,
              position: hit?.position ?? CardPosition.FACEUP_ATTACK
            }
          })
        : [],
    [tokenCatalog, query, suggestions]
  )

  const visibleSearchResults = searchResults.slice(0, visibleCount)
  const hasMoreSearchResults = visibleCount < searchResults.length

  const handleSearchScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    if (!hasMoreSearchResults) return
    const element = event.currentTarget
    if (element.scrollTop + element.clientHeight < element.scrollHeight - 32) return
    setVisibleCount((count) => Math.min(count + SEARCH_PAGE_SIZE, searchResults.length))
  }

  const pick = (token: CdbCard, count: number | null, position: number): void => {
    if (pending && tokenCatalogKey(pending.card) === tokenCatalogKey(token)) {
      cancelPendingToken()
      return
    }
    armToken(token, position, count)
  }

  const renderList = (
    items: TokenSuggestion[],
    options?: {
      onScroll?: React.UIEventHandler<HTMLDivElement>
      maxHeightClass?: string
    }
  ): React.ReactNode => (
    <div
      className={cn(
        'flex flex-col gap-1 overflow-y-auto',
        options?.maxHeightClass ?? 'max-h-[168px]'
      )}
      onScroll={options?.onScroll}
    >
      {items.map((item) => (
        <TokenRow
          key={item.token.id}
          token={item.token}
          count={item.count}
          armed={pending ? tokenCatalogKey(pending.card) === tokenCatalogKey(item.token) : false}
          onPick={() => pick(item.token, item.count, item.position)}
        />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-foreground/90">
          <span>衍生物</span>
        </span>
        {pending && (
          <Button
            variant="ghost"
            size="xs"
            onClick={cancelPendingToken}
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive gap-1"
          >
            <X className="w-2.5 h-2.5" />
            <span>取消放置</span>
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/70 pointer-events-none" />
        <input
          type="text"
          value={query}
          placeholder="搜索衍生物名称"
          onChange={(e) => {
            setQuery(e.target.value)
            setVisibleCount(SEARCH_PAGE_SIZE)
          }}
          className="h-6 w-full rounded border border-border/70 bg-background pl-6 pr-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400"
        />
      </div>

      {query.trim() && searchResults.length > 0 && (
        <div className="text-[10px] text-muted-foreground/70 px-0.5">
          共 {searchResults.length} 个衍生物
          {hasMoreSearchResults ? `，已显示 ${visibleSearchResults.length}，下滑继续加载` : ''}
        </div>
      )}

      {pending && (
        <div className="text-[10px] text-emerald-500 px-0.5 leading-tight">
          已选中「{pending.card.name}」（{POSITION_NAMES[pending.position] ?? '表侧表示'}）
          {pending.total !== null ? `，已放置 ${pending.placed}/${pending.total}` : ''}
          ，点击空怪兽区放下，Esc 取消
        </div>
      )}

      {isTokenCatalogLoading ? (
        <div className="h-6 flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>载入中...</span>
        </div>
      ) : query.trim() ? (
        searchResults.length > 0 ? (
          renderList(visibleSearchResults, {
            onScroll: handleSearchScroll,
            maxHeightClass: 'max-h-[240px]'
          })
        ) : (
          <div className="text-[10px] text-muted-foreground/70 py-0.5 italic">未找到衍生物</div>
        )
      ) : suggestions.length > 0 ? (
        renderList(suggestions)
      ) : (
        <div className="text-[10px] text-muted-foreground/70 py-0.5 italic">
          效果文本未提及衍生物，可搜索名称手动放置
        </div>
      )}
    </div>
  )
}
