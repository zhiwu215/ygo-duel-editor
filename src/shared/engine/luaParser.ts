import { DuelPuzzleState, FieldCard, createInitialDuelState } from '../types/duel'
import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'
import { MasterRule } from '../types/rules'

// 辅助：解析位置数值
function parseLocationValue(raw: string): number {
  const trimmed = raw.trim().toUpperCase()
  if (trimmed.includes('LOCATION_MZONE')) return CardLocation.MZONE
  if (trimmed.includes('LOCATION_SZONE')) return CardLocation.SZONE
  if (trimmed.includes('LOCATION_HAND')) return CardLocation.HAND
  if (trimmed.includes('LOCATION_GRAVE')) return CardLocation.GRAVE
  if (trimmed.includes('LOCATION_REMOVED')) return CardLocation.REMOVED
  if (trimmed.includes('LOCATION_EXTRA')) return CardLocation.EXTRA
  if (trimmed.includes('LOCATION_DECK')) return CardLocation.DECK
  if (trimmed.includes('LOCATION_OVERLAY')) return CardLocation.OVERLAY
  if (trimmed.includes('LOCATION_PZONE')) return CardLocation.PZONE
  if (trimmed.includes('LOCATION_FZONE')) return CardLocation.FZONE

  const num = parseInt(trimmed, 10)
  return isNaN(num) ? CardLocation.MZONE : num
}

// 辅助：解析表示形式数值
function parsePositionValue(raw: string): number {
  const trimmed = raw.trim().toUpperCase()
  if (trimmed.includes('POS_FACEUP_ATTACK')) return CardPosition.FACEUP_ATTACK
  if (trimmed.includes('POS_FACEDOWN_ATTACK')) return CardPosition.FACEDOWN_ATTACK
  if (trimmed.includes('POS_FACEUP_DEFENSE')) return CardPosition.FACEUP_DEFENSE
  if (trimmed.includes('POS_FACEDOWN_DEFENSE')) return CardPosition.FACEDOWN_DEFENSE
  if (trimmed.includes('POS_FACEDOWN')) return CardPosition.FACEDOWN
  if (trimmed.includes('POS_FACEUP')) return CardPosition.FACEUP

  const num = parseInt(trimmed, 10)
  return isNaN(num) ? CardPosition.FACEUP_ATTACK : num
}

/**
 * 解析 Lua 残局脚本字符串，重构成 DuelPuzzleState
 */
export function parseLuaScript(luaContent: string): DuelPuzzleState {
  const state: DuelPuzzleState = createInitialDuelState(5)
  const lines = luaContent.split(/\r?\n/)

  // 1. 匹配 Debug.ReloadFieldBegin
  // 例: Debug.ReloadFieldBegin(DUEL_ATTACK_FIRST_TURN + DUEL_SIMPLE_AI, 5)
  const reloadFieldRegex = /Debug\.ReloadFieldBegin\s*\(([^,)]+)(?:,\s*([^)]+))?\)/i

  // 2. 匹配 Debug.SetPlayerInfo
  // 例: Debug.SetPlayerInfo(0, 8000, 0, 0)
  const playerInfoRegex =
    /Debug\.SetPlayerInfo\s*\(\s*([01])\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i

  // 3. 匹配 Debug.AddCard
  // 例: Debug.AddCard(89631139, 0, 0, LOCATION_MZONE, 2, POS_FACEUP_ATTACK)
  const addCardRegex =
    /Debug\.AddCard\s*\(\s*(\d+)\s*,\s*([01])\s*,\s*([01])\s*,\s*([^,]+)\s*,\s*(\d+)\s*,\s*([^,)]+)\s*\)/i

  // 4. 匹配 Debug.ShowHint
  const hintRegex = /Debug\.ShowHint\s*\(\s*["'](.*)["']\s*\)/i

  // 5. 匹配 c:add_counter(0x1, 3)
  const addCounterRegex = /(?:\w+):add_counter\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(\d+)\s*\)/i

  let lastAddedCard: FieldCard | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('--')) continue

    // 匹配 ReloadFieldBegin
    const reloadMatch = trimmed.match(reloadFieldRegex)
    if (reloadMatch) {
      if (reloadMatch[2]) {
        const ruleNum = parseInt(reloadMatch[2].trim(), 10)
        if ([2, 3, 4, 5].includes(ruleNum)) {
          state.masterRule = ruleNum as MasterRule
        }
      }
      continue
    }

    // 匹配 SetPlayerInfo
    const playerMatch = trimmed.match(playerInfoRegex)
    if (playerMatch) {
      const pIdx = parseInt(playerMatch[1], 10) as 0 | 1
      state.players[pIdx].lp = parseInt(playerMatch[2], 10)
      state.players[pIdx].startHand = parseInt(playerMatch[3], 10)
      state.players[pIdx].maxHand = parseInt(playerMatch[4], 10)
      continue
    }

    // 匹配 ShowHint
    const hintMatch = trimmed.match(hintRegex)
    if (hintMatch) {
      state.hint = hintMatch[1]
      continue
    }

    // 匹配 AddCard
    const cardMatch = trimmed.match(addCardRegex)
    if (cardMatch) {
      const code = parseInt(cardMatch[1], 10)
      const owner = parseInt(cardMatch[2], 10) as 0 | 1
      const controller = parseInt(cardMatch[3], 10) as 0 | 1
      const location = parseLocationValue(cardMatch[4])
      const sequence = parseInt(cardMatch[5], 10)
      const position = parsePositionValue(cardMatch[6])

      // 如果是超量素材 (LOCATION_OVERLAY)，将其附加给对应怪兽
      if (location === CardLocation.OVERLAY) {
        const hostMonster = state.cards.find(
          (c) =>
            c.controller === controller &&
            c.location === CardLocation.MZONE &&
            c.sequence === sequence
        )
        if (hostMonster) {
          hostMonster.overlayMaterials.push(code)
        }
      } else {
        const fieldCard: FieldCard = {
          instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          code,
          owner,
          controller,
          location,
          sequence,
          position,
          overlayMaterials: [],
          counters: {}
        }
        state.cards.push(fieldCard)
        lastAddedCard = fieldCard
      }
      continue
    }

    // 匹配 c:add_counter
    const counterMatch = trimmed.match(addCounterRegex)
    if (counterMatch && lastAddedCard) {
      const typeStr = counterMatch[1].trim()
      const typeNum =
        typeStr.startsWith('0x') || typeStr.startsWith('0X')
          ? parseInt(typeStr, 16)
          : parseInt(typeStr, 10)
      const count = parseInt(counterMatch[2], 10)
      if (!lastAddedCard.counters) {
        lastAddedCard.counters = {}
      }
      lastAddedCard.counters[typeNum] = (lastAddedCard.counters[typeNum] || 0) + count
      continue
    }
  }

  return state
}
