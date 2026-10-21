import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  type LucideIcon
} from 'lucide-react'

export const LINK_MARKER_ICONS: Record<number, LucideIcon> = {
  0x40: ArrowUpLeft,
  0x80: ArrowUp,
  0x100: ArrowUpRight,
  0x08: ArrowLeft,
  0x20: ArrowRight,
  0x01: ArrowDownLeft,
  0x02: ArrowDown,
  0x04: ArrowDownRight
}
