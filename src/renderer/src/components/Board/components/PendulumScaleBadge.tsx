import React from 'react'
import type { PendulumScaleDisplay } from '../../../utils/pendulumScale'
import blueDigits from '../../../assets/card/pendulum/scale-digits-blue.png'
import redDigits from '../../../assets/card/pendulum/scale-digits-red.png'

const DIGIT_CELLS = 10
const SINGLE_DIGIT_SIZE = 34
const PAIRED_DIGIT_SIZE = 26

const toDigits = (value: number): number[] =>
  value >= 10 ? [Math.floor(value / 10), value % 10] : [value]

const digitStyle = (sheet: string, digit: number, size: number): React.CSSProperties => ({
  width: size,
  height: size,
  backgroundImage: `url(${sheet})`,
  backgroundSize: `${DIGIT_CELLS * 100}% 100%`,
  backgroundPosition: `${(digit / (DIGIT_CELLS - 1)) * 100}% 0`,
  backgroundRepeat: 'no-repeat'
})

export const PendulumScaleBadge: React.FC<{ scale: PendulumScaleDisplay }> = ({ scale }) => {
  const digits = toDigits(scale.value)
  const sheet = scale.side === 'left' ? blueDigits : redDigits
  const size = digits.length > 1 ? PAIRED_DIGIT_SIZE : SINGLE_DIGIT_SIZE

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-px">
      {digits.map((digit, index) => (
        <span
          key={index}
          className="block shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
          style={digitStyle(sheet, digit, size)}
        />
      ))}
    </div>
  )
}
