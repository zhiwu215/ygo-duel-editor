import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'
import { DuelStep, LightweightCardSnapshot } from '../types/story'
import { AgentStepProposal } from '../types/ipc'

/**
 * 台本步骤的轻量盘面重放器
 *
 * AI 转写 / 推演产生的步骤只有叙事级信息（动作类型 + 卡密/卡名），没有
 * 逐步盘面快照；而「上一步 / 下一步」回放（previewStepBoard）依赖每步
 * boardAfter 才能把场面跟着时间线推进。这里从开局布局出发，按动作类型
 * 的**常见语义**对卡片位置做确定性变换，为每一步补出快照。
 *
 * 定位（这是创作演示工具，不是裁判引擎）：
 * - 只解释「卡片落场 / 移动 / 离场」这类有明确位置语义的动作；
 * - 对白、宣言、连锁、阶段切换等不改变卡片位置，快照沿用上一步；
 * - 卡片定位不到时安静沿用上一步（转写起点允许不完美，用户可在台本中修正），
 *   不产生 warning 噪音。
 *
 * 纯函数、平台无关（@shared），供渲染层在导入提案时调用。
 */

/** 按动作类型推断的目标区域与表示形式（step.toLocation 显式给出时优先） */
const STEP_TARGET: Partial<
  Record<DuelStep['actionType'], { zone: number; position?: number; fromPileOnly?: boolean }>
> = {
  NORMAL_SUMMON: { zone: CardLocation.MZONE, position: CardPosition.FACEUP_ATTACK },
  SPECIAL_SUMMON: { zone: CardLocation.MZONE, position: CardPosition.FACEUP_ATTACK },
  FLIP_SUMMON: { zone: CardLocation.MZONE, position: CardPosition.FACEUP_ATTACK },
  XYZ_SUMMON: { zone: CardLocation.MZONE, position: CardPosition.FACEUP_ATTACK },
  SET_MONSTER: { zone: CardLocation.MZONE, position: CardPosition.FACEDOWN_DEFENSE },
  SET_SPELL_TRAP: { zone: CardLocation.SZONE, position: CardPosition.FACEDOWN },
  SET_PENDULUM: { zone: CardLocation.SZONE, position: CardPosition.FACEUP },
  ACTIVATE_FIELD: { zone: CardLocation.SZONE, position: CardPosition.FACEUP },
  SEARCH: { zone: CardLocation.HAND, fromPileOnly: true },
  SEND_TO_GRAVE: { zone: CardLocation.GRAVE, fromPileOnly: true },
  SALVAGE: { zone: CardLocation.HAND },
  TO_HAND: { zone: CardLocation.HAND },
  TO_GRAVE: { zone: CardLocation.GRAVE },
  BANISH: { zone: CardLocation.REMOVED },
  TO_DECK: { zone: CardLocation.DECK }
}

function cloneSnap(cards: LightweightCardSnapshot[]): LightweightCardSnapshot[] {
  return cards.map((c) => ({
    ...c,
    overlayMaterials: [...c.overlayMaterials]
  }))
}

/** 该区域是否为按顺序追加的堆叠区（手牌/卡组/墓地等） */
function isPileZone(location: number): boolean {
  return (
    location === CardLocation.HAND ||
    location === CardLocation.GRAVE ||
    location === CardLocation.DECK ||
    location === CardLocation.EXTRA ||
    location === CardLocation.REMOVED
  )
}

/**
 * 在盘面中定位步骤涉及的卡片
 *
 * 只按卡密定位（调用方在解析提案时已用卡库把卡名反查成卡密；
 * 轻量快照本身不带卡名）。优先「来源区域 + 卡密」，其次全场卡密；
 * 未知指代（code 0 / 缺卡密）定位不到，安静沿用上一步。
 */
function locateCard(
  board: LightweightCardSnapshot[],
  step: AgentStepProposal
): LightweightCardSnapshot | null {
  if (!step.cardCode || step.cardCode <= 0) return null
  const byCodeFrom =
    step.fromLocation !== undefined
      ? board.find((c) => c.code === step.cardCode && c.location === step.fromLocation)
      : undefined
  return byCodeFrom ?? board.find((c) => c.code === step.cardCode) ?? null
}

/** 把一张卡移动到目标区域（堆叠区追加序号，离散区占格并顶掉旧卡） */
function moveCardInBoard(
  board: LightweightCardSnapshot[],
  card: LightweightCardSnapshot,
  toZone: number,
  toSequence: number | undefined,
  toPosition: number | undefined
): void {
  const rest = board.filter((c) => c !== card)
  const moved: LightweightCardSnapshot = {
    ...card,
    location: toZone,
    position: toPosition ?? card.position
  }
  if (isPileZone(toZone)) {
    // 堆叠区：同一控制者（同归属决斗者）内按现有张数追加序号
    const pileSize = rest.filter(
      (c) =>
        c.controller === moved.controller &&
        c.location === toZone &&
        c.duelistId === moved.duelistId
    ).length
    moved.sequence = pileSize
  } else {
    // 离散格子：目标格上的旧卡被顶掉（与 addCardToZone 行为一致）
    const seq = toSequence ?? moved.sequence
    moved.sequence = Math.max(0, Math.trunc(seq))
    for (let i = rest.length - 1; i >= 0; i--) {
      const occupant = rest[i]
      if (
        occupant.controller === moved.controller &&
        occupant.location === toZone &&
        occupant.sequence === moved.sequence
      ) {
        rest.splice(i, 1)
      }
    }
  }
  rest.push(moved)
  board.length = 0
  board.push(...rest)
}

/** 解释单个步骤对盘面的影响；无法解释时原样返回 */
function applyStepToBoard(board: LightweightCardSnapshot[], step: AgentStepProposal): void {
  // 抽卡：从该方卡组顶移入手牌（转写步骤通常只给卡密，不管 fromLocation）
  if (step.actionType === 'DRAW') {
    const handCards = board.filter(
      (c) => c.controller === step.actionPlayer && c.location === CardLocation.HAND
    )
    if (step.cardCode && step.cardCode > 0 && !handCards.some((c) => c.code === step.cardCode)) {
      const deckCards = board.filter(
        (c) => c.controller === step.actionPlayer && c.location === CardLocation.DECK
      )
      const top = deckCards.reduce<LightweightCardSnapshot | null>(
        (acc, c) => (!acc || c.sequence > acc.sequence ? c : acc),
        null
      )
      if (top) {
        moveCardInBoard(board, top, CardLocation.HAND, undefined, CardPosition.FACEDOWN)
        return
      }
      // 卡组里没有可抽的实体卡：造一张只有卡密的手牌空壳（与未知盖卡同路）
      board.push({
        instanceId: `replay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        code: step.cardCode,
        controller: step.actionPlayer,
        owner: step.actionPlayer,
        location: CardLocation.HAND,
        sequence: handCards.length,
        position: CardPosition.FACEDOWN,
        overlayMaterials: []
      })
    }
    return
  }

  const explicitZone = step.toLocation
  const inferred = STEP_TARGET[step.actionType]
  const target = explicitZone !== undefined ? { zone: explicitZone } : inferred
  if (!target || !target.zone) return

  const card = locateCard(board, step)
  if (!card) return
  moveCardInBoard(board, card, target.zone, step.toSequence, inferred?.position)
}

/**
 * 为步骤序列补出每步执行后的盘面快照
 *
 * @param initial 开局布局快照（applyBoardSetup 落盘后的 createLightweightSnapshot 结果）
 * @param steps AI 提案映射成的步骤草稿
 * @returns 补齐 boardAfter 的步骤数组（每步都带，供 previewStepBoard 逐帧还原）
 */
export function replayStepsBoard(
  initial: LightweightCardSnapshot[],
  steps: DuelStep[]
): DuelStep[] {
  let board = cloneSnap(initial)
  return steps.map((step) => {
    applyStepToBoard(board, step)
    board = cloneSnap(board)
    return { ...step, boardAfter: board }
  })
}
