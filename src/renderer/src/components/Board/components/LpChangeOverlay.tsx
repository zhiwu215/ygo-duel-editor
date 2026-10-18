import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useDuelStore, LpFlash } from '../../../stores/useDuelStore'
import { cn } from '../../../lib/utils'

const FLASH_DURATION = 900
const MAX_VISIBLE = 3

export const LpChangeOverlay: React.FC = () => {
  const [items, setItems] = useState<LpFlash[]>([])
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    const timers = timersRef.current
    const unsubscribe = useDuelStore.subscribe((state, prev) => {
      const flash = state.lpFlash
      if (!flash || flash === prev.lpFlash) return
      setItems((prevItems) =>
        [...prevItems.filter((item) => item.id !== flash.id), flash].slice(-MAX_VISIBLE)
      )
      const timer = setTimeout(() => {
        timers.delete(timer)
        setItems((prevItems) => prevItems.filter((item) => item.id !== flash.id))
      }, FLASH_DURATION)
      timers.add(timer)
    })
    return () => {
      unsubscribe()
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="absolute inset-0 z-[45] pointer-events-none select-none overflow-hidden">
      {items.map((item) => {
        const isOpponent = item.player === 1
        const damage = item.delta < 0
        return (
          <div key={item.id} className="absolute inset-0">
            {damage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.45, times: [0, 0.15, 0.35, 1], ease: 'easeOut' }}
                className={cn(
                  'absolute inset-x-0 h-1/2',
                  isOpponent
                    ? 'top-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,39,39,0.32),transparent_70%)]'
                    : 'bottom-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,39,39,0.32),transparent_70%)]'
                )}
              />
            )}
            <div
              className={cn(
                'absolute left-1/2 -translate-x-1/2',
                isOpponent ? 'top-[clamp(48px,12vh,120px)]' : 'bottom-[clamp(48px,12vh,120px)]'
              )}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.2, 1.08, 1, 1], y: [0, 0, 0, -26] }}
                transition={{ duration: 0.9, times: [0, 0.18, 0.65, 1], ease: 'easeOut' }}
                className={cn(
                  'font-black tabular-nums leading-none whitespace-nowrap text-[clamp(36px,5vw,64px)]',
                  '[text-shadow:0_2px_3px_#000,0_0_20px_currentColor]',
                  damage ? 'text-rose-500' : 'text-emerald-400'
                )}
              >
                {damage ? '−' : '+'}
                {Math.abs(item.delta)}
              </motion.div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
