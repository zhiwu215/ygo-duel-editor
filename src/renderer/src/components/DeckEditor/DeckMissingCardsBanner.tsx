import React from 'react'
import { MISSING_CARD_NAME } from '@shared/index'
import { AlertTriangle } from 'lucide-react'

const VISIBLE_CODE_LIMIT = 4

export const DeckMissingCardsBanner: React.FC<{ codes: number[] }> = ({ codes }) => {
  if (codes.length === 0) return null

  const shown = codes.slice(0, VISIBLE_CODE_LIMIT).join('、')
  const suffix = codes.length > VISIBLE_CODE_LIMIT ? ' 等' : ''

  return (
    <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] leading-tight text-amber-700 dark:text-amber-300">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span className="min-w-0">
        有 {codes.length} 张卡片（{shown}
        {suffix}）不在当前卡库中，已用「{MISSING_CARD_NAME}」代替；请更新卡库或移除这些卡片
      </span>
    </div>
  )
}
