import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CdbCard } from '@shared/index'
import {
  useEngineCardEditStore,
  type EngineCardEditTarget
} from '../../../stores/useEngineCardEditStore'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'
import { confirmDialog } from '../../../stores/useDialogStore'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { CardRowItem } from '../../CardSearch/CardRowItem'

const PAGE_SIZE = 40

const ReplaceDialogBody: React.FC<{
  target: EngineCardEditTarget
  onClose: () => void
}> = ({ target, onClose }) => {
  const replaceCard = useDuelEngineStore((s) => s.replaceCard)
  const loading = useDuelEngineStore((s) => s.loading)
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<CdbCard[]>([])
  const [total, setTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestRef = useRef(0)

  const fetchPage = useCallback(
    async (value: string, offset: number, append: boolean): Promise<void> => {
      const requestId = ++requestRef.current
      if (append) setLoadingMore(true)
      else setSearching(true)
      try {
        const res = await window.api.searchCards({
          keyword: value,
          limit: PAGE_SIZE,
          offset
        })
        if (requestRef.current !== requestId) return
        setResults((prev) => (append ? [...prev, ...res.cards] : res.cards))
        setTotal(res.total)
      } catch {
        if (requestRef.current === requestId && !append) {
          setResults([])
          setTotal(0)
        }
      } finally {
        if (requestRef.current === requestId) {
          if (append) setLoadingMore(false)
          else setSearching(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void fetchPage('', 0, false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchPage])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    void fetchPage(keyword.trim(), 0, false)
  }

  const loadMore = (): void => {
    if (searching || loadingMore || results.length >= total) return
    void fetchPage(keyword.trim(), results.length, true)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) loadMore()
  }

  const handleReplace = async (card: CdbCard): Promise<void> => {
    if (loading) return
    const ok = await confirmDialog({
      title: '替换这张卡？',
      description: `「${target.name}」→「${card.name}」\n\n会修改来源并自动重演；新增的可选发动默认不发动。若无法与原历史对齐，会回到分歧点，之后的操作需要重新进行。`,
      confirmText: '替换并重演',
      destructive: false
    })
    if (ok !== true) return
    const replaced = await replaceCard(target.ref, card.id)
    if (replaced) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">替换「{target.name}」</div>
          <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
            当前卡密 {target.code}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-b border-border p-3"
        >
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索卡名或卡密"
            className="h-8 flex-1 text-xs"
          />
          <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={searching}>
            搜索
          </Button>
        </form>

        <div className="flex shrink-0 items-center justify-between border-b border-border/40 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>
            搜索结果: <strong className="font-semibold text-foreground">{total}</strong> 张
          </span>
          {searching && <span>搜索中…</span>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2" onScroll={handleScroll}>
          {results.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              {searching ? '正在搜索…' : '没有结果'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {results.map((card) => (
                <CardRowItem
                  key={card.id}
                  card={card}
                  onRowClick={() => void handleReplace(card)}
                />
              ))}
              {loadingMore && (
                <div className="py-2 text-center text-xs text-muted-foreground">加载更多卡片…</div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  )
}

export const EngineCardReplaceDialog: React.FC = () => {
  const target = useEngineCardEditStore((s) => s.replaceTarget)
  const closeReplace = useEngineCardEditStore((s) => s.closeReplace)

  useEffect(
    () =>
      useDuelEngineStore.subscribe((state) => {
        if (!state.isInitialized) closeReplace()
      }),
    [closeReplace]
  )

  if (!target) return null
  return (
    <ReplaceDialogBody
      key={`${target.ref.instanceId ?? ''}-${target.code}`}
      target={target}
      onClose={closeReplace}
    />
  )
}
