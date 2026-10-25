import { OcgcoreDuel } from 'koishipro-core.js'
import type { CardQuery } from 'ygopro-msg-encode'
import {
  EngineBoardState,
  EngineCard,
  EngineDuelistState,
  EnginePlayerState,
  CardLocation,
  CardPosition,
  placeholderCardData
} from '@shared/index'
import { cdbService } from '../../db/cdbService'

const PHASE_NAMES: Record<number, string> = {
  1: '抽卡阶段 (DP)',
  2: '准备阶段 (SP)',
  4: '主要阶段1 (M1)',
  8: '战斗开始 (BP Start)',
  16: '战斗步骤 (Battle Step)',
  32: '伤害计算 (Damage Calc)',
  64: '伤害步骤 (Damage Step)',
  128: '战斗结束 (BP End)',
  256: '主要阶段2 (M2)',
  512: '结束阶段 (EP)'
}

const MZONE_SIZE = 7
const SZONE_SIZE = 6
const PZONE_SIZE = 2
const QUERY_FLAG_ALL = 0xefffff

const QUERY_ZONES = [
  CardLocation.HAND,
  CardLocation.MZONE,
  CardLocation.SZONE,
  CardLocation.GRAVE,
  CardLocation.REMOVED,
  CardLocation.DECK,
  CardLocation.EXTRA,
  CardLocation.FZONE,
  CardLocation.PZONE
] as number[]
export interface FieldReaderTagSeat {
  id: string
  team: 0 | 1
  seat: 0 | 1 | 2 | 3
  name: string
}

export interface FieldReaderTagContext {
  duelists: FieldReaderTagSeat[]
}

export class FieldReader {
  private idCounter = 0
  private identity = new Map<string, { code: number; instanceId: string }>()
  private lastState: EngineBoardState | null = null
  private maxLp: [number, number] = [8000, 8000]
  private meta = { turn: 1, turnPlayer: 0 as 0 | 1, phase: 1 }
  private tagContext: FieldReaderTagContext | null = null
  private activeSeatByTeam: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3] = [0, 1]

  reset(maxLps: [number, number], turnPlayer: 0 | 1 = 0, tagContext?: FieldReaderTagContext): void {
    this.idCounter = 0
    this.identity.clear()
    this.lastState = null
    this.maxLp = maxLps
    this.meta = { turn: 0, turnPlayer, phase: 1 }
    this.tagContext = tagContext ?? null
    this.activeSeatByTeam = [0, 1]
  }

  private privateLocation(location: number): boolean {
    return (
      location === CardLocation.HAND ||
      location === CardLocation.DECK ||
      location === CardLocation.EXTRA
    )
  }

  private seatIdOf(team: 0 | 1): string | undefined {
    if (!this.tagContext) return undefined
    const seat = this.activeSeatByTeam[team]
    return this.tagContext.duelists.find((duelist) => duelist.seat === seat)?.id
  }

  private cardKey(
    controller: 0 | 1,
    location: number,
    sequence: number,
    duelistId?: string
  ): string {
    if (this.tagContext && this.privateLocation(location) && duelistId) {
      return `${duelistId}:${location}:${sequence}`
    }
    return `${controller}:${location}:${sequence}`
  }

  get currentMeta(): { turn: number; turnPlayer: 0 | 1; phase: number } {
    return { ...this.meta }
  }

  get activeDuelistIds(): [string | undefined, string | undefined] {
    return [this.seatIdOf(0), this.seatIdOf(1)]
  }
  applyMetaMessage(msg: unknown): void {
    if (typeof msg !== 'object' || msg === null) return
    const m = msg as { constructor?: { name?: string }; player?: unknown; phase?: unknown }
    const name = m.constructor?.name
    if (name === 'YGOProMsgTagSwap' && this.tagContext) {
      const team = m.player === 1 ? 1 : 0
      const seats = this.tagContext.duelists.filter((duelist) => duelist.team === team)
      const current = this.activeSeatByTeam[team]
      const other = seats.find((duelist) => duelist.seat !== current)
      if (other) this.activeSeatByTeam[team] = other.seat
    } else if (name === 'YGOProMsgNewTurn' && typeof m.player === 'number') {
      this.meta.turn += 1
      this.meta.turnPlayer = m.player === 1 ? 1 : 0
    } else if (name === 'YGOProMsgNewPhase' && typeof m.phase === 'number') {
      this.meta.phase = m.phase
    }
  }

  getState(): EngineBoardState {
    if (!this.lastState) throw new Error('FieldReader 尚未读取过场地状态。')
    return this.lastState
  }

  restoreIdentity(state: EngineBoardState): void {
    this.identity.clear()
    for (const card of state.allCards) {
      this.identity.set(
        this.cardKey(card.controller, card.location, card.sequence, card.duelistId),
        {
          code: card.code,
          instanceId: card.instanceId
        }
      )
      const seq = Number(card.instanceId.replace('card-', ''))
      if (Number.isFinite(seq) && seq > this.idCounter) this.idCounter = seq
    }
  }

  seedIdentity(entries: { key: string; code: number; instanceId: string }[]): void {
    for (const entry of entries) {
      this.identity.set(entry.key, { code: entry.code, instanceId: entry.instanceId })
      const seq = Number(entry.instanceId.replace('card-', ''))
      if (Number.isFinite(seq) && seq > this.idCounter) this.idCounter = seq
    }
  }
  readBoard(duel: OcgcoreDuel): EngineBoardState {
    let fieldInfo: ReturnType<OcgcoreDuel['queryFieldInfo']> | null = null
    try {
      fieldInfo = duel.queryFieldInfo()
    } catch (err) {
      console.warn('[field-reader] queryFieldInfo failed:', err)
    }
    const queried = new Map<number, { location: number; cards: CardQuery[] }[]>()
    for (const player of [0, 1] as const) {
      const zones: { location: number; cards: CardQuery[] }[] = []
      for (const location of QUERY_ZONES) {
        zones.push({ location, cards: this.queryZone(duel, player, location) })
      }
      queried.set(player, zones)
    }
    const nextIdentity = new Map<string, { code: number; instanceId: string }>()
    const claimedPrev = new Set<string>()
    const allCards: EngineCard[] = []

    interface RawCard {
      card: EngineCard
      key: string
      exactMatched: boolean
      equipRef?: CardQuery['equipCard']
      targetRefs?: CardQuery['targetCards']
    }
    const raws: RawCard[] = []

    for (const [player, zones] of queried) {
      for (const { location, cards } of zones) {
        for (const q of cards) {
          const controller = (q.controller ?? player) === 1 ? 1 : 0
          const sequence = q.sequence ?? 0
          const code = q.code ?? 0
          if (code <= 0) continue
          const duelistId =
            this.tagContext && this.privateLocation(location)
              ? this.seatIdOf(controller as 0 | 1)
              : undefined
          const key = this.cardKey(controller as 0 | 1, location, sequence, duelistId)
          const isHiddenPile = location === CardLocation.DECK || location === CardLocation.EXTRA
          const enginePosition = q.position
          const position =
            typeof enginePosition === 'number' && enginePosition !== 0
              ? enginePosition
              : isHiddenPile
                ? CardPosition.FACEDOWN
                : location === CardLocation.GRAVE || location === CardLocation.REMOVED
                  ? CardPosition.FACEUP
                  : location === CardLocation.HAND && q.reveal
                    ? CardPosition.FACEUP
                    : (enginePosition ?? 0)
          raws.push({
            card: {
              instanceId: '',
              code,
              card: cdbService.getCardById(code) ?? placeholderCardData(code) ?? undefined,
              controller: controller as 0 | 1,
              owner: ((q.owner ?? controller) === 1 ? 1 : 0) as 0 | 1,
              location,
              sequence,
              position,
              duelistId,
              atk: q.attack,
              def: q.defense,
              baseAtk: q.baseAttack,
              baseDef: q.baseDefense,
              overlayMaterials: [...(q.overlayCards ?? [])],
              counters: this.toCounters(q),
              status: q.status ?? 0
            },
            key,
            exactMatched: false,
            equipRef: q.equipCard,
            targetRefs: q.targetCards
          })
        }
      }
    }
    for (const raw of raws) {
      const prev = this.identity.get(raw.key)
      if (prev && prev.code === raw.card.code && !claimedPrev.has(prev.instanceId)) {
        raw.card.instanceId = prev.instanceId
        claimedPrev.add(prev.instanceId)
        raw.exactMatched = true
      }
    }
    const unmatchedPrev = [...this.identity.entries()].filter(
      ([, v]) => !claimedPrev.has(v.instanceId)
    )
    for (const raw of raws) {
      if (raw.card.instanceId) continue
      const pickIndex = (preferSameLocation: boolean): number =>
        unmatchedPrev.findIndex(
          ([key, v]) =>
            v.code === raw.card.code &&
            !claimedPrev.has(v.instanceId) &&
            (!preferSameLocation || key.split(':')[1] === String(raw.card.location))
        )
      const pick = pickIndex(true) !== -1 ? pickIndex(true) : pickIndex(false)
      if (pick !== -1) {
        const [, prev] = unmatchedPrev[pick]
        raw.card.instanceId = prev.instanceId
        claimedPrev.add(prev.instanceId)
        unmatchedPrev.splice(pick, 1)
      }
    }
    for (const raw of raws) {
      if (!raw.card.instanceId) {
        raw.card.instanceId = this.allocateId()
      }
      nextIdentity.set(raw.key, { code: raw.card.code, instanceId: raw.card.instanceId })
      allCards.push(raw.card)
    }
    this.identity = nextIdentity

    const instanceByPosition = new Map<string, string>()
    for (const raw of raws) {
      const positionKey = `${raw.card.controller}:${raw.card.location}:${raw.card.sequence}`
      if (!instanceByPosition.has(positionKey)) {
        instanceByPosition.set(positionKey, raw.card.instanceId)
      }
    }
    const resolveRef = (ref: NonNullable<CardQuery['equipCard']>): string | undefined =>
      instanceByPosition.get(`${ref.controller}:${ref.location}:${ref.sequence}`)
    for (const raw of raws) {
      const equipTarget = raw.equipRef ? resolveRef(raw.equipRef) : undefined
      if (equipTarget && equipTarget !== raw.card.instanceId) {
        raw.card.equipTargetInstanceId = equipTarget
      }
      const targetIds = [
        ...new Set(
          (raw.targetRefs ?? [])
            .map((ref) => resolveRef(ref))
            .filter((id): id is string => Boolean(id))
        )
      ]
      if (targetIds.length > 0) raw.card.targetInstanceIds = targetIds
    }

    const players = [0, 1].map((player): EnginePlayerState => {
      const fp = fieldInfo?.field?.players?.[player]
      const cards = allCards.filter((c) => c.controller === player)
      const mzone: (EngineCard | null)[] = Array.from({ length: MZONE_SIZE }, () => null)
      const szone: (EngineCard | null)[] = Array.from({ length: SZONE_SIZE }, () => null)
      const pzone: (EngineCard | null)[] = Array.from({ length: PZONE_SIZE }, () => null)
      let fzone: EngineCard | null = null
      for (const card of cards) {
        if (card.location === CardLocation.MZONE && card.sequence < MZONE_SIZE) {
          mzone[card.sequence] = card
        } else if (card.location === CardLocation.SZONE && card.sequence < SZONE_SIZE) {
          szone[card.sequence] = card
        } else if (card.location === CardLocation.FZONE) {
          fzone = card
        } else if (card.location === CardLocation.PZONE && card.sequence < PZONE_SIZE) {
          pzone[card.sequence] = card
        }
      }
      return {
        player: player as 0 | 1,
        lp: Number(fp?.lp ?? 0),
        maxLp: this.maxLp[player],
        deckCount: Number(
          fp?.deckCount ?? cards.filter((c) => c.location === CardLocation.DECK).length
        ),
        extraCount: Number(
          fp?.extraCount ?? cards.filter((c) => c.location === CardLocation.EXTRA).length
        ),
        graveCount: Number(
          fp?.graveCount ?? cards.filter((c) => c.location === CardLocation.GRAVE).length
        ),
        removedCount: Number(
          fp?.removedCount ?? cards.filter((c) => c.location === CardLocation.REMOVED).length
        ),
        hand: cards.filter((c) => c.location === CardLocation.HAND),
        deck: cards.filter((c) => c.location === CardLocation.DECK),
        extra: cards.filter((c) => c.location === CardLocation.EXTRA),
        mzone,
        szone,
        fzone,
        pzone,
        graveyard: cards.filter((c) => c.location === CardLocation.GRAVE),
        banished: cards.filter((c) => c.location === CardLocation.REMOVED)
      }
    }) as [EnginePlayerState, EnginePlayerState]

    const tagDuelists: EngineDuelistState[] | undefined = this.tagContext?.duelists.map(
      (duelist) => {
        const active = this.activeSeatByTeam[duelist.team] === duelist.seat
        const teamPlayer = players[duelist.team]
        return {
          ...duelist,
          active,
          handCount: active ? teamPlayer.hand.length : 0,
          deckCount: active ? teamPlayer.deckCount : 0,
          extraCount: active ? teamPlayer.extraCount : 0
        }
      }
    )
    const activeDuelist: [string, string] | undefined = this.tagContext
      ? [this.seatIdOf(0) ?? '', this.seatIdOf(1) ?? '']
      : undefined

    const state: EngineBoardState = {
      turn: this.meta.turn,
      turnPlayer: this.meta.turnPlayer,
      phase: this.meta.phase,
      phaseName: PHASE_NAMES[this.meta.phase] || `阶段 ${this.meta.phase}`,
      players,
      allCards,
      ...(this.tagContext ? { tag: true, duelists: tagDuelists, activeDuelist } : {})
    }

    this.lastState = state
    return state
  }

  private queryZone(duel: OcgcoreDuel, player: number, location: number): CardQuery[] {
    try {
      const res = duel.queryFieldCard({
        player,
        location,
        queryFlag: QUERY_FLAG_ALL,
        useCache: 0
      })
      return res?.cards ?? []
    } catch (err) {
      console.warn(
        `[field-reader] queryFieldCard(player=${player}, location=${location}) failed:`,
        err
      )
      return []
    }
  }

  private toCounters(q: CardQuery): Record<number, number> | undefined {
    if (!q.counters || q.counters.length === 0) return undefined
    const counters: Record<number, number> = {}
    for (const c of q.counters) counters[c.type] = c.count
    return counters
  }

  private allocateId(): string {
    this.idCounter += 1
    return `card-${this.idCounter}`
  }
}
