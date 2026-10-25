import React, { useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'

interface HandShuffleShakeProps {
  tick: number
  index: number
  children: React.ReactNode
}

export const HandShuffleShake: React.FC<HandShuffleShakeProps> = ({ tick, index, children }) => {
  const controls = useAnimationControls()

  useEffect(() => {
    if (!tick) return
    void controls.start({
      y: [0, -8, 0],
      rotate: [0, index % 2 === 0 ? -2.5 : 2.5, 0],
      transition: { duration: 0.5, delay: index * 0.045, ease: 'easeInOut' }
    })
  }, [tick, index, controls])

  return <motion.div animate={controls}>{children}</motion.div>
}
