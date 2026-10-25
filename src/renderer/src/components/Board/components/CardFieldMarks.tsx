import React from 'react'
import equipTexture from '../../../assets/textures/equip.png'
import targetTexture from '../../../assets/textures/target.png'

export type CardFieldMark = 'target' | 'equip'

const MARK_TEXTURES: Record<CardFieldMark, string> = {
  equip: equipTexture,
  target: targetTexture
}

interface CardFieldMarksProps {
  mark: CardFieldMark
}

export const CardFieldMarks: React.FC<CardFieldMarksProps> = ({ mark }) => (
  <img
    src={MARK_TEXTURES[mark]}
    alt=""
    className="pointer-events-none absolute inset-0 z-20 m-auto h-[40%] w-[40%] object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
  />
)
