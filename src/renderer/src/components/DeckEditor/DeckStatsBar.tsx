import React from 'react'
import { DeckStats } from '@shared/index'

interface DeckStatsBarProps {
  stats: DeckStats
}

export const DeckStatsBar: React.FC<DeckStatsBarProps> = ({ stats }) => {
  return (
    <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/50 select-none">
      {/* 主卡组统计 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="text-foreground">主卡组</span>
          <span
            className={
              stats.mainCount >= 40 && stats.mainCount <= 60
                ? 'text-foreground font-mono'
                : 'text-amber-500 font-mono'
            }
          >
            {stats.mainCount} / 60
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          {/* 怪兽 */}
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-amber-600 shrink-0" />
            <span>怪兽 {stats.monsterCount}</span>
          </span>

          {/* 魔法 */}
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-emerald-600 shrink-0" />
            <span>魔法 {stats.spellCount}</span>
          </span>

          {/* 陷阱 */}
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-rose-600 shrink-0" />
            <span>陷阱 {stats.trapCount}</span>
          </span>
        </div>
      </div>

      {/* 额外与副卡组统计 */}
      <div className="flex items-center gap-4 text-[11px]">
        {/* 额外卡组 */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">额外</span>
          <span
            className={
              stats.extraCount <= 15
                ? 'text-foreground font-mono font-bold'
                : 'text-rose-500 font-mono font-bold'
            }
          >
            {stats.extraCount} / 15
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {stats.fusionCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                <span>{stats.fusionCount}</span>
              </span>
            )}
            {stats.synchroCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-100" />
                <span>{stats.synchroCount}</span>
              </span>
            )}
            {stats.xyzCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-600" />
                <span>{stats.xyzCount}</span>
              </span>
            )}
            {stats.linkCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>{stats.linkCount}</span>
              </span>
            )}
          </div>
        </div>

        {/* 副卡组 */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-foreground">副卡组</span>
          <span className="font-mono text-muted-foreground">{stats.sideCount} / 15</span>
        </div>
      </div>
    </div>
  )
}
