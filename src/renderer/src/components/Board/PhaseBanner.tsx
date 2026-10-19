import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PHASE_SHORT_NAMES } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { resolveTeamLabel } from '../../utils/duelistNames'
import { cn } from '../../lib/utils'

const BANNER_DURATION = 1200

export const PhaseBanner: React.FC = () => {
  const currentTurn = useDuelStore((s) => s.currentTurn)
  const activeTurnPlayer = useDuelStore((s) => s.activeTurnPlayer)
  const currentPhase = useDuelStore((s) => s.currentPhase)
  const duelists = useDuelStore((s) => s.state.duelists)
  const [visible, setVisible] = useState(false)
  const signatureRef = useRef(`${currentTurn}|${activeTurnPlayer}|${currentPhase}`)

  useEffect(() => {
    const signature = `${currentTurn}|${activeTurnPlayer}|${currentPhase}`
    if (signatureRef.current === signature) return
    signatureRef.current = signature
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), BANNER_DURATION)
    return () => clearTimeout(timer)
  }, [currentTurn, activeTurnPlayer, currentPhase])

  const isSelfTurn = activeTurnPlayer === 0
  const turnLabel = resolveTeamLabel({ duelists }, activeTurnPlayer, currentTurn)

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl border-2 px-7 py-2 shadow-2xl backdrop-blur-md',
              isSelfTurn
                ? 'border-blue-500/70 bg-blue-50/95 text-blue-700 dark:border-blue-400/70 dark:bg-blue-950/85 dark:text-blue-100'
                : 'border-rose-500/70 bg-rose-50/95 text-rose-700 dark:border-rose-400/70 dark:bg-rose-950/85 dark:text-rose-100'
            )}
          >
            <span className="text-[11px] font-bold tracking-wider">
              第 {currentTurn} 回合 · {turnLabel}的回合
            </span>
            <span className="text-[30px] font-black leading-none tracking-wide">
              {PHASE_SHORT_NAMES[currentPhase] || currentPhase}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
