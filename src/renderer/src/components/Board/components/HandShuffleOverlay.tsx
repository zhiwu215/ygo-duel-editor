import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Shuffle } from 'lucide-react'

export const HandShuffleOverlay: React.FC<{ active: boolean }> = ({ active }) => (
  <AnimatePresence>
    {active && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none"
      >
        <motion.span
          initial={{ scale: 0.75, y: 6 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-500/95 px-3 py-1 text-[11px] font-bold text-white shadow-lg"
        >
          <motion.span
            animate={{ rotate: [0, 16, -16, 0] }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            <Shuffle className="h-3.5 w-3.5" />
          </motion.span>
          手牌切洗
        </motion.span>
      </motion.div>
    )}
  </AnimatePresence>
)
