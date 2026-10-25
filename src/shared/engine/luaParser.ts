import { DuelPuzzleState, FieldCard } from '../types/duel'
import {
  createInitialDuelState,
  createStandardTagDuelists,
  normalizeDuelState
} from '../types/duelFactory'
import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'
import { MasterRule } from '../types/rules'
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
export function parseLuaScript(luaContent: string): DuelPuzzleState {
  const state: DuelPuzzleState = createInitialDuelState(5)
  const lines = luaContent.split(/\r?\n/)
  const reloadFieldRegex = /Debug\.ReloadFieldBegin\s*\(([^,)]+)(?:,\s*([^)]+))?\)/i
  const playerInfoRegex =
    /Debug\.SetPlayerInfo\s*\(\s*([0-3])\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i
  const addCardRegex =
    /(?:local\s+(\w+)\s*=\s*)?Debug\.AddCard\s*\(\s*(\d+)\s*,\s*([0-3])\s*,\s*([0-3])\s*,\s*([^,]+)\s*,\s*(\d+)\s*,\s*([^,)]+)\s*\)/i
  const hintRegex = /Debug\.ShowHint\s*\(\s*["'](.*)["']\s*\)/i
  const addCounterRegex = /(\w+):AddCounter\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(\d+)\s*\)/

  let isTag = false
  let lastAddedCard: FieldCard | null = null
  const cardByVar = new Map<string, FieldCard>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('-- 决斗标题:')) {
      const parsedTitle = trimmed.replace('-- 决斗标题:', '').trim()
      if (parsedTitle) state.title = parsedTitle
      continue
    }

    if (trimmed.startsWith('-- 工程类型:')) {
      if (trimmed.includes('Combo') || trimmed.includes('combo')) state.duelType = 'combo'
      else if (trimmed.includes('残局') || trimmed.includes('puzzle')) state.duelType = 'puzzle'
      else if (trimmed.includes('整局') || trimmed.includes('full')) state.duelType = 'full'
      continue
    }

    if (trimmed.startsWith('--')) continue
    const reloadMatch = trimmed.match(reloadFieldRegex)
    if (reloadMatch) {
      const flagsPart = reloadMatch[1] || ''
      if (flagsPart.includes('DUEL_TAG_MODE') || flagsPart.includes('0x20')) {
        isTag = true
      }
      if (reloadMatch[2]) {
        const ruleNum = parseInt(reloadMatch[2].trim(), 10)
        if ([2, 3, 4, 5].includes(ruleNum)) {
          state.masterRule = ruleNum as MasterRule
        }
      }
      continue
    }
    const playerMatch = trimmed.match(playerInfoRegex)
    if (playerMatch) {
      const rawP = parseInt(playerMatch[1], 10)
      const pIdx = (rawP === 0 || rawP === 2 ? 0 : 1) as 0 | 1
      state.players[pIdx].lp = parseInt(playerMatch[2], 10)
      state.players[pIdx].startHand = parseInt(playerMatch[3], 10)
      state.players[pIdx].maxHand = parseInt(playerMatch[4], 10)
      continue
    }
    const hintMatch = trimmed.match(hintRegex)
    if (hintMatch) {
      state.hint = hintMatch[1]
      continue
    }
    const cardMatch = trimmed.match(addCardRegex)
    if (cardMatch) {
      const code = parseInt(cardMatch[2], 10)
      const rawOwner = parseInt(cardMatch[3], 10)
      const rawController = parseInt(cardMatch[4], 10)
      if (rawController === 2 || rawController === 3 || rawOwner === 2 || rawOwner === 3) {
        isTag = true
      }
      const controller: 0 | 1 = rawController === 0 || rawController === 2 ? 0 : 1
      const owner: 0 | 1 = rawOwner === 0 || rawOwner === 2 ? 0 : 1
      const location = parseLocationValue(cardMatch[5])
      const sequence = parseInt(cardMatch[6], 10)
      const position = parsePositionValue(cardMatch[7])
      let duelistId = controller === 0 ? 'duelist_0_0' : 'duelist_1_0'
      if (rawController === 2) {
        duelistId = 'duelist_0_1'
      } else if (rawController === 3) {
        duelistId = 'duelist_1_1'
      }
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
          counters: {},
          duelistId
        }
        state.cards.push(fieldCard)
        if (cardMatch[1]) cardByVar.set(cardMatch[1], fieldCard)
        lastAddedCard = fieldCard
      }
      continue
    }
    const counterMatch = trimmed.match(addCounterRegex)
    if (counterMatch) {
      const target = cardByVar.get(counterMatch[1]) ?? lastAddedCard
      if (!target) continue
      const typeStr = counterMatch[2].trim()
      const typeNum =
        typeStr.startsWith('0x') || typeStr.startsWith('0X')
          ? parseInt(typeStr, 16)
          : parseInt(typeStr, 10)
      const count = parseInt(counterMatch[3], 10)
      if (!target.counters) {
        target.counters = {}
      }
      target.counters[typeNum] = (target.counters[typeNum] || 0) + count
      continue
    }
  }

  if (isTag) {
    state.matchConfig = {
      mode: 'tag',
      team0Count: 2,
      team1Count: 2,
      tagFormat: 'standard',
      sharedLp: true
    }
    state.duelists = createStandardTagDuelists()
  }

  return normalizeDuelState(state)
}
