import {
  EngineBoardState,
  EngineCard,
  EnginePlayerState,
  CardLocation,
  FieldCard
} from '@shared/index'
import { cdbService } from '../../db/cdbService'
import {
  YGOProMsgDamage,
  YGOProMsgDraw,
  YGOProMsgLpUpdate,
  YGOProMsgMove,
  YGOProMsgNewPhase,
  YGOProMsgNewTurn,
  YGOProMsgPayLpCost,
  YGOProMsgPosChange,
  YGOProMsgRecover,
  YGOProMsgSet,
  YGOProMsgAddCounter,
  YGOProMsgRemoveCounter,
  YGOProMsgShuffleHand
} from 'ygopro-msg-encode'

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

interface MoveCardLocation {
  controller: number
  location: number
  sequence: number
  position: number
}

export interface TrackedCounts {
  lp: number
  deckCount: number
  extraCount: number
  graveCount: number
  removedCount: number
  handCount: number
  mzoneCount: number
  szoneCount: number
}

export class BoardTracker {
  private state: EngineBoardState
  private idCounter = 0
  private turnStarted = false

  constructor(p0Lp = 8000, p1Lp = 8000) {
    this.state = this.createInitialState(p0Lp, p1Lp)
  }

  private allocateInstanceId(prefix: string): string {
    this.idCounter += 1
    return `${prefix}-${this.idCounter}`
  }

  private normalizePlayer(player: number): 0 | 1 {
    return player === 1 ? 1 : 0
  }

  private createInitialState(p0Lp: number, p1Lp: number): EngineBoardState {
    const createPlayer = (player: 0 | 1, lp: number): EnginePlayerState => ({
      player,
      lp,
      maxLp: lp,
      deckCount: 0,
      extraCount: 0,
      graveCount: 0,
      removedCount: 0,
      hand: [],
      mzone: Array.from({ length: MZONE_SIZE }, () => null),
      szone: Array.from({ length: SZONE_SIZE }, () => null),
      fzone: null,
      pzone: Array.from({ length: PZONE_SIZE }, () => null),
      graveyard: [],
      banished: []
    })

    return {
      turn: 1,
      turnPlayer: 0,
      phase: 1,
      phaseName: PHASE_NAMES[1] || '抽卡阶段',
      players: [createPlayer(0, p0Lp), createPlayer(1, p1Lp)],
      allCards: []
    }
  }

  reset(p0Lp = 8000, p1Lp = 8000): void {
    this.state = this.createInitialState(p0Lp, p1Lp)
    this.idCounter = 0
    this.turnStarted = false
  }

  getState(): EngineBoardState {
    this.syncAllCards()
    return JSON.parse(JSON.stringify(this.state))
  }

  setState(state: EngineBoardState): void {
    this.state = JSON.parse(JSON.stringify(state))
    this.turnStarted = true
  }

  initializeDecks(
    p0DeckCodes: number[],
    p0ExtraCodes: number[],
    p1DeckCodes: number[],
    p1ExtraCodes: number[]
  ): void {
    const makeCards = (codes: number[], player: 0 | 1, location: number): EngineCard[] => {
      return codes.map((code, idx) => ({
        instanceId: this.allocateInstanceId('engine'),
        code,
        controller: player,
        owner: player,
        location,
        sequence: idx,
        position: 0xa,
        overlayMaterials: [],
        card: cdbService.getCardById(code) || undefined
      }))
    }

    this.state.players[0].deck = makeCards(p0DeckCodes, 0, CardLocation.DECK)
    this.state.players[0].extra = makeCards(p0ExtraCodes, 0, CardLocation.EXTRA)
    this.state.players[0].deckCount = p0DeckCodes.length
    this.state.players[0].extraCount = p0ExtraCodes.length

    this.state.players[1].deck = makeCards(p1DeckCodes, 1, CardLocation.DECK)
    this.state.players[1].extra = makeCards(p1ExtraCodes, 1, CardLocation.EXTRA)
    this.state.players[1].deckCount = p1DeckCodes.length
    this.state.players[1].extraCount = p1ExtraCodes.length
  }

  initializeFromCards(cards: FieldCard[]): void {
    const toEngineCard = (c: FieldCard): EngineCard => ({
      instanceId: c.instanceId,
      code: c.code,
      controller: c.controller,
      owner: c.owner,
      location: c.location,
      sequence: c.sequence,
      position: c.position,
      overlayMaterials: [...(c.overlayMaterials || [])],
      counters: c.counters ? { ...c.counters } : undefined,
      card: c.card || cdbService.getCardById(c.code) || undefined
    })

    for (const card of cards) {
      const p = this.state.players[card.controller]
      if (!p) continue
      const ec = toEngineCard(card)
      if (card.location === CardLocation.HAND) {
        p.hand.push(ec)
      } else if (card.location === CardLocation.MZONE) {
        if (card.sequence < p.mzone.length) p.mzone[card.sequence] = ec
      } else if (card.location === CardLocation.SZONE) {
        if (card.sequence < p.szone.length) p.szone[card.sequence] = ec
      } else if (card.location === CardLocation.FZONE) {
        p.fzone = ec
      } else if (card.location === CardLocation.PZONE) {
        if (card.sequence < p.pzone.length) p.pzone[card.sequence] = ec
      } else if (card.location === CardLocation.GRAVE) {
        p.graveyard.push(ec)
      } else if (card.location === CardLocation.REMOVED) {
        p.banished.push(ec)
      } else if (card.location === CardLocation.DECK) {
        p.deck = p.deck || []
        p.deck.push(ec)
      } else if (card.location === CardLocation.EXTRA) {
        p.extra = p.extra || []
        p.extra.push(ec)
      }
    }

    for (const p of this.state.players) {
      this.renumberHand(p)
      if (p.deck) {
        p.deck.sort((a, b) => a.sequence - b.sequence)
        p.deck.forEach((c, idx) => {
          c.sequence = idx
        })
      }
      if (p.extra) {
        p.extra.sort((a, b) => a.sequence - b.sequence)
        p.extra.forEach((c, idx) => {
          c.sequence = idx
        })
      }
      p.graveyard.sort((a, b) => a.sequence - b.sequence)
      p.graveyard.forEach((c, idx) => {
        c.sequence = idx
      })
      p.banished.sort((a, b) => a.sequence - b.sequence)
      p.banished.forEach((c, idx) => {
        c.sequence = idx
      })
      p.deckCount = p.deck ? p.deck.length : 0
      p.extraCount = p.extra ? p.extra.length : 0
      p.graveCount = p.graveyard.length
      p.removedCount = p.banished.length
    }
  }

  setDeckCounts(p0Deck: number, p0Extra: number, p1Deck: number, p1Extra: number): void {
    this.state.players[0].deckCount = p0Deck
    this.state.players[0].extraCount = p0Extra
    this.state.players[1].deckCount = p1Deck
    this.state.players[1].extraCount = p1Extra
  }

  findCard(
    controller: number,
    location: number,
    sequence: number,
    code?: number
  ): EngineCard | undefined {
    const p = this.state.players[this.normalizePlayer(controller)]
    if (!p) return undefined
    const matchesCode = (c: EngineCard): boolean =>
      code === undefined || code === 0 || c.code === code

    if (location === CardLocation.HAND) {
      const bySeq = p.hand.find((c) => c.sequence === sequence && matchesCode(c))
      return bySeq ?? p.hand[sequence]
    }
    if (location === CardLocation.MZONE) {
      const slot = p.mzone[sequence]
      return slot && matchesCode(slot) ? slot : undefined
    }
    if (location === CardLocation.SZONE) {
      if (sequence < p.szone.length) {
        const slot = p.szone[sequence]
        if (slot && matchesCode(slot)) return slot
      }
      return p.fzone && matchesCode(p.fzone) ? p.fzone : undefined
    }
    if (location === CardLocation.FZONE) {
      return p.fzone && matchesCode(p.fzone) ? p.fzone : undefined
    }
    if (location === CardLocation.PZONE) {
      const slot = p.pzone[sequence]
      return slot && matchesCode(slot) ? slot : undefined
    }
    if (location === CardLocation.GRAVE) {
      return p.graveyard.find((c) => c.sequence === sequence && matchesCode(c))
    }
    if (location === CardLocation.REMOVED) {
      return p.banished.find((c) => c.sequence === sequence && matchesCode(c))
    }
    if (location === CardLocation.DECK) {
      const pile = p.deck || []
      return pile.find((c) => c.sequence === sequence && matchesCode(c)) ?? pile[sequence]
    }
    if (location === CardLocation.EXTRA) {
      const pile = p.extra || []
      return pile.find((c) => c.sequence === sequence && matchesCode(c)) ?? pile[sequence]
    }
    return undefined
  }

  snapshotCounts(): TrackedCounts[] {
    return this.state.players.map((p) => ({
      lp: p.lp,
      deckCount: p.deckCount,
      extraCount: p.extraCount,
      graveCount: p.graveyard.length,
      removedCount: p.banished.length,
      handCount: p.hand.length,
      mzoneCount: p.mzone.filter(Boolean).length,
      szoneCount: p.szone.filter(Boolean).length + (p.fzone ? 1 : 0)
    }))
  }

  private syncAllCards(): void {
    const list: EngineCard[] = []
    for (const p of this.state.players) {
      if (p.deck) list.push(...p.deck)
      if (p.extra) list.push(...p.extra)
      list.push(...p.hand)
      for (const m of p.mzone) {
        if (m) list.push(m)
      }
      for (const s of p.szone) {
        if (s) list.push(s)
      }
      if (p.fzone) list.push(p.fzone)
      for (const z of p.pzone) {
        if (z) list.push(z)
      }
      list.push(...p.graveyard)
      list.push(...p.banished)
    }
    this.state.allCards = list
  }

  applyMessages(messages: unknown[]): void {
    for (const msg of messages) {
      if (msg instanceof YGOProMsgNewTurn) {
        if (this.turnStarted) {
          this.state.turn++
        }
        this.turnStarted = true
        this.state.turnPlayer = (msg.player === 1 ? 1 : 0) as 0 | 1
      } else if (msg instanceof YGOProMsgNewPhase) {
        this.state.phase = msg.phase
        this.state.phaseName = PHASE_NAMES[msg.phase] || `阶段 (${msg.phase})`
      } else if (msg instanceof YGOProMsgDraw) {
        const p = this.state.players[msg.player]
        if (p) {
          p.deckCount = Math.max(0, p.deckCount - msg.count)
          if (p.deck && p.deck.length > 0) {
            p.deck.splice(0, msg.count)
          }
          for (const code of msg.cards) {
            const cardInfo = cdbService.getCardById(code) || undefined
            p.hand.push({
              instanceId: this.allocateInstanceId('engine'),
              code,
              controller: this.normalizePlayer(msg.player),
              owner: this.normalizePlayer(msg.player),
              location: CardLocation.HAND,
              sequence: p.hand.length,
              position: 0x1,
              overlayMaterials: [],
              card: cardInfo
            })
          }
          this.renumberHand(p)
        }
      } else if (msg instanceof YGOProMsgDamage) {
        const p = this.state.players[msg.player]
        if (p) p.lp = Math.max(0, p.lp - msg.value)
      } else if (msg instanceof YGOProMsgPayLpCost) {
        const p = this.state.players[msg.player]
        if (p) p.lp = Math.max(0, p.lp - msg.cost)
      } else if (msg instanceof YGOProMsgRecover) {
        const p = this.state.players[msg.player]
        if (p) p.lp += msg.value
      } else if (msg instanceof YGOProMsgLpUpdate) {
        const p = this.state.players[msg.player]
        if (p) p.lp = msg.lp
      } else if (msg instanceof YGOProMsgMove) {
        this.handleMove(msg)
      } else if (msg instanceof YGOProMsgSet) {
        const p = this.state.players[msg.controller]
        if (p && msg.location === CardLocation.SZONE && msg.sequence < p.szone.length) {
          if (p.szone[msg.sequence]) {
            p.szone[msg.sequence]!.position = msg.position
          }
        }
      } else if (msg instanceof YGOProMsgPosChange) {
        const p = this.state.players[msg.card.controller]
        if (p) {
          if (msg.card.location === CardLocation.MZONE && p.mzone[msg.card.sequence]) {
            p.mzone[msg.card.sequence]!.position = msg.currentPosition
          } else if (msg.card.location === CardLocation.SZONE && p.szone[msg.card.sequence]) {
            p.szone[msg.card.sequence]!.position = msg.currentPosition
          }
        }
      } else if (msg instanceof YGOProMsgAddCounter) {
        const p = this.state.players[msg.controller]
        if (p) {
          const target =
            msg.location === CardLocation.MZONE ? p.mzone[msg.sequence] : p.szone[msg.sequence]
          if (target) {
            target.counters = target.counters || {}
            target.counters[msg.counterType] = (target.counters[msg.counterType] || 0) + msg.count
          }
        }
      } else if (msg instanceof YGOProMsgRemoveCounter) {
        const p = this.state.players[msg.controller]
        if (p) {
          const target =
            msg.location === CardLocation.MZONE ? p.mzone[msg.sequence] : p.szone[msg.sequence]
          if (target && target.counters && target.counters[msg.counterType]) {
            target.counters[msg.counterType] = Math.max(
              0,
              target.counters[msg.counterType] - msg.count
            )
          }
        }
      } else if (msg instanceof YGOProMsgShuffleHand) {
        const p = this.state.players[msg.player]
        if (p && msg.cards && msg.cards.length > 0) {
          const remaining = [...p.hand]
          const reordered: EngineCard[] = []
          for (const code of msg.cards) {
            const idx = remaining.findIndex((c) => c.code === code)
            if (idx !== -1) {
              const [c] = remaining.splice(idx, 1)
              reordered.push(c)
            }
          }
          reordered.push(...remaining)
          p.hand = reordered
          this.renumberHand(p)
        }
      }
    }
    this.syncAllCards()
  }

  private renumberHand(p: EnginePlayerState): void {
    p.hand.forEach((c, idx) => {
      c.sequence = idx
    })
  }

  private extractCard(
    player: EnginePlayerState,
    from: MoveCardLocation,
    code: number
  ): EngineCard | null {
    const loc = from.location

    if (loc === CardLocation.HAND) {
      let idx = player.hand.findIndex((c) => c.sequence === from.sequence && c.code === code)
      if (idx === -1) {
        idx = player.hand.findIndex((c) => c.sequence === from.sequence)
      }
      if (idx === -1) return null
      const [card] = player.hand.splice(idx, 1)
      this.renumberHand(player)
      return card
    }

    if (loc === CardLocation.MZONE) {
      const slot = player.mzone[from.sequence]
      if (!slot) return null
      player.mzone[from.sequence] = null
      return slot
    }

    if (loc === CardLocation.SZONE) {
      if (from.sequence < player.szone.length) {
        const slot = player.szone[from.sequence]
        if (slot) {
          player.szone[from.sequence] = null
          return slot
        }
      }
      return null
    }

    if (loc === CardLocation.FZONE) {
      const slot = player.fzone
      if (!slot) return null
      player.fzone = null
      return slot
    }

    if (loc === CardLocation.PZONE) {
      const slot = player.pzone[from.sequence]
      if (!slot) return null
      player.pzone[from.sequence] = null
      return slot
    }

    if (loc === CardLocation.OVERLAY) {
      const host = player.mzone[from.sequence]
      if (!host) return null
      const matIdx = host.overlayMaterials.indexOf(code)
      if (matIdx === -1) return null
      host.overlayMaterials.splice(matIdx, 1)
      return {
        instanceId: this.allocateInstanceId('engine'),
        code,
        controller: host.controller,
        owner: host.owner,
        location: loc,
        sequence: from.sequence,
        position: 0x1,
        overlayMaterials: [],
        card: cdbService.getCardById(code) || undefined
      }
    }

    const pile =
      loc === CardLocation.GRAVE
        ? player.graveyard
        : loc === CardLocation.REMOVED
          ? player.banished
          : loc === CardLocation.DECK
            ? player.deck
            : loc === CardLocation.EXTRA
              ? player.extra
              : null
    if (!pile) return null

    let idx = pile.findIndex((c) => c.sequence === from.sequence && c.code === code)
    if (idx === -1) {
      idx = pile.findIndex((c) => c.sequence === from.sequence)
    }
    if (idx === -1) {
      const codeMatches = pile.reduce<number[]>((acc, c, i) => {
        if (c.code === code) acc.push(i)
        return acc
      }, [])
      if (codeMatches.length === 1) idx = codeMatches[0]
    }
    if (idx === -1) return null
    const [card] = pile.splice(idx, 1)
    if (loc === CardLocation.GRAVE) player.graveCount = player.graveyard.length
    else if (loc === CardLocation.REMOVED) player.removedCount = player.banished.length
    else if (loc === CardLocation.DECK) player.deckCount = Math.max(0, player.deckCount - 1)
    else if (loc === CardLocation.EXTRA) player.extraCount = Math.max(0, player.extraCount - 1)
    return card
  }

  private placeCard(player: EnginePlayerState, to: MoveCardLocation, card: EngineCard): void {
    const loc = to.location

    if (loc === CardLocation.HAND) {
      player.hand.push(card)
      this.renumberHand(player)
      return
    }

    if (loc === CardLocation.MZONE) {
      if (to.sequence < player.mzone.length) {
        player.mzone[to.sequence] = card
      }
      return
    }

    if (loc === CardLocation.FZONE) {
      player.fzone = card
      return
    }

    if (loc === CardLocation.SZONE) {
      if (card.location === CardLocation.FZONE) {
        player.fzone = card
      } else if (to.sequence < player.szone.length) {
        player.szone[to.sequence] = card
      }
      return
    }

    if (loc === CardLocation.PZONE) {
      if (to.sequence < player.pzone.length) {
        player.pzone[to.sequence] = card
      }
      return
    }

    if (loc === CardLocation.OVERLAY) {
      const host = player.mzone[to.sequence]
      if (host) {
        host.overlayMaterials.push(card.code)
      }
      return
    }

    if (loc === CardLocation.GRAVE) {
      player.graveyard.push(card)
      player.graveCount = player.graveyard.length
      return
    }

    if (loc === CardLocation.REMOVED) {
      player.banished.push(card)
      player.removedCount = player.banished.length
      return
    }

    if (loc === CardLocation.DECK) {
      player.deck = player.deck || []
      player.deck.push(card)
      player.deckCount++
      return
    }

    if (loc === CardLocation.EXTRA) {
      player.extra = player.extra || []
      player.extra.push(card)
      player.extraCount++
    }
  }

  private handleMove(msg: YGOProMsgMove): void {
    const fromP = this.state.players[this.normalizePlayer(msg.previous.controller)]
    const toP = this.state.players[this.normalizePlayer(msg.current.controller)]
    if (!fromP || !toP) return

    let movedCard = this.extractCard(fromP, msg.previous, msg.code)

    if (movedCard) {
      movedCard.code = msg.code || movedCard.code
      movedCard.controller = this.normalizePlayer(msg.current.controller)
      movedCard.location = msg.current.location
      movedCard.sequence = msg.current.sequence
      movedCard.position = msg.current.position
      if (!movedCard.card && movedCard.code) {
        movedCard.card = cdbService.getCardById(movedCard.code) || undefined
      }
    } else {
      movedCard = {
        instanceId: this.allocateInstanceId(msg.code ? 'engine' : 'token'),
        code: msg.code,
        controller: this.normalizePlayer(msg.current.controller),
        owner: this.normalizePlayer(msg.current.controller),
        location: msg.current.location,
        sequence: msg.current.sequence,
        position: msg.current.position,
        overlayMaterials: [],
        card: msg.code ? cdbService.getCardById(msg.code) || undefined : undefined
      }
    }

    this.placeCard(toP, msg.current, movedCard)
  }
}
