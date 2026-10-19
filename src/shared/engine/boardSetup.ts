import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'
import { AgentBoardCardFacing, AgentBoardZone } from '../types/ipc'

export const AGENT_BOARD_ZONE_TO_LOCATION: Record<AgentBoardZone, number> = {
  MZONE: CardLocation.MZONE,
  SZONE: CardLocation.SZONE,
  HAND: CardLocation.HAND,
  GRAVE: CardLocation.GRAVE,
  DECK: CardLocation.DECK,
  EXTRA: CardLocation.EXTRA,
  REMOVED: CardLocation.REMOVED
}
export const AGENT_BOARD_ZONE_NAMES: Record<AgentBoardZone, string> = {
  MZONE: '怪兽区',
  SZONE: '魔陷区',
  HAND: '手牌',
  GRAVE: '墓地',
  DECK: '主卡组',
  EXTRA: '额外卡组',
  REMOVED: '除外区'
}
export const AGENT_BOARD_FACING_TO_POSITION: Record<AgentBoardCardFacing, number> = {
  FACEUP_ATTACK: CardPosition.FACEUP_ATTACK,
  FACEUP_DEFENSE: CardPosition.FACEUP_DEFENSE,
  FACEDOWN: CardPosition.FACEDOWN,
  FACEUP: CardPosition.FACEUP
}
export const AGENT_BOARD_FACING_NAMES: Record<AgentBoardCardFacing, string> = {
  FACEUP_ATTACK: '表侧攻击',
  FACEUP_DEFENSE: '表侧守备',
  FACEDOWN: '里侧盖放',
  FACEUP: '表侧表示'
}
const DISCRETE_ZONE_MAX_SEQUENCE: Partial<Record<AgentBoardZone, number>> = {
  MZONE: 4,
  SZONE: 4
}
export function normalizeAgentBoardPlacement(input: {
  location?: string
  sequence?: number
  position?: string
}): {
  ok: boolean
  zone?: AgentBoardZone
  sequence?: number
  facing?: AgentBoardCardFacing
  reason?: string
} {
  const zoneRaw = (input.location ?? '').trim().toUpperCase()
  if (!zoneRaw) return { ok: false, reason: '缺少区域 location' }
  if (!(zoneRaw in AGENT_BOARD_ZONE_TO_LOCATION)) {
    return {
      ok: false,
      reason: `无法识别的区域「${input.location}」，可选：${Object.keys(AGENT_BOARD_ZONE_TO_LOCATION).join(' / ')}`
    }
  }
  const zone = zoneRaw as AgentBoardZone

  const maxSeq = DISCRETE_ZONE_MAX_SEQUENCE[zone]
  const seqRaw = input.sequence
  const sequence = typeof seqRaw === 'number' && Number.isFinite(seqRaw) ? Math.trunc(seqRaw) : 0
  if (maxSeq !== undefined && (sequence < 0 || sequence > maxSeq)) {
    return {
      ok: false,
      zone,
      reason: `${AGENT_BOARD_ZONE_NAMES[zone]}序号越界：${sequence}（合法 0~${maxSeq}）`
    }
  }

  let facing: AgentBoardCardFacing | undefined
  const posRaw = (input.position ?? '').trim().toUpperCase()
  if (posRaw) {
    if (!(posRaw in AGENT_BOARD_FACING_TO_POSITION)) {
      return {
        ok: false,
        zone,
        reason: `无法识别的表示形式「${input.position}」，可选：${Object.keys(AGENT_BOARD_FACING_TO_POSITION).join(' / ')}`
      }
    }
    facing = posRaw as AgentBoardCardFacing
  }

  return { ok: true, zone, sequence, facing }
}
