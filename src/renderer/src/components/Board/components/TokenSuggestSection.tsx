import React from 'react'
import { CdbCard } from '@shared/index'
import { useTokenStore, matchTokensByDesc } from '../../../stores/useTokenStore'
import { Button } from '../../ui/button'
import { CardImage } from '../../ui/CardImage'
import { X, Loader2 } from 'lucide-react'
import { cn } from '../../../lib/utils'

export const TokenSuggestSection: React.FC<{ sourceCard: CdbCard | undefined }> = ({
  sourceCard
}) => {
  const tokenCatalog = useTokenStore((s) => s.catalog)
  const isTokenCatalogLoading = useTokenStore((s) => s.isCatalogLoading)
  const pendingToken = useTokenStore((s) => s.pendingToken)
  const armToken = useTokenStore((s) => s.armToken)
  const cancelPendingToken = useTokenStore((s) => s.cancelPending)

  const suggestedTokens =
    tokenCatalog && sourceCard ? matchTokensByDesc(tokenCatalog, sourceCard) : []

  return (
    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/60">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-foreground/90">
          <span>衍生物</span>
        </span>
        {pendingToken && (
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

      {isTokenCatalogLoading ? (
        <div className="h-6 flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>载入中...</span>
        </div>
      ) : suggestedTokens.length > 0 ? (
        <>
          {pendingToken && (
            <div className="text-[10px] text-emerald-500 px-0.5 leading-tight">
              已选中「{pendingToken.name}」，点击棋盘上的空怪兽区放下 (Esc 取消)
            </div>
          )}
          <div className="flex flex-col gap-1 max-h-[168px] overflow-y-auto">
            {suggestedTokens.map((token) => {
              const isArmed = pendingToken?.id === token.id
              return (
                <button
                  key={token.id}
                  type="button"
                  onClick={() => armToken(token)}
                  className={cn(
                    'flex items-center gap-1.5 p-1 rounded border text-left transition-colors cursor-pointer',
                    isArmed
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
                      isArmed ? 'text-emerald-500' : 'text-foreground/90'
                    )}
                  >
                    {token.name}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground/80 shrink-0">
                    {token.atk ?? 0}/{token.def ?? 0}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="text-[10px] text-muted-foreground/70 py-0.5 italic">
          该卡效果文本未提及衍生物
        </div>
      )}
    </div>
  )
}
