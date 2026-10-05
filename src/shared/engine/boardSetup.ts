import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'
import { AgentBoardCardFacing, AgentBoardZone } from '../types/ipc'

/**
 * AI 场面布局提案的区域 / 表示形式映射表
 *
 * 模型侧只用字符串枚举（`MZONE` / `FACEUP_DEFENSE`），
 * 主进程收到后再经这里转成 ocgcore 的数字常量。
 * 单独抽一层是为了让「模型填错值」在预览阶段就暴露成一条 warning，
 * 而不是带着垃圾值写进决斗场。
 */

/** 可落位区域 → CardLocation */
export const AGENT_BOARD_ZONE_TO_LOCATION: Record<AgentBoardZone, number> = {
  MZONE: CardLocation.MZONE,
  SZONE: CardLocation.SZONE,
  HAND: CardLocation.HAND,
  GRAVE: CardLocation.GRAVE,
  DECK: CardLocation.DECK,
  EXTRA: CardLocation.EXTRA,
  REMOVED: CardLocation.REMOVED
}

/** 可落位区域的中文名（预览展示用） */
export const AGENT_BOARD_ZONE_NAMES: Record<AgentBoardZone, string> = {
  MZONE: '怪兽区',
  SZONE: '魔陷区',
  HAND: '手牌',
  GRAVE: '墓地',
  DECK: '主卡组',
  EXTRA: '额外卡组',
  REMOVED: '除外区'
}

/** 表示形式 → CardPosition */
export const AGENT_BOARD_FACING_TO_POSITION: Record<AgentBoardCardFacing, number> = {
  FACEUP_ATTACK: CardPosition.FACEUP_ATTACK,
  FACEUP_DEFENSE: CardPosition.FACEUP_DEFENSE,
  FACEDOWN: CardPosition.FACEDOWN,
  FACEUP: CardPosition.FACEUP
}

/** 表示形式的中文名（预览展示用） */
export const AGENT_BOARD_FACING_NAMES: Record<AgentBoardCardFacing, string> = {
  FACEUP_ATTACK: '表侧攻击',
  FACEUP_DEFENSE: '表侧守备',
  FACEDOWN: '里侧盖放',
  FACEUP: '表侧表示'
}

/** 离散格子区域的合法序号上界（含） */
const DISCRETE_ZONE_MAX_SEQUENCE: Partial<Record<AgentBoardZone, number>> = {
  MZONE: 4,
  SZONE: 4
}

/** 该区域是否为「逐格摆放」的离散区域（其余为按顺序追加的堆叠区） */
export function isDiscreteAgentZone(zone: AgentBoardZone): boolean {
  return DISCRETE_ZONE_MAX_SEQUENCE[zone] !== undefined
}

/**
 * 校验并归一化模型填写的区域 / 序号 / 表示形式
 *
 * @returns 归一化后的取值；出现无法识别的取值时返回 `ok: false` 与原因，
 *   调用方应把原因收进提案的 warnings 让用户在预览里看到，而不是静默丢弃。
 */
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
