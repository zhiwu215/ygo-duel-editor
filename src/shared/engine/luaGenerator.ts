import { DuelPuzzleState, FieldCard } from '../types/duel'
import { alignFirstPlayerSeat } from './seatAlignment'
import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'
import type { DuelTestSettings } from '../types/ipc/appConfig'

import { resolveCounterName } from '../constants/counters'
function getLocationConstName(loc: number): string {
  switch (loc) {
    case CardLocation.DECK:
      return 'LOCATION_DECK'
    case CardLocation.HAND:
      return 'LOCATION_HAND'
    case CardLocation.MZONE:
      return 'LOCATION_MZONE'
    case CardLocation.SZONE:
      return 'LOCATION_SZONE'
    case CardLocation.GRAVE:
      return 'LOCATION_GRAVE'
    case CardLocation.REMOVED:
      return 'LOCATION_REMOVED'
    case CardLocation.EXTRA:
      return 'LOCATION_EXTRA'
    case CardLocation.OVERLAY:
      return 'LOCATION_OVERLAY'
    case CardLocation.PZONE:
      return 'LOCATION_PZONE'
    default:
      return 'LOCATION_MZONE'
  }
}
function getPositionConstName(pos: number): string {
  switch (pos) {
    case CardPosition.FACEUP_ATTACK:
      return 'POS_FACEUP_ATTACK'
    case CardPosition.FACEDOWN_ATTACK:
      return 'POS_FACEDOWN_ATTACK'
    case CardPosition.FACEUP_DEFENSE:
      return 'POS_FACEUP_DEFENSE'
    case CardPosition.FACEDOWN_DEFENSE:
      return 'POS_FACEDOWN_DEFENSE'
    case CardPosition.FACEUP:
      return 'POS_FACEUP'
    case CardPosition.FACEDOWN:
      return 'POS_FACEDOWN'
    default:
      return 'POS_FACEUP_ATTACK'
  }
}

function shuffleCards(cards: FieldCard[]): FieldCard[] {
  const out = [...cards]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

const TEST_OPENING_HAND = 5

export interface LuaScriptOptions {
  forReplay?: boolean
  test?: DuelTestSettings
}

export function generateLuaScript(state: DuelPuzzleState, options?: LuaScriptOptions): string {
  const aligned = options?.forReplay ? state : alignFirstPlayerSeat(state)
  return renderLuaScript(aligned, options)
}

function renderLuaScript(state: DuelPuzzleState, options?: LuaScriptOptions): string {
  const team0Count =
    state.matchConfig?.team0Count ?? (state.duelists?.filter((d) => d.team === 0).length || 1)
  const team1Count =
    state.matchConfig?.team1Count ?? (state.duelists?.filter((d) => d.team === 1).length || 1)
  const isTag = state.matchConfig?.mode === 'tag' || (team0Count === 2 && team1Count === 2)

  if (team0Count !== 1 && team0Count !== 2) {
    throw new Error(
      `当前人数 (${team0Count}v${team1Count}) 仅用于剧情编排。ocgcore 引擎仅支持 1v1 与 2v2 双打导出。`
    )
  }
  if (team1Count !== 1 && team1Count !== 2) {
    throw new Error(
      `当前人数 (${team0Count}v${team1Count}) 仅用于剧情编排。ocgcore 引擎仅支持 1v1 与 2v2 双打导出。`
    )
  }
  if (isTag && state.matchConfig?.tagFormat !== 'standard') {
    throw new Error(
      `2v2 独立 LP 仅用于剧情编排与近似校验，不能按 tag 规则导出。请切换到 2v2 标准。`
    )
  }

  const forReplay = options?.forReplay ?? false
  const test = forReplay ? undefined : options?.test
  const isFull = !forReplay && state.duelType === 'full'
  const randomDeck = test?.deckOrder === 'random'

  const lines: string[] = []

  const duelistsTeam0 = state.duelists?.filter((d) => d.team === 0) || []
  const duelistsTeam1 = state.duelists?.filter((d) => d.team === 1) || []
  lines.push('-- ==============================================================')
  lines.push(`-- 决斗标题: ${state.title || '未命名对局'}`)
  if (state.duelType) {
    const typeLabel =
      state.duelType === 'combo' ? 'Combo' : state.duelType === 'puzzle' ? '残局' : '整局'
    lines.push(`-- 工程类型: ${typeLabel}`)
  }
  lines.push(`-- 规则版本: 大师规则 (MR${state.masterRule})`)
  lines.push(`-- 决斗模式: ${isTag ? '2v2 双打 (Tag Duel)' : '1v1 标准决斗'}`)
  if (isFull) lines.push('-- 对局规则: 正常决斗 (多回合)')
  if (isTag && duelistsTeam0.length >= 2 && duelistsTeam1.length >= 2) {
    lines.push(`-- 我方先锋 (Player 0): ${duelistsTeam0[0].name} (LP: ${duelistsTeam0[0].lp})`)
    lines.push(`-- 我方副将 (Player 2): ${duelistsTeam0[1].name} (LP: ${duelistsTeam0[1].lp})`)
    lines.push(`-- 对方先锋 (Player 1): ${duelistsTeam1[0].name} (LP: ${duelistsTeam1[0].lp})`)
    lines.push(`-- 对方副将 (Player 3): ${duelistsTeam1[1].name} (LP: ${duelistsTeam1[1].lp})`)
  }
  lines.push(`-- 导出工具: YGO Duel Editor`)
  lines.push('-- ==============================================================')
  lines.push('')
  const flags: string[] = []
  if (state.firstTurnAttack) flags.push('DUEL_ATTACK_FIRST_TURN')
  if (isTag) flags.push('DUEL_TAG_MODE')
  if (!randomDeck) flags.push('DUEL_PSEUDO_SHUFFLE')
  const flagStr = flags.length > 0 ? flags.join(' + ') : '0'

  lines.push(
    `Debug.SetAIName("${duelistsTeam1
      .map((d) => d.name)
      .join(' & ')
      .replace(/"/g, '\\"')}")`
  )
  lines.push(`-- 1. 初始化规则环境`)
  lines.push(`Debug.ReloadFieldBegin(${flagStr}, ${state.masterRule})`)
  lines.push('')
  const lp0 = state.matchConfig?.sharedLp
    ? state.players[0].lp
    : (duelistsTeam0[0]?.lp ?? state.players[0].lp)
  const lp1 = state.matchConfig?.sharedLp
    ? state.players[1].lp
    : (duelistsTeam1[0]?.lp ?? state.players[1].lp)

  const startHandOf = (player: 0 | 1): number => {
    if (forReplay) return state.players[player].startHand
    return randomDeck ? TEST_OPENING_HAND : 0
  }

  const drawCountOf = (player: 0 | 1): number => (isFull ? 1 : state.players[player].maxHand)

  lines.push(`-- 2. 双方生命值与手牌配置`)
  lines.push(`Debug.SetPlayerInfo(0, ${lp0}, ${startHandOf(0)}, ${drawCountOf(0)})`)
  lines.push(`Debug.SetPlayerInfo(1, ${lp1}, ${startHandOf(1)}, ${drawCountOf(1)})`)
  lines.push('')
  lines.push(`-- 3. 卡片摆放`)

  const players: (0 | 1)[] = [0, 1]
  const locationOrder = [
    { loc: CardLocation.MZONE, name: '怪兽区 (MZONE)' },
    { loc: CardLocation.SZONE, name: '魔陷区 (SZONE)' },
    { loc: CardLocation.PZONE, name: '独立灵摆区 (PZONE)' },
    { loc: CardLocation.HAND, name: '手牌 (HAND)' },
    { loc: CardLocation.GRAVE, name: '墓地 (GRAVE)' },
    { loc: CardLocation.REMOVED, name: '除外区 (REMOVED)' },
    { loc: CardLocation.EXTRA, name: '额外卡组 (EXTRA)' },
    { loc: CardLocation.DECK, name: '主卡组 (DECK)' }
  ]

  const emitCard = (card: FieldCard, location: number, sequence: number): void => {
    const locName = getLocationConstName(location)
    const posName = getPositionConstName(card.position)
    const cardNameComment = card.card?.name ? ` -- ${card.card.name}` : ''
    let targetController = card.controller
    if (isTag && location === CardLocation.HAND) {
      const teamDuelists = card.controller === 0 ? duelistsTeam0 : duelistsTeam1
      if (teamDuelists.length >= 2 && card.duelistId === teamDuelists[1].id) {
        targetController = (card.controller === 0 ? 2 : 3) as 0 | 1
      }
    }

    const hasCounters = card.counters && Object.values(card.counters).some((v) => v > 0)
    const isPrivatePile =
      location === CardLocation.HAND ||
      location === CardLocation.DECK ||
      location === CardLocation.EXTRA
    const owner = !isTag && isPrivatePile ? targetController : card.owner

    if (hasCounters) {
      lines.push(
        `local c = Debug.AddCard(${card.code}, ${owner}, ${targetController}, ${locName}, ${sequence}, ${posName})${cardNameComment}`
      )
      for (const [typeIdStr, count] of Object.entries(card.counters!)) {
        const countNum = Number(count)
        const typeNum = Number(typeIdStr)
        if (countNum > 0) {
          const hexStr = `0x${typeNum.toString(16)}`
          const counterName = resolveCounterName(typeNum, state.customCounters)
          lines.push(`c:add_counter(${hexStr}, ${countNum}) -- 放置${countNum}个${counterName}`)
        }
      }
    } else {
      lines.push(
        `Debug.AddCard(${card.code}, ${owner}, ${targetController}, ${locName}, ${sequence}, ${posName})${cardNameComment}`
      )
    }
    if (card.overlayMaterials && card.overlayMaterials.length > 0) {
      for (const matCode of card.overlayMaterials) {
        lines.push(
          `Debug.AddCard(${matCode}, ${card.owner}, ${targetController}, LOCATION_OVERLAY, ${sequence}, POS_FACEUP) -- 超量素材`
        )
      }
    }
  }

  for (const p of players) {
    const pName = p === 0 ? '我方阵营 (Team 0)' : '对方阵营 (Team 1)'
    lines.push(`-- -------------------------------------------------------------`)
    lines.push(`-- >>> ${pName} <<<`)
    lines.push(`-- -------------------------------------------------------------`)

    const playerCards = state.cards.filter((c) => c.controller === p)
    const handCards = playerCards
      .filter((c) => c.location === CardLocation.HAND)
      .sort((a, b) => a.sequence - b.sequence)
    const deckCards = playerCards
      .filter((c) => c.location === CardLocation.DECK)
      .sort((a, b) => a.sequence - b.sequence)

    const deckForOutput = randomDeck ? shuffleCards([...deckCards, ...handCards]) : deckCards

    for (const group of locationOrder) {
      if (group.loc === CardLocation.HAND) {
        if (randomDeck || handCards.length === 0) continue
        lines.push(`-- [手牌 (HAND)]`)
        handCards.forEach((card, index) => emitCard(card, CardLocation.HAND, index))
        lines.push('')
        continue
      }

      if (group.loc === CardLocation.DECK) {
        if (deckForOutput.length === 0) continue
        lines.push(
          randomDeck && handCards.length > 0
            ? `-- [主卡组 (DECK)]（含手牌区并入的 ${handCards.length} 张，洗牌后开局抽 ${TEST_OPENING_HAND} 张）`
            : `-- [主卡组 (DECK)]`
        )
        deckForOutput.forEach((card, index) => emitCard(card, CardLocation.DECK, index))
        lines.push('')
        continue
      }

      const cardsInLoc = playerCards.filter((c) => c.location === group.loc)
      if (cardsInLoc.length === 0) continue

      lines.push(`-- [${group.name}]`)
      cardsInLoc
        .sort((a, b) => a.sequence - b.sequence)
        .forEach((card) => {
          emitCard(card, card.location, card.sequence)
        })
      lines.push('')
    }
  }
  lines.push(`-- 4. 结束初始化`)
  lines.push(`Debug.ReloadFieldEnd()`)
  if (forReplay) {
    lines.push(`local e1=Effect.GlobalEffect()`)
    lines.push(`e1:SetType(EFFECT_TYPE_FIELD)`)
    lines.push(`e1:SetProperty(EFFECT_FLAG_PLAYER_TARGET)`)
    lines.push(`e1:SetCode(EFFECT_SKIP_DP)`)
    lines.push(`e1:SetTargetRange(1,0)`)
    lines.push(`Duel.RegisterEffect(e1,0)`)
    lines.push(`local e2=Effect.GlobalEffect()`)
    lines.push(`e2:SetType(EFFECT_TYPE_FIELD)`)
    lines.push(`e2:SetProperty(EFFECT_FLAG_PLAYER_TARGET)`)
    lines.push(`e2:SetCode(EFFECT_SKIP_SP)`)
    lines.push(`e2:SetTargetRange(1,0)`)
    lines.push(`Duel.RegisterEffect(e2,0)`)
  } else if (isFull) {
    if (Number(state.masterRule) >= 4) {
      lines.push(`local firstDraw=Effect.GlobalEffect()`)
      lines.push(`firstDraw:SetType(EFFECT_TYPE_FIELD)`)
      lines.push(`firstDraw:SetProperty(EFFECT_FLAG_PLAYER_TARGET)`)
      lines.push(`firstDraw:SetCode(EFFECT_SKIP_DP)`)
      lines.push(`firstDraw:SetTargetRange(1,0)`)
      lines.push(`firstDraw:SetReset(RESET_PHASE+PHASE_DRAW)`)
      lines.push(`Duel.RegisterEffect(firstDraw,0)`)
    }
  } else {
    lines.push(`aux.BeginPuzzle()`)
  }
  if (state.hint && state.hint.trim().length > 0) {
    lines.push(`Debug.ShowHint("${state.hint.replace(/"/g, '\\"')}")`)
  }

  return lines.join('\n')
}
