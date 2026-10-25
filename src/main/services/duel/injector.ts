import { OcgcoreDuel } from 'koishipro-core.js'
import {
  CardLocation,
  CardPosition,
  EngineBoardState,
  FIELD_ZONE_SEQUENCE,
  InjectCommand,
  PLACEHOLDER_CARD_NAME,
  isPlaceholderCard
} from '@shared/index'
import { cdbService } from '../../db/cdbService'

interface ResolvedTarget {
  location: number
  sequence: number
  position: number
  zone: 'hand' | 'deck' | 'grave' | 'removed' | 'extra' | 'mzone' | 'szone' | 'fzone'
  label: string
}

const ADD_CARD_LABELS: Record<string, string> = {
  hand: '加入手牌',
  'deck-top': '置于卡组顶',
  'deck-bottom': '置于卡组底',
  'deck-shuffle': '洗入卡组',
  'grave-top': '置于墓地',
  removed: '除外',
  extra: '加入额外卡组',
  mzone: '放置到怪兽区',
  szone: '放置到魔陷区',
  fzone: '放置到场地魔法区'
}

function firstEmpty(slots: (unknown | null)[]): number {
  return slots.findIndex((slot) => slot === null)
}

function resolveAddCard(
  command: Extract<InjectCommand, { op: 'add-card' }>,
  board: EngineBoardState
): ResolvedTarget {
  const player = board.players[command.player]
  switch (command.to) {
    case 'hand':
      return {
        location: CardLocation.HAND,
        sequence: player.hand.length,
        position: CardPosition.FACEDOWN,
        zone: 'hand',
        label: ADD_CARD_LABELS.hand
      }
    case 'deck-top':
      return {
        location: CardLocation.DECK,
        sequence: 0,
        position: CardPosition.FACEDOWN_DEFENSE,
        zone: 'deck',
        label: ADD_CARD_LABELS['deck-top']
      }
    case 'deck-bottom':
      return {
        location: CardLocation.DECK,
        sequence: 1,
        position: CardPosition.FACEDOWN_DEFENSE,
        zone: 'deck',
        label: ADD_CARD_LABELS['deck-bottom']
      }
    case 'deck-shuffle':
      return {
        location: CardLocation.DECK,
        sequence: 2,
        position: CardPosition.FACEDOWN_DEFENSE,
        zone: 'deck',
        label: ADD_CARD_LABELS['deck-shuffle']
      }
    case 'grave-top':
      return {
        location: CardLocation.GRAVE,
        sequence: 0,
        position: CardPosition.FACEUP,
        zone: 'grave',
        label: ADD_CARD_LABELS['grave-top']
      }
    case 'removed':
      return {
        location: CardLocation.REMOVED,
        sequence: 0,
        position: CardPosition.FACEUP,
        zone: 'removed',
        label: ADD_CARD_LABELS.removed
      }
    case 'extra':
      return {
        location: CardLocation.EXTRA,
        sequence: 0,
        position: command.position ?? CardPosition.FACEDOWN_DEFENSE,
        zone: 'extra',
        label: ADD_CARD_LABELS.extra
      }
    case 'mzone': {
      const sequence = command.sequence ?? firstEmpty(player.mzone)
      if (sequence < 0 || sequence >= player.mzone.length || player.mzone[sequence]) {
        throw new Error('怪兽区没有可用的空位。')
      }
      return {
        location: CardLocation.MZONE,
        sequence,
        position: command.position ?? CardPosition.FACEUP_ATTACK,
        zone: 'mzone',
        label: ADD_CARD_LABELS.mzone
      }
    }
    case 'szone': {
      const sequence = command.sequence ?? firstEmpty(player.szone)
      if (sequence < 0 || (sequence < player.szone.length && player.szone[sequence])) {
        throw new Error('魔陷区没有可用的空位。')
      }
      return {
        location: CardLocation.SZONE,
        sequence,
        position: command.position ?? CardPosition.FACEDOWN,
        zone: 'szone',
        label: ADD_CARD_LABELS.szone
      }
    }
    case 'fzone': {
      if (player.szone[FIELD_ZONE_SEQUENCE]) {
        throw new Error('场地魔法区已有卡片。')
      }
      return {
        location: CardLocation.SZONE,
        sequence: FIELD_ZONE_SEQUENCE,
        position: command.position ?? CardPosition.FACEUP,
        zone: 'fzone',
        label: ADD_CARD_LABELS.fzone
      }
    }
  }
}

export function executeInject(
  duel: OcgcoreDuel,
  command: InjectCommand,
  board: EngineBoardState
): { label: string; warning?: string } {
  if (command.op === 'set-lp') {
    duel.setPlayerInfo({ player: command.player, lp: command.lp, startHand: 0, drawCount: 1 })
    return { label: `调整 LP 至 ${command.lp}` }
  }

  if (!isPlaceholderCard(command.code) && !cdbService.getCardById(command.code)) {
    throw new Error(`卡片 ${command.code} 不存在于卡片数据库。`)
  }

  const target = resolveAddCard(command, board)
  duel.newCard({
    code: command.code,
    owner: command.player,
    player: command.player,
    location: target.location,
    sequence: target.sequence,
    position: target.position
  })

  return { label: target.label }
}

function zoneCount(board: EngineBoardState, player: 0 | 1, zone: ResolvedTarget['zone']): number {
  const state = board.players[player]
  switch (zone) {
    case 'hand':
      return state.hand.length
    case 'deck':
      return state.deckCount
    case 'grave':
      return state.graveyard.length
    case 'removed':
      return state.banished.length
    case 'extra':
      return state.extraCount
    case 'mzone':
      return state.mzone.filter(Boolean).length
    case 'szone':
      return state.szone.filter(Boolean).length
    case 'fzone':
      return (state.fzone ? 1 : 0) + (state.szone[FIELD_ZONE_SEQUENCE] ? 1 : 0)
  }
}

export function verifyInject(
  command: InjectCommand,
  before: EngineBoardState,
  after: EngineBoardState
): string | undefined {
  if (command.op === 'set-lp') {
    return after.players[command.player].lp === command.lp
      ? undefined
      : `引擎未接受 LP 修改（当前 ${after.players[command.player].lp}），该操作不会改变对局。`
  }
  const target = resolveAddCard(command, before)
  const beforeCount = zoneCount(before, command.player, target.zone)
  const afterCount = zoneCount(after, command.player, target.zone)
  if (afterCount === beforeCount + 1) {
    return undefined
  }
  return `引擎未将卡片放入${target.label.replace(/^加入|^置于|^放置到/, '')}，实际位置以场地为准。`
}

export function describeInject(command: InjectCommand, label: string, cardName?: string): string {
  if (command.op === 'set-lp') return `注入：${label}`
  return `注入：${label}「${cardName ?? command.code}」`
}

export function injectCardName(command: InjectCommand): string | undefined {
  if (command.op === 'set-lp') return undefined
  if (isPlaceholderCard(command.code)) return PLACEHOLDER_CARD_NAME
  return cdbService.getCardById(command.code)?.name
}
