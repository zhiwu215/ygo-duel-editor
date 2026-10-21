import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { CardLocation, FieldCard } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDetachMaterialStore } from '../../stores/useDetachMaterialStore'
import { useCardDataMap } from '../../hooks/useCardDataMap'
import { resolveCardName } from '../../utils/cardNames'
import { buildOverlayMaterialCards } from '../../utils/overlayMaterialCards'
import { Layers, X, Check, Search } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { CardImage } from '../ui/CardImage'

export const DetachMaterialModal: React.FC = () => {
  const { hostInstanceId, selected, toggle, closeDetach } = useDetachMaterialStore()
  const { state, setHoveredCard, setHoveredInstanceId, detachMaterialToLocation } = useDuelStore()

  const [searchQuery, setSearchQuery] = useState('')

  const hostCard = hostInstanceId ? state.cards.find((c) => c.instanceId === hostInstanceId) : null
  const materials = useMemo(() => hostCard?.overlayMaterials || [], [hostCard?.overlayMaterials])
  const cardDataMap = useCardDataMap(materials)

  const materialCards = useMemo<FieldCard[]>(
    () => (hostCard ? buildOverlayMaterialCards(materials, cardDataMap, hostCard) : []),
    [materials, cardDataMap, hostCard]
  )

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return materialCards
    return materialCards.filter((c) => {
      const name = (c.card?.name || resolveCardName(c.code)).toLowerCase()
      return name.includes(query) || String(c.code).includes(query)
    })
  }, [materialCards, searchQuery])

  const handleConfirm = useCallback(() => {
    if (!hostCard || selected.length === 0) return
    for (const index of [...selected].sort((a, b) => b - a)) {
      detachMaterialToLocation(hostCard.instanceId, index, CardLocation.GRAVE)
    }
    closeDetach()
  }, [hostCard, selected, detachMaterialToLocation, closeDetach])

  useEffect(() => {
    return () => {
      setHoveredInstanceId(null)
    }
  }, [setHoveredInstanceId])

  if (!hostInstanceId || !hostCard) return null

  const hostName = cardDataMap[hostCard.code]?.name || resolveCardName(hostCard.code)

  return (
    <div
      className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in"
      onClick={closeDetach}
    >
      <div
        className="bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[92%] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
              <span>拔除素材 — {hostName}</span>
              <Badge variant="secondary" className="font-mono text-xs px-1.5 py-0 h-5">
                {materials.length}
              </Badge>
            </h2>
            {selected.length > 0 && (
              <span className="text-[11px] text-emerald-500 font-medium">
                已选 {selected.length} 张
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {materials.length > 3 && (
              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索卡名或卡密..."
                  className="h-7 w-full text-xs pl-8 pr-2 rounded-md border border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}

            <button
              type="button"
              onClick={closeDetach}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-h-[300px] max-h-[66vh] overflow-y-auto overflow-x-hidden p-4 bg-muted/10">
          {filteredCards.length === 0 ? (
            <div className="h-full min-h-[260px] w-full flex flex-col items-center justify-center text-muted-foreground py-16 text-xs gap-2 border-2 border-dashed border-border/40 rounded-lg">
              <Layers className="w-10 h-10 opacity-30 stroke-[1.5]" />
              <p>{searchQuery ? '未找到符合条件的卡片' : '当前怪兽暂无超量素材'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
              {filteredCards.map((card, index) => {
                const isSelected = selected.includes(index)
                return (
                  <button
                    type="button"
                    key={card.instanceId}
                    onClick={() => toggle(index)}
                    onMouseEnter={() => {
                      const detail = card.card || cardDataMap[card.code]
                      if (detail) setHoveredCard(detail)
                    }}
                    className={
                      'group relative rounded overflow-hidden select-none text-left cursor-pointer transition-all ' +
                      (isSelected
                        ? 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20'
                        : 'ring-1 ring-transparent hover:ring-2 hover:ring-emerald-500/50')
                    }
                  >
                    <div className="relative w-full aspect-[59/86] bg-black/30">
                      <CardImage
                        code={card.code}
                        small
                        alt={card.card?.name || resolveCardName(card.code)}
                        className="w-full h-full object-cover pointer-events-none"
                      />

                      <span className="absolute left-1 top-1 px-1 rounded bg-black/65 text-white/90 font-mono text-[9px] leading-[14px] pointer-events-none">
                        #{index + 1}
                      </span>

                      {isSelected && (
                        <span className="absolute right-1 top-1 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow">
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </span>
                      )}

                      <span
                        className={
                          'absolute inset-x-0 bottom-0 flex items-center justify-center p-1 bg-linear-to-t from-black/80 via-black/40 to-transparent text-[10px] font-medium transition-opacity ' +
                          (isSelected
                            ? 'opacity-100 text-emerald-300'
                            : 'opacity-0 group-hover:opacity-100 text-white/85')
                        }
                      >
                        {isSelected ? '已选中' : '点击选中'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 shrink-0">
          <span className="text-[11px] text-muted-foreground">选中的素材将被送去墓地</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={closeDetach} className="px-5 h-7 text-xs">
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className="px-5 h-7 text-xs"
            >
              确认送墓 ({selected.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
