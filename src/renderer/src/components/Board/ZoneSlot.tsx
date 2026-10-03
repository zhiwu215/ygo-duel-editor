import React, { useState } from 'react'
import { FieldCard, CdbCard } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { CardItem } from './CardItem'
import { Swords, Sparkles, Hexagon, Globe, Ghost, Layers, ShieldAlert, Ban } from 'lucide-react'

export type ZoneColorVariant =
  | 'monster'
  | 'spell'
  | 'emz'
  | 'field'
  | 'grave'
  | 'deck'
  | 'extra'
  | 'removed'
  | 'special'
  | 'pendulum-blue'
  | 'pendulum-red'

interface ZoneSlotProps {
  label: string
  controller: 0 | 1
  location: number
  sequence: number
  card?: FieldCard
  count?: number // 堆叠张数 (如卡组/墓地/额外卡组)
  isPendulum?: boolean // 是否为灵摆标记位 (MR4/5 的 0/4 号魔陷位，或 MR3 的独立灵摆区)
  pendulumDirection?: 'left' | 'right' // 灵摆箭头指向 (左向 ◀ 或右向 ▶)
  colorVariant?: ZoneColorVariant
  className?: string
}

interface VariantConfig {
  border: string
  bg: string
  shadow: string
  bracket: string
  text: string
  icon: React.ComponentType<{ className?: string }>
}

const VARIANT_CONFIGS: Record<ZoneColorVariant, VariantConfig> = {
  monster: {
    border: 'border-amber-500/35 hover:border-amber-500/70',
    bg: 'bg-gradient-to-b from-amber-950/25 via-black/40 to-amber-950/30',
    shadow: 'shadow-[0_0_12px_rgba(245,158,11,0.06)]',
    bracket: 'border-amber-400/50',
    text: 'text-amber-200/80',
    icon: Swords
  },
  spell: {
    border: 'border-emerald-500/35 hover:border-emerald-500/70',
    bg: 'bg-gradient-to-b from-emerald-950/25 via-black/40 to-emerald-950/30',
    shadow: 'shadow-[0_0_12px_rgba(16,185,129,0.06)]',
    bracket: 'border-emerald-400/50',
    text: 'text-emerald-200/80',
    icon: Sparkles
  },
  emz: {
    border: 'border-cyan-400/50 hover:border-cyan-300',
    bg: 'bg-gradient-to-b from-cyan-950/35 via-black/45 to-cyan-950/45',
    shadow: 'shadow-[0_0_16px_rgba(6,182,212,0.18)]',
    bracket: 'border-cyan-300/80',
    text: 'text-cyan-200 font-semibold',
    icon: Hexagon
  },
  field: {
    border: 'border-teal-500/35 hover:border-teal-400/70',
    bg: 'bg-gradient-to-b from-teal-950/25 via-black/40 to-teal-950/30',
    shadow: 'shadow-[0_0_12px_rgba(20,184,166,0.08)]',
    bracket: 'border-teal-400/50',
    text: 'text-teal-200/80',
    icon: Globe
  },
  grave: {
    border: 'border-purple-500/35 hover:border-purple-400/70',
    bg: 'bg-gradient-to-b from-purple-950/30 via-black/40 to-purple-950/35',
    shadow: 'shadow-[0_0_12px_rgba(168,85,247,0.08)]',
    bracket: 'border-purple-400/50',
    text: 'text-purple-200/80',
    icon: Ghost
  },
  deck: {
    border: 'border-slate-500/35 hover:border-slate-400/70',
    bg: 'bg-gradient-to-b from-slate-900/30 via-black/40 to-slate-900/40',
    shadow: 'shadow-[0_0_10px_rgba(100,116,139,0.08)]',
    bracket: 'border-slate-400/50',
    text: 'text-slate-300/80',
    icon: Layers
  },
  extra: {
    border: 'border-indigo-500/35 hover:border-indigo-400/70',
    bg: 'bg-gradient-to-b from-indigo-950/30 via-black/40 to-indigo-950/35',
    shadow: 'shadow-[0_0_12px_rgba(99,102,241,0.08)]',
    bracket: 'border-indigo-400/50',
    text: 'text-indigo-200/80',
    icon: Layers
  },
  removed: {
    border: 'border-orange-500/40 hover:border-orange-400/70',
    bg: 'bg-gradient-to-b from-orange-950/30 via-black/40 to-orange-950/35',
    shadow: 'shadow-[0_0_12px_rgba(249,115,22,0.1)]',
    bracket: 'border-orange-400/60',
    text: 'text-orange-200/90',
    icon: Ban
  },
  special: {
    border: 'border-blue-500/35 hover:border-blue-400/70',
    bg: 'bg-gradient-to-b from-blue-950/25 via-black/40 to-blue-950/30',
    shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.08)]',
    bracket: 'border-blue-400/50',
    text: 'text-blue-200/80',
    icon: ShieldAlert
  },
  'pendulum-blue': {
    border: 'border-cyan-500/45 hover:border-cyan-400/80',
    bg: 'bg-gradient-to-b from-cyan-950/35 via-black/45 to-blue-950/40',
    shadow: 'shadow-[0_0_14px_rgba(6,182,212,0.18)]',
    bracket: 'border-cyan-400/60',
    text: 'text-cyan-200/95 font-medium',
    icon: ShieldAlert
  },
  'pendulum-red': {
    border: 'border-rose-500/45 hover:border-rose-400/80',
    bg: 'bg-gradient-to-b from-rose-950/35 via-black/45 to-red-950/40',
    shadow: 'shadow-[0_0_14px_rgba(244,63,94,0.18)]',
    bracket: 'border-rose-400/60',
    text: 'text-rose-200/95 font-medium',
    icon: ShieldAlert
  }
}

export const ZoneSlot: React.FC<ZoneSlotProps> = ({
  label,
  controller,
  location,
  sequence,
  card,
  count,
  isPendulum,
  pendulumDirection,
  colorVariant = 'monster',
  className = ''
}) => {
  const { addCardToZone, setSelectedCardId, moveCard } = useDuelStore()
  const [isOver, setIsOver] = useState(false)

  // 处理拖拽进入
  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isOver) setIsOver(true)
  }

  const handleDragLeave = (): void => {
    setIsOver(false)
  }

  // 释放落子 (支持从左侧面板新增卡片，也支持在场上/手牌间拖动调整位置)
  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsOver(false)
    try {
      const movedInstanceId = e.dataTransfer.getData('text/instanceId')
      if (movedInstanceId) {
        moveCard(movedInstanceId, location, sequence, controller)
        return
      }

      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return
      const droppedCard = JSON.parse(dataStr) as CdbCard
      addCardToZone(droppedCard, controller, location, sequence)
    } catch (err) {
      console.error('[ZoneSlot] Drop failed:', err)
    }
  }

  const config = VARIANT_CONFIGS[colorVariant] || VARIANT_CONFIGS.monster
  const IconComponent = config.icon

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        if (!card) setSelectedCardId(null)
      }}
      className={`group relative w-[74px] h-[104px] rounded-lg border backdrop-blur-sm ${config.border} ${config.bg} ${config.shadow} flex flex-col items-center justify-center transition-all duration-150 select-none overflow-hidden shrink-0 ${
        isOver
          ? 'ring-2 ring-amber-400 bg-amber-500/25 scale-[1.03] border-transparent shadow-[0_0_16px_rgba(245,158,11,0.35)]'
          : ''
      } ${className}`}
    >
      {/* 科技感 4 角卡槽定位标记 */}
      <div
        className={`absolute top-1 left-1 w-2 h-2 border-t-[1.5px] border-l-[1.5px] ${config.bracket} pointer-events-none transition-opacity group-hover:opacity-100 opacity-60`}
      />
      <div
        className={`absolute top-1 right-1 w-2 h-2 border-t-[1.5px] border-r-[1.5px] ${config.bracket} pointer-events-none transition-opacity group-hover:opacity-100 opacity-60`}
      />
      <div
        className={`absolute bottom-1 left-1 w-2 h-2 border-b-[1.5px] border-l-[1.5px] ${config.bracket} pointer-events-none transition-opacity group-hover:opacity-100 opacity-60`}
      />
      <div
        className={`absolute bottom-1 right-1 w-2 h-2 border-b-[1.5px] border-r-[1.5px] ${config.bracket} pointer-events-none transition-opacity group-hover:opacity-100 opacity-60`}
      />

      {/* 堆叠张数徽标 (如卡组/墓地/额外卡组张数) */}
      {count !== undefined && count > 0 && (
        <div className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded-full bg-black/85 border border-white/20 text-[9px] font-mono font-bold text-amber-300 leading-none shadow-md pointer-events-none">
          {count}
        </div>
      )}

      {card ? (
        <CardItem card={card} />
      ) : (
        <div className="flex flex-col items-center justify-center p-1.5 text-center pointer-events-none relative z-10 w-full">
          {/* 决斗槽位水印徽记 */}
          <div className="mb-1 opacity-25 group-hover:opacity-40 transition-transform group-hover:scale-110 duration-200">
            <IconComponent className="w-6 h-6 stroke-[1.5]" />
          </div>

          <span
            className={`text-[10px] font-mono tracking-tight font-medium ${config.text} leading-tight drop-shadow`}
          >
            {label}
          </span>

          {/* 灵摆刻度标识 */}
          {isPendulum && (
            <div className="flex items-center gap-0.5 mt-1">
              {colorVariant === 'pendulum-blue' ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-700/80 text-cyan-100 font-bold border border-cyan-400/50 shadow flex items-center gap-0.5">
                  {pendulumDirection === 'right' ? (
                    <>
                      P <span>▶</span>
                    </>
                  ) : (
                    <>
                      <span>◀</span> P
                    </>
                  )}
                </span>
              ) : colorVariant === 'pendulum-red' ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-700/80 text-rose-100 font-bold border border-rose-400/50 shadow flex items-center gap-0.5">
                  {pendulumDirection === 'left' ? (
                    <>
                      <span>◀</span> P
                    </>
                  ) : (
                    <>
                      P <span>▶</span>
                    </>
                  )}
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gradient-to-r from-blue-600/70 via-indigo-600/70 to-red-600/70 text-white font-bold border border-white/20 shadow flex items-center gap-0.5">
                  {pendulumDirection === 'left' ? (
                    <>
                      <span>◀</span> P
                    </>
                  ) : pendulumDirection === 'right' ? (
                    <>
                      P <span>▶</span>
                    </>
                  ) : (
                    'P'
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
