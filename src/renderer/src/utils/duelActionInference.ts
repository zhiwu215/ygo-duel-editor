import { CardLocation, CardPosition, DuelActionType, DuelPhase } from '@shared/index'

export interface InferMoveActionParams {
  fromLocation: number
  fromSequence: number
  toLocation: number
  toSequence: number
  fromPosition: number
  finalPosition: number
  actionPlayer: 0 | 1
  cardCode?: number
  cardName?: string
  cardType?: number
  currentPhase: DuelPhase
  currentChain: number
}

export interface InferredActionResult {
  actionType: DuelActionType
  description: string
  chainIndex?: number
}

/**
 * 根据卡片移动的源区域、目标区域与最终落子表示形式，精准推断决斗实战动作
 */
export function inferMoveAction(params: InferMoveActionParams): InferredActionResult | null {
  const {
    fromLocation,
    toLocation,
    finalPosition,
    actionPlayer,
    cardName,
    cardCode,
    currentPhase,
    currentChain
  } = params

  // 相同区域内移动且非关键区域转移不记录为对局步骤
  if (fromLocation === toLocation) {
    return null
  }

  const pName = actionPlayer === 0 ? '我方' : '对方'
  const cName = cardName || (cardCode ? String(cardCode) : '卡片')
  const isFacedown = Boolean(finalPosition & CardPosition.FACEDOWN)

  // 1. 手牌 -> 怪兽区
  if (fromLocation === CardLocation.HAND && toLocation === CardLocation.MZONE) {
    if (isFacedown) {
      return {
        actionType: 'SET_MONSTER',
        description: `${pName}里侧盖放怪兽【${cName}】`
      }
    }
    // 表侧召唤：在主阶段默认通常召唤，其余阶段特殊召唤
    if (currentPhase === 'M1' || currentPhase === 'M2') {
      return {
        actionType: 'NORMAL_SUMMON',
        description: `${pName}通常召唤【${cName}】`
      }
    }
    return {
      actionType: 'SPECIAL_SUMMON',
      description: `${pName}特殊召唤【${cName}】`
    }
  }

  // 2. 手牌 -> 魔陷区
  if (fromLocation === CardLocation.HAND && toLocation === CardLocation.SZONE) {
    if (isFacedown) {
      return {
        actionType: 'SET_SPELL_TRAP',
        description: `${pName}覆盖魔陷【${cName}】`
      }
    }
    const nextChain = currentChain + 1
    return {
      actionType: 'ACTIVATE',
      chainIndex: nextChain,
      description: `${pName}发动【${cName}】(Chain ${nextChain})`
    }
  }

  // 3. 手牌 -> 场地魔法区
  if (fromLocation === CardLocation.HAND && toLocation === CardLocation.FZONE) {
    if (isFacedown) {
      return {
        actionType: 'SET_SPELL_TRAP',
        description: `${pName}覆盖场地魔法【${cName}】`
      }
    }
    const nextChain = currentChain + 1
    return {
      actionType: 'ACTIVATE_FIELD',
      chainIndex: nextChain,
      description: `${pName}发动场地魔法【${cName}】(Chain ${nextChain})`
    }
  }

  // 4. 手牌 -> 灵摆区
  if (fromLocation === CardLocation.HAND && toLocation === CardLocation.PZONE) {
    return {
      actionType: 'SET_PENDULUM',
      description: `${pName}设置灵摆刻度【${cName}】`
    }
  }

  // 5. 卡组 -> 手牌 (抽卡 vs 检索)
  if (fromLocation === CardLocation.DECK && toLocation === CardLocation.HAND) {
    if (currentPhase === 'DP') {
      return {
        actionType: 'DRAW',
        description: `${pName}抽卡【${cName}】`
      }
    }
    return {
      actionType: 'SEARCH',
      description: `${pName}检索【${cName}】加入手牌`
    }
  }

  // 6. 墓地 / 除外 -> 手牌 (回收)
  if (
    (fromLocation === CardLocation.GRAVE || fromLocation === CardLocation.REMOVED) &&
    toLocation === CardLocation.HAND
  ) {
    return {
      actionType: 'SALVAGE',
      description: `${pName}回收【${cName}】加入手牌`
    }
  }

  // 7. 额外卡组 / 墓地 / 除外 -> 怪兽区 (特殊召唤)
  if (
    (fromLocation === CardLocation.EXTRA ||
      fromLocation === CardLocation.GRAVE ||
      fromLocation === CardLocation.REMOVED) &&
    toLocation === CardLocation.MZONE
  ) {
    const origin =
      fromLocation === CardLocation.EXTRA
        ? '额外卡组'
        : fromLocation === CardLocation.GRAVE
          ? '墓地'
          : '除外区'
    return {
      actionType: 'SPECIAL_SUMMON',
      description: `${pName}从${origin}特殊召唤【${cName}】`
    }
  }

  // 8. 场上 -> 墓地
  if (
    (fromLocation === CardLocation.MZONE ||
      fromLocation === CardLocation.SZONE ||
      fromLocation === CardLocation.FZONE ||
      fromLocation === CardLocation.PZONE) &&
    toLocation === CardLocation.GRAVE
  ) {
    return {
      actionType: 'TO_GRAVE',
      description: `【${cName}】送去墓地`
    }
  }

  // 9. 卡组 -> 墓地 (堆墓)
  if (fromLocation === CardLocation.DECK && toLocation === CardLocation.GRAVE) {
    return {
      actionType: 'SEND_TO_GRAVE',
      description: `从卡组将【${cName}】送去墓地`
    }
  }

  // 10. 任何非除外区 -> 除外区
  if (fromLocation !== CardLocation.REMOVED && toLocation === CardLocation.REMOVED) {
    return {
      actionType: 'BANISH',
      description: `【${cName}】除外`
    }
  }

  // 11. 场上 -> 手牌 (弹回)
  if (
    (fromLocation === CardLocation.MZONE ||
      fromLocation === CardLocation.SZONE ||
      fromLocation === CardLocation.FZONE ||
      fromLocation === CardLocation.PZONE) &&
    toLocation === CardLocation.HAND
  ) {
    return {
      actionType: 'TO_HAND',
      description: `【${cName}】弹回手牌`
    }
  }

  // 12. 场上 -> 卡组 / 额外
  if (
    (fromLocation === CardLocation.MZONE ||
      fromLocation === CardLocation.SZONE ||
      fromLocation === CardLocation.FZONE ||
      fromLocation === CardLocation.PZONE) &&
    (toLocation === CardLocation.DECK || toLocation === CardLocation.EXTRA)
  ) {
    const dest = toLocation === CardLocation.EXTRA ? '额外卡组' : '主卡组'
    return {
      actionType: 'TO_DECK',
      description: `【${cName}】返回${dest}`
    }
  }

  return null
}

export interface InferPositionChangeParams {
  location: number
  oldPosition: number
  newPosition: number
  actionPlayer: 0 | 1
  cardCode?: number
  cardName?: string
  currentChain: number
}

/**
 * 根据卡片表示形式的变更（如魔陷翻开、怪兽反转召唤、变更攻守），推断实战动作
 */
export function inferPositionChangeAction(
  params: InferPositionChangeParams
): InferredActionResult | null {
  const { location, oldPosition, newPosition, actionPlayer, cardName, cardCode, currentChain } =
    params
  if (oldPosition === newPosition) return null

  const pName = actionPlayer === 0 ? '我方' : '对方'
  const cName = cardName || (cardCode ? String(cardCode) : '卡片')

  // 1. 魔陷区/场地魔法区：里侧盖放 -> 表侧 (翻开发动)
  if (location === CardLocation.SZONE || location === CardLocation.FZONE) {
    const wasFacedown = Boolean(oldPosition & CardPosition.FACEDOWN)
    const isNowFaceup = Boolean(newPosition & CardPosition.FACEUP)
    if (wasFacedown && isNowFaceup) {
      const nextChain = currentChain + 1
      return {
        actionType: 'ACTIVATE',
        chainIndex: nextChain,
        description: `${pName}翻开发动【${cName}】(Chain ${nextChain})`
      }
    }
  }

  // 2. 怪兽区：里侧守备 -> 表侧攻击 (反转召唤)
  if (location === CardLocation.MZONE) {
    const wasFacedownDefense = oldPosition === CardPosition.FACEDOWN_DEFENSE
    const isNowFaceupAttack = newPosition === CardPosition.FACEUP_ATTACK
    if (wasFacedownDefense && isNowFaceupAttack) {
      return {
        actionType: 'FLIP_SUMMON',
        description: `${pName}反转召唤【${cName}】`
      }
    }
    // 表攻 ⇄ 表守
    const wasFaceup = Boolean(oldPosition & CardPosition.FACEUP)
    const isNowFaceup = Boolean(newPosition & CardPosition.FACEUP)
    if (wasFaceup && isNowFaceup) {
      const posName = newPosition === CardPosition.FACEUP_DEFENSE ? '守备表示' : '攻击表示'
      return {
        actionType: 'CHANGE_POS',
        description: `【${cName}】变更表示形式为${posName}`
      }
    }
  }

  return null
}
