import { DuelPhase, DuelActionType, ACTION_TYPE_NAMES } from '../types/story'
import { AgentStepProposal, AgentBoardZone } from '../types/ipc'
import { AGENT_BOARD_ZONE_TO_LOCATION } from './boardSetup'

/**
 * AI 决斗步骤提案的归一化层
 *
 * 面向「小说文本转写」场景：模型整理小说里的对局时会写出中文动作词
 * （「召唤」「盖卡」）、大小写混排的阶段缩写等，直接 `as DuelActionType`
 * 会把垃圾值静默带进台本。这里统一收口：
 * - 能明确映射的容错归一化（别名表）；
 * - 映射不到的返回 `ok: false` 与面向模型的报错文案，由调用方拼进
 *   工具返回值让模型下一批自我修正（对齐 opencode 的 InvalidArgumentsError
 *   文案思路：错误信息本身就是「请重写输入」的提示）。
 */

/** 由 ACTION_TYPE_NAMES 生成的枚举名索引（保持单一事实来源） */
const DUEL_ACTION_TYPE_KEYS: Record<string, true> = Object.fromEntries(
  (Object.keys(ACTION_TYPE_NAMES) as DuelActionType[]).map((k) => [k, true as const])
)

/**
 * 阶段别名 → DuelPhase
 * 查表前会做 trim + 去分隔符 + 大写归一，因此「m1」「bp.」这类写法也能命中
 */
const PHASE_ALIASES: Record<string, DuelPhase> = {
  DP: 'DP',
  SP: 'SP',
  M1: 'M1',
  BP: 'BP',
  M2: 'M2',
  EP: 'EP',
  DRAWPHASE: 'DP',
  STANDBYPHASE: 'SP',
  MAINPHASE1: 'M1',
  MAINPHASE: 'M1',
  MAIN: 'M1',
  BATTLEPHASE: 'BP',
  MAINPHASE2: 'M2',
  ENDPHASE: 'EP'
}

/**
 * 动作别名 → DuelActionType
 * 覆盖模型在转写小说时最常写出的中文词；裸「召唤」归入 SPECIAL_SUMMON
 * （小说语境的出场演出绝大多数是特殊召唤，通常召唤会写全称）
 */
const ACTION_TYPE_ALIASES: Record<string, DuelActionType> = {
  DRAW: 'DRAW',
  抽卡: 'DRAW',
  抽牌: 'DRAW',
  摸牌: 'DRAW',
  SEARCH: 'SEARCH',
  检索: 'SEARCH',
  搜索: 'SEARCH',
  SALVAGE: 'SALVAGE',
  回收: 'SALVAGE',
  取回: 'SALVAGE',
  NORMAL_SUMMON: 'NORMAL_SUMMON',
  通常召唤: 'NORMAL_SUMMON',
  上级召唤: 'NORMAL_SUMMON',
  SPECIAL_SUMMON: 'SPECIAL_SUMMON',
  特殊召唤: 'SPECIAL_SUMMON',
  特召: 'SPECIAL_SUMMON',
  召唤: 'SPECIAL_SUMMON',
  FLIP_SUMMON: 'FLIP_SUMMON',
  反转召唤: 'FLIP_SUMMON',
  XYZ_SUMMON: 'XYZ_SUMMON',
  XYZ召唤: 'XYZ_SUMMON',
  超量召唤: 'XYZ_SUMMON',
  DETACH_MATERIAL: 'DETACH_MATERIAL',
  取除素材: 'DETACH_MATERIAL',
  解除超量: 'DETACH_MATERIAL',
  SET_MONSTER: 'SET_MONSTER',
  盖放怪兽: 'SET_MONSTER',
  盖怪: 'SET_MONSTER',
  设置怪兽: 'SET_MONSTER',
  SET_SPELL_TRAP: 'SET_SPELL_TRAP',
  盖放魔陷: 'SET_SPELL_TRAP',
  盖卡: 'SET_SPELL_TRAP',
  盖放卡: 'SET_SPELL_TRAP',
  设置魔陷: 'SET_SPELL_TRAP',
  ACTIVATE: 'ACTIVATE',
  发动: 'ACTIVATE',
  发动效果: 'ACTIVATE',
  ACTIVATE_FIELD: 'ACTIVATE_FIELD',
  发动场地: 'ACTIVATE_FIELD',
  SET_PENDULUM: 'SET_PENDULUM',
  设置灵摆: 'SET_PENDULUM',
  灵摆设置: 'SET_PENDULUM',
  ATTACK: 'ATTACK',
  攻击: 'ATTACK',
  攻击宣言: 'ATTACK',
  进攻: 'ATTACK',
  TO_GRAVE: 'TO_GRAVE',
  送墓: 'TO_GRAVE',
  送去墓地: 'TO_GRAVE',
  送入墓地: 'TO_GRAVE',
  破坏: 'TO_GRAVE',
  SEND_TO_GRAVE: 'SEND_TO_GRAVE',
  堆墓: 'SEND_TO_GRAVE',
  卡组堆墓: 'SEND_TO_GRAVE',
  BANISH: 'BANISH',
  除外: 'BANISH',
  放逐: 'BANISH',
  TO_HAND: 'TO_HAND',
  弹回: 'TO_HAND',
  加入手牌: 'TO_HAND',
  TO_DECK: 'TO_DECK',
  回卡组: 'TO_DECK',
  返回卡组: 'TO_DECK',
  洗回卡组: 'TO_DECK',
  CHANGE_POS: 'CHANGE_POS',
  变更表示形式: 'CHANGE_POS',
  改变表示形式: 'CHANGE_POS',
  变守备: 'CHANGE_POS',
  变攻击: 'CHANGE_POS',
  DAMAGE: 'DAMAGE',
  伤害: 'DAMAGE',
  受到伤害: 'DAMAGE',
  扣血: 'DAMAGE',
  RECOVER: 'RECOVER',
  回复: 'RECOVER',
  生命回复: 'RECOVER',
  回血: 'RECOVER',
  CHAIN: 'CHAIN',
  连锁: 'CHAIN',
  RESOLVE_CHAIN: 'RESOLVE_CHAIN',
  连锁结算: 'RESOLVE_CHAIN',
  结算: 'RESOLVE_CHAIN',
  PHASE_CHANGE: 'PHASE_CHANGE',
  阶段切换: 'PHASE_CHANGE',
  进入阶段: 'PHASE_CHANGE',
  TURN_CHANGE: 'TURN_CHANGE',
  回合切换: 'TURN_CHANGE',
  DIALOGUE: 'DIALOGUE',
  对白: 'DIALOGUE',
  台词: 'DIALOGUE',
  旁白: 'DIALOGUE',
  解说: 'DIALOGUE',
  宣言: 'DIALOGUE'
}

/** 归一化成功：step 为可用提案；note 是降级说明（进了提案但不完全按原样） */
export interface AgentStepNormalizeOk {
  ok: true
  step: AgentStepProposal
  note?: string
}

/** 归一化失败：error 是面向模型的修正提示 */
export interface AgentStepNormalizeFail {
  ok: false
  error: string
}

/** 原文摘句上限：太长会把提案卡撑爆，核对只需要定位用的短句 */
const MAX_SOURCE_QUOTE_LENGTH = 80

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/**
 * 区域取值归一：接受区域字符串枚举（模型侧惯例），也宽容直接的
 * CardLocation 数字掩码；两者都识别不了返回 undefined
 */
function resolveZone(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const key = value.trim().toUpperCase()
    if (key in AGENT_BOARD_ZONE_TO_LOCATION) {
      return AGENT_BOARD_ZONE_TO_LOCATION[key as AgentBoardZone]
    }
  }
  return undefined
}

/** 阶段缩写归一；无法识别返回 null（时序字段错值会带乱整个时间线，不做静默降级） */
export function normalizeAgentDuelPhase(raw: unknown): DuelPhase | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[.\s·、-]/g, '')
  return PHASE_ALIASES[cleaned] ?? null
}

/** 动作类型归一：先精确匹配枚举名，再查中文别名表 */
export function normalizeAgentDuelActionType(raw: unknown): DuelActionType | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.trim()
  if (!cleaned) return null
  const upper = cleaned.toUpperCase().replace(/[\s-]/g, '_')
  if (DUEL_ACTION_TYPE_KEYS[upper]) return upper as DuelActionType
  return ACTION_TYPE_ALIASES[cleaned] ?? ACTION_TYPE_ALIASES[upper] ?? null
}

/**
 * 归一化模型提交的单个决斗步骤提案
 *
 * @param input 模型填写的原始参数（未校验，字段可能是任意类型）
 */
export function normalizeAgentStepProposal(
  input: unknown
): AgentStepNormalizeOk | AgentStepNormalizeFail {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '步骤必须是对象' }
  }
  const raw = input as Record<string, unknown>
  const notes: string[] = []
  const hint = cleanText(raw.cardName) ? `【${cleanText(raw.cardName)}】` : ''

  const turnNum = toFiniteNumber(raw.turn)
  if (turnNum === undefined || turnNum < 1) {
    return { ok: false, error: `步骤${hint}缺少有效的回合数 turn（从 1 开始）` }
  }

  const phase = normalizeAgentDuelPhase(raw.phase)
  if (!phase) {
    return {
      ok: false,
      error: `步骤${hint}的阶段「${String(raw.phase ?? '')}」无法识别，可用：DP / SP / M1 / BP / M2 / EP`
    }
  }

  const playerNum = toFiniteNumber(raw.actionPlayer)
  if (playerNum === undefined || (playerNum !== 0 && playerNum !== 1)) {
    return { ok: false, error: `步骤${hint}缺少有效的行动方 actionPlayer（0 我方 / 1 对方）` }
  }

  let actionType = normalizeAgentDuelActionType(raw.actionType)
  const dialogue = cleanText(raw.dialogue)
  const speaker = cleanText(raw.speaker)
  if (!actionType) {
    if (dialogue || speaker) {
      actionType = 'DIALOGUE'
      notes.push(`动作类型「${String(raw.actionType ?? '')}」无法识别，已按对白处理`)
    } else {
      return {
        ok: false,
        error: `步骤${hint}的动作类型「${String(raw.actionType ?? '')}」无法识别：请从协议枚举中选择（如 NORMAL_SUMMON / ATTACK / ACTIVATE / DIALOGUE）`
      }
    }
  }

  const cardCode = toFiniteNumber(raw.cardCode)
  const chainIndex = toFiniteNumber(raw.chainIndex)
  let lpChange: AgentStepProposal['lpChange']
  if (raw.lpChange && typeof raw.lpChange === 'object') {
    const lp = raw.lpChange as Record<string, unknown>
    const lpPlayer = toFiniteNumber(lp.player)
    const oldLp = toFiniteNumber(lp.oldLp)
    const newLp = toFiniteNumber(lp.newLp)
    if (lpPlayer !== undefined && oldLp !== undefined && newLp !== undefined) {
      lpChange = {
        player: (lpPlayer === 1 ? 1 : 0) as 0 | 1,
        oldLp: Math.trunc(oldLp),
        newLp: Math.trunc(newLp)
      }
    }
  }

  const rawQuote = cleanText(raw.sourceQuote)
  if (rawQuote && rawQuote.length > MAX_SOURCE_QUOTE_LENGTH) {
    notes.push(`原文摘句超出 ${MAX_SOURCE_QUOTE_LENGTH} 字，已截断`)
  }

  return {
    ok: true,
    step: {
      turn: Math.trunc(turnNum),
      phase,
      actionPlayer: (playerNum === 1 ? 1 : 0) as 0 | 1,
      actionType,
      cardCode: cardCode !== undefined && cardCode > 0 ? Math.trunc(cardCode) : undefined,
      cardName: cleanText(raw.cardName),
      speaker,
      dialogue,
      innerThoughts: cleanText(raw.innerThoughts),
      description: cleanText(raw.description),
      chainIndex: chainIndex !== undefined && chainIndex > 0 ? Math.trunc(chainIndex) : undefined,
      fromLocation: resolveZone(raw.fromLocation),
      toLocation: resolveZone(raw.toLocation),
      toSequence: toFiniteNumber(raw.toSequence),
      sourceQuote: rawQuote ? rawQuote.slice(0, MAX_SOURCE_QUOTE_LENGTH) : undefined,
      lpChange
    },
    note: notes.length > 0 ? notes.join('；') : undefined
  }
}
