import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useState, useEffect, useRef } from 'react'
import { CardLocation, CdbCard } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useOverlayListStore } from '../../stores/useOverlayListStore'
import { getCardImageUrl, UNKNOWN_CARD_IMAGE } from '../../utils/cardImage'
import { Layers, Ghost, Ban, X, Trash2, Search, ArrowUpCircle, ArrowDownToLine } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'

export const OverlayListModal: React.FC = () => {
  const { hostInstanceId, closeOverlayList } = useOverlayListStore()
  const {
    state,
    setHoveredCard,
    setHoveredInstanceId,
    addOverlayMaterial,
    removeOverlayMaterial,
    swapHostWithMaterial,
    detachMaterialToLocation
  } = useDuelStore()

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [cardNames, setCardNames] = useState<Record<number, string>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const hostCard = hostInstanceId ? state.cards.find((c) => c.instanceId === hostInstanceId) : null

  useEffect(() => {
    return () => {
      setHoveredInstanceId(null)
    }
  }, [setHoveredInstanceId])

  useEffect(() => {
    if (!hostCard?.overlayMaterials?.length) return
    const missingCodes = hostCard.overlayMaterials.filter((code) => !cardNames[code])
    if (missingCodes.length === 0) return

    let isMounted = true
    window.api
      .getCardsByIds(missingCodes)
      .then((map) => {
        if (!isMounted) return
        setCardNames((prev) => {
          const next = { ...prev }
          for (const code of missingCodes) {
            next[code] = map[code]?.name || `[${code}]`
          }
          return next
        })
      })
      .catch((err) => {
        void err
      })

    return () => {
      isMounted = false
    }
  }, [hostCard?.overlayMaterials, cardNames])

  if (!hostInstanceId || !hostCard) return null

  const materials = hostCard.overlayMaterials || []
  const hostName = hostCard.card?.name || `卡片 [${hostCard.code}]`

  const filteredMaterials = materials
    .map((code, index) => ({ code, index, name: cardNames[code] || String(code) }))
    .filter((item) => {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      return item.name.toLowerCase().includes(q) || String(item.code).includes(q)
    })

  const handleDropNewMaterial = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')
      if (movedInstanceId) {
        const movedCard = state.cards.find((c) => c.instanceId === movedInstanceId)
        if (movedCard) {
          useDuelStore.getState().removeCard(movedInstanceId)
          addOverlayMaterial(hostCard.instanceId, movedCard.code)
        }
      } else {
        const dataStr = e.dataTransfer.getData('application/json')
        if (dataStr) {
          const droppedCard = JSON.parse(dataStr) as CdbCard
          addOverlayMaterial(hostCard.instanceId, droppedCard.id)
        }
      }
    } catch (err) {
      console.error('[OverlayListModal] Drop material failed:', err)
    }
  }

  const handleSwapHost = async (matIndex: number, matCode: number): Promise<void> => {
    swapHostWithMaterial(hostCard.instanceId, matIndex)
    try {
      const cardMap = await window.api.getCardsByIds([matCode])
      const cardData = cardMap[matCode]
      if (cardData) {
        useDuelStore.getState().setCardData(hostCard.instanceId, cardData)
        setHoveredCard(cardData)
      }
    } catch (err) {
      void err
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && closeOverlayList()}>
      <DialogContent
        showCloseButton={false}
        className="w-[94vw] max-w-5xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] p-0"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={handleDropNewMaterial}
      >
        <DialogHeader className="px-5 py-3 border-b border-border bg-muted/40 flex flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="font-bold text-sm text-foreground">
                超量素材列表 — {hostName}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                可自由选择任意素材拔除至墓地、手牌或直接删除；点击「设为主怪兽」可切换置顶
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {materials.length > 4 && (
              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索素材卡名..."
                  className="h-7 pl-8 text-xs bg-secondary/80"
                />
              </div>
            )}

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeOverlayList}
                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                }
              />
              <TooltipContent>关闭 (Esc)</TooltipContent>
            </Tooltip>
          </div>
        </DialogHeader>

        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-6 flex items-center gap-4 bg-background/50"
        >
          {materials.length === 0 ? (
            <div className="w-full py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Layers className="w-10 h-10 opacity-30 text-amber-400" />
              <p className="text-sm font-medium">当前怪兽暂无超量素材</p>
              <p className="text-xs opacity-60">
                可从右侧搜索栏拖拽卡片至此窗口，或在场上按住 Alt 键将卡片拖拽叠放
              </p>
            </div>
          ) : (
            filteredMaterials.map((item) => {
              return (
                <div
                  key={`mat_${item.code}_${item.index}`}
                  onMouseEnter={async () => {
                    try {
                      const cardMap = await window.api.getCardsByIds([item.code])
                      const card = cardMap[item.code]
                      if (card) setHoveredCard(card)
                    } catch (err) {
                      void err
                    }
                  }}
                  className="flex flex-col items-center gap-2 p-2.5 rounded-lg border border-border/80 bg-card/70 hover:border-amber-400/50 hover:bg-card shadow-sm transition-all shrink-0 w-[140px] group"
                >
                  <div className="w-full flex items-center text-[10px] px-0.5">
                    <span className="font-mono text-muted-foreground font-semibold">
                      #{item.index + 1}
                    </span>
                  </div>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div
                          onClick={() =>
                            detachMaterialToLocation(
                              hostCard.instanceId,
                              item.index,
                              CardLocation.GRAVE
                            )
                          }
                          className="relative w-[110px] h-[160px] rounded overflow-hidden shadow border border-border bg-black/40 cursor-pointer group/img hover:ring-2 hover:ring-amber-500/80 hover:scale-[1.02] transition-all"
                        >
                          <img
                            src={getCardImageUrl(item.code, true)}
                            alt={item.name}
                            className="w-full h-full object-cover select-none"
                            onError={(e) => {
                              const target = e.currentTarget
                              if (target.src !== UNKNOWN_CARD_IMAGE) {
                                target.src = UNKNOWN_CARD_IMAGE
                              }
                            }}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity backdrop-blur-[1px]">
                            <Ghost className="w-5 h-5 text-amber-400 drop-shadow" />
                            <span className="text-[10px] font-bold text-amber-300 drop-shadow px-1.5 py-0.5 bg-black/60 rounded">
                              拔除至墓地
                            </span>
                          </div>
                        </div>
                      }
                    />
                    <TooltipContent>点击直接拔除此卡至墓地</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="text-xs font-semibold text-center truncate w-full text-foreground group-hover:text-primary transition-colors leading-tight">
                          {item.name}
                        </span>
                      }
                    />
                    <TooltipContent>{item.name}</TooltipContent>
                  </Tooltip>

                  <div className="w-full flex flex-col gap-1 pt-1 border-t border-border/50">
                    <div className="grid grid-cols-3 gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() =>
                                detachMaterialToLocation(
                                  hostCard.instanceId,
                                  item.index,
                                  CardLocation.HAND
                                )
                              }
                              className="h-5 px-1 text-[9px] gap-0.5"
                            >
                              <ArrowDownToLine className="w-2.5 h-2.5 text-muted-foreground" />
                              <span>手牌</span>
                            </Button>
                          }
                        />
                        <TooltipContent>拔除并加入手牌</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() =>
                                detachMaterialToLocation(
                                  hostCard.instanceId,
                                  item.index,
                                  CardLocation.REMOVED
                                )
                              }
                              className="h-5 px-1 text-[9px] gap-0.5"
                            >
                              <Ban className="w-2.5 h-2.5 text-muted-foreground" />
                              <span>除外</span>
                            </Button>
                          }
                        />
                        <TooltipContent>拔除并除外</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => removeOverlayMaterial(hostCard.instanceId, item.index)}
                              className="h-5 px-1 text-[9px] text-muted-foreground hover:text-rose-400 gap-0.5"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>删除</span>
                            </Button>
                          }
                        />
                        <TooltipContent>直接删除此素材（不送去任何区域）</TooltipContent>
                      </Tooltip>
                    </div>

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleSwapHost(item.index, item.code)}
                            className="w-full h-5 text-[9px] text-muted-foreground hover:text-foreground gap-1"
                          >
                            <ArrowUpCircle className="w-2.5 h-2.5" />
                            <span>设为主怪兽</span>
                          </Button>
                        }
                      />
                      <TooltipContent>将此卡作为顶层主怪兽，原怪兽退为超量素材</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
