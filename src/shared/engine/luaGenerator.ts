import { DuelPuzzleState } from '../types/duel'
import { CardLocation } from '../constants/locations'
import { CardPosition } from '../constants/positions'

import { getCounterName } from '../constants/counters'

// 辅助：获取位置常量名
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

// 辅助：获取表示形式常量名
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

/**
 * 将 DuelPuzzleState 格式化输出为符合 ocgcore 标准的 Lua 脚本
 */
export function generateLuaScript(state: DuelPuzzleState): string {
  // 校验当前对局是否符合 ocgcore 导出范围 (1v1 或 2v2)
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

  const lines: string[] = []

  const duelistsTeam0 = state.duelists?.filter((d) => d.team === 0) || []
  const duelistsTeam1 = state.duelists?.filter((d) => d.team === 1) || []

  // 1. 头部注释
  lines.push('-- ==============================================================')
  lines.push(`-- 决斗标题: ${state.title || '未命名对局'}`)
  lines.push(`-- 规则版本: 大师规则 (MR${state.masterRule})`)
  lines.push(`-- 决斗模式: ${isTag ? '2v2 双打 (Tag Duel)' : '1v1 标准决斗'}`)
  if (isTag && duelistsTeam0.length >= 2 && duelistsTeam1.length >= 2) {
    lines.push(`-- 我方先锋 (Player 0): ${duelistsTeam0[0].name} (LP: ${duelistsTeam0[0].lp})`)
    lines.push(`-- 我方副将 (Player 2): ${duelistsTeam0[1].name} (LP: ${duelistsTeam0[1].lp})`)
    lines.push(`-- 对方先锋 (Player 1): ${duelistsTeam1[0].name} (LP: ${duelistsTeam1[0].lp})`)
    lines.push(`-- 对方副将 (Player 3): ${duelistsTeam1[1].name} (LP: ${duelistsTeam1[1].lp})`)
  }
  lines.push(`-- 导出工具: YGO Duel Editor`)
  lines.push('-- ==============================================================')
  lines.push('')

  // 2. 初始化环境
  const flags: string[] = []
  if (state.firstTurnAttack) flags.push('DUEL_ATTACK_FIRST_TURN')
  if (isTag) flags.push('DUEL_TAG_MODE')
  const flagStr = flags.length > 0 ? flags.join(' + ') : '0'

  lines.push(`-- 1. 初始化规则环境`)
  lines.push(`Debug.ReloadFieldBegin(${flagStr}, ${state.masterRule})`)
  lines.push('')

  // 3. 玩家信息设置
  const lp0 = state.matchConfig?.sharedLp
    ? state.players[0].lp
    : (duelistsTeam0[0]?.lp ?? state.players[0].lp)
  const lp1 = state.matchConfig?.sharedLp
    ? state.players[1].lp
    : (duelistsTeam1[0]?.lp ?? state.players[1].lp)

  lines.push(`-- 2. 双方生命值与手牌配置`)
  lines.push(
    `Debug.SetPlayerInfo(0, ${lp0}, ${state.players[0].startHand}, ${state.players[0].maxHand})`
  )
  lines.push(
    `Debug.SetPlayerInfo(1, ${lp1}, ${state.players[1].startHand}, ${state.players[1].maxHand})`
  )
  lines.push('')

  // 4. 卡片摆放分组
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

  for (const p of players) {
    const pName = p === 0 ? '我方阵营 (Team 0)' : '对方阵营 (Team 1)'
    lines.push(`-- -------------------------------------------------------------`)
    lines.push(`-- >>> ${pName} <<<`)
    lines.push(`-- -------------------------------------------------------------`)

    const playerCards = state.cards.filter((c) => c.controller === p)

    for (const group of locationOrder) {
      const cardsInLoc = playerCards.filter((c) => c.location === group.loc)
      if (cardsInLoc.length === 0) continue

      lines.push(`-- [${group.name}]`)
      cardsInLoc.sort((a, b) => a.sequence - b.sequence)

      for (const card of cardsInLoc) {
        const locName = getLocationConstName(card.location)
        const posName = getPositionConstName(card.position)
        const cardNameComment = card.card?.name ? ` -- ${card.card.name}` : ''

        // 在 2v2 Tag 模式下，手牌区分 Player 0/2 与 Player 1/3
        let targetController = card.controller
        if (isTag && card.location === CardLocation.HAND) {
          const teamDuelists = p === 0 ? duelistsTeam0 : duelistsTeam1
          if (teamDuelists.length >= 2 && card.duelistId === teamDuelists[1].id) {
            // 队友手牌: Team 0 的队友为 Player 2，Team 1 的队友为 Player 3
            targetController = (p === 0 ? 2 : 3) as 0 | 1
          } else {
            targetController = p
          }
        }

        const hasCounters = card.counters && Object.values(card.counters).some((v) => v > 0)

        if (hasCounters) {
          lines.push(
            `local c = Debug.AddCard(${card.code}, ${card.owner}, ${targetController}, ${locName}, ${card.sequence}, ${posName})${cardNameComment}`
          )
          for (const [typeIdStr, count] of Object.entries(card.counters!)) {
            const countNum = Number(count)
            const typeNum = Number(typeIdStr)
            if (countNum > 0) {
              const hexStr = `0x${typeNum.toString(16)}`
              const counterName = getCounterName(typeNum)
              lines.push(`c:add_counter(${hexStr}, ${countNum}) -- 放置${countNum}个${counterName}`)
            }
          }
        } else {
          lines.push(
            `Debug.AddCard(${card.code}, ${card.owner}, ${targetController}, ${locName}, ${card.sequence}, ${posName})${cardNameComment}`
          )
        }

        // 超量素材 (XYZ Materials)
        if (card.overlayMaterials && card.overlayMaterials.length > 0) {
          for (const matCode of card.overlayMaterials) {
            lines.push(
              `Debug.AddCard(${matCode}, ${card.owner}, ${targetController}, LOCATION_OVERLAY, ${card.sequence}, POS_FACEUP) -- 超量素材`
            )
          }
        }
      }
      lines.push('')
    }
  }

  // 5. 结束初始化
  lines.push(`-- 4. 结束初始化与启动残局判定`)
  lines.push(`Debug.ReloadFieldEnd()`)
  lines.push(`aux.BeginPuzzle()`)

  // 6. 过关提示
  if (state.hint && state.hint.trim().length > 0) {
    lines.push(`Debug.ShowHint("${state.hint.replace(/"/g, '\\"')}")`)
  }

  return lines.join('\n')
}
