import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TOSS_LABELS, formatTossFaces } from '@shared/index'
import { useDuelEngineStore } from '../../../stores/useDuelEngineStore'

export const TossResultOverlay: React.FC = () => {
  const effect = useDuelEngineStore((s) => s.stepEffects[0] ?? null)
  const toss = effect?.kind === 'toss' ? effect : null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[36%] z-[44] flex justify-center select-none">
      <AnimatePresence mode="wait">
        {toss && (
          <motion.div
            key={toss.id}
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex w-[min(460px,82%)] items-baseline justify-center rounded-md border border-white/25 bg-[#9699ca]/95 px-6 py-2.5 shadow-[0_4px_18px_rgba(20,16,60,0.35)] backdrop-blur-sm"
          >
            <span className="text-[17px] font-medium tracking-wide text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
              {TOSS_LABELS[toss.type]}
            </span>
            <span className="text-[20px] font-black tracking-wide text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
              {formatTossFaces(toss.type, toss.results)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
