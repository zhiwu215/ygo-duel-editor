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

export class BoardTracker {
  private state: EngineBoardState

  constructor(p0Lp = 8000, p1Lp = 8000) {
    this.state = this.createInitialState(p0Lp, p1Lp)
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
      mzone: [null, null, null, null, null, null, null],
      szone: [null, null, null, null, null, null],
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
  }

  getState(): EngineBoardState {
    this.syncAllCards()
    return JSON.parse(JSON.stringify(this.state))
  }

  setState(state: EngineBoardState): void {
    this.state = JSON.parse(JSON.stringify(state))
  }

  initializeDecks(
    p0DeckCodes: number[],
    p0ExtraCodes: number[],
    p1DeckCodes: number[],
    p1ExtraCodes: number[]
  ): void {
    const makeCards = (codes: number[], player: 0 | 1, location: number): EngineCard[] => {
      return codes.map((code, idx) => ({
        instanceId: `card-${code}-${player}-${location}-${idx}`,
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
      p.hand.forEach((c, idx) => {
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
      list.push(...p.graveyard)
      list.push(...p.banished)
    }
    this.state.allCards = list
  }

  applyMessages(messages: unknown[]): void {
    for (const msg of messages) {
      if (msg instanceof YGOProMsgNewTurn) {
        this.state.turnPlayer = (msg.player === 1 ? 1 : 0) as 0 | 1
        this.state.turn++
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
              instanceId: `card-${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              code,
              controller: (msg.player === 1 ? 1 : 0) as 0 | 1,
              owner: (msg.player === 1 ? 1 : 0) as 0 | 1,
              location: CardLocation.HAND,
              sequence: p.hand.length,
              position: 0x1,
              overlayMaterials: [],
              card: cardInfo
            })
          }
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
          reordered.forEach((c, idx) => {
            c.sequence = idx
          })
          p.hand = reordered
        }
      }
    }
    this.syncAllCards()
  }

  private handleMove(msg: YGOProMsgMove): void {
    const fromP = this.state.players[msg.previous.controller]
    const toP = this.state.players[msg.current.controller]
    if (!fromP || !toP) return

    let movedCard: EngineCard | null = null

    // 1. 从原位置移除
    if (msg.previous.location === CardLocation.HAND) {
      const idx = fromP.hand.findIndex(
        (c) => c.code === msg.code || c.sequence === msg.previous.sequence
      )
      if (idx !== -1) {
        movedCard = fromP.hand.splice(idx, 1)[0]
      }
    } else if (msg.previous.location === CardLocation.MZONE) {
      if (fromP.mzone[msg.previous.sequence]) {
        movedCard = fromP.mzone[msg.previous.sequence]
        fromP.mzone[msg.previous.sequence] = null
      }
    } else if (msg.previous.location === CardLocation.SZONE) {
      if (fromP.szone[msg.previous.sequence]) {
        movedCard = fromP.szone[msg.previous.sequence]
        fromP.szone[msg.previous.sequence] = null
      }
    } else if (msg.previous.location === CardLocation.GRAVE) {
      const idx = fromP.graveyard.findIndex((c) => c.code === msg.code)
      if (idx !== -1) movedCard = fromP.graveyard.splice(idx, 1)[0]
      fromP.graveCount = fromP.graveyard.length
    } else if (msg.previous.location === CardLocation.REMOVED) {
      const idx = fromP.banished.findIndex((c) => c.code === msg.code)
      if (idx !== -1) movedCard = fromP.banished.splice(idx, 1)[0]
      fromP.removedCount = fromP.banished.length
    } else if (msg.previous.location === CardLocation.DECK) {
      fromP.deckCount = Math.max(0, fromP.deckCount - 1)
      if (fromP.deck && fromP.deck.length > 0) {
        const idx = fromP.deck.findIndex((c) => c.code === msg.code)
        if (idx !== -1) movedCard = fromP.deck.splice(idx, 1)[0]
        else movedCard = fromP.deck.shift() || null
      }
    } else if (msg.previous.location === CardLocation.EXTRA) {
      fromP.extraCount = Math.max(0, fromP.extraCount - 1)
      if (fromP.extra && fromP.extra.length > 0) {
        const idx = fromP.extra.findIndex((c) => c.code === msg.code)
        if (idx !== -1) movedCard = fromP.extra.splice(idx, 1)[0]
        else movedCard = fromP.extra.shift() || null
      }
    }

    // 构造或更新移动卡片信息
    if (!movedCard) {
      movedCard = {
        instanceId: `card-${msg.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        code: msg.code,
        controller: (msg.current.controller === 1 ? 1 : 0) as 0 | 1,
        owner: (msg.current.controller === 1 ? 1 : 0) as 0 | 1,
        location: msg.current.location,
        sequence: msg.current.sequence,
        position: msg.current.position,
        overlayMaterials: [],
        card: cdbService.getCardById(msg.code) || undefined
      }
    } else {
      movedCard.code = msg.code || movedCard.code
      movedCard.controller = (msg.current.controller === 1 ? 1 : 0) as 0 | 1
      movedCard.location = msg.current.location
      movedCard.sequence = msg.current.sequence
      movedCard.position = msg.current.position
      if (!movedCard.card && movedCard.code) {
        movedCard.card = cdbService.getCardById(movedCard.code) || undefined
      }
    }

    // 2. 放置到新位置
    if (msg.current.location === CardLocation.HAND) {
      toP.hand.push(movedCard)
    } else if (msg.current.location === CardLocation.MZONE) {
      if (msg.current.sequence < toP.mzone.length) {
        toP.mzone[msg.current.sequence] = movedCard
      }
    } else if (msg.current.location === CardLocation.SZONE) {
      if (msg.current.sequence < toP.szone.length) {
        toP.szone[msg.current.sequence] = movedCard
      }
    } else if (msg.current.location === CardLocation.GRAVE) {
      toP.graveyard.push(movedCard)
      toP.graveCount = toP.graveyard.length
    } else if (msg.current.location === CardLocation.REMOVED) {
      toP.banished.push(movedCard)
      toP.removedCount = toP.banished.length
    } else if (msg.current.location === CardLocation.DECK) {
      toP.deckCount++
      if (toP.deck) toP.deck.push(movedCard)
    } else if (msg.current.location === CardLocation.EXTRA) {
      toP.extraCount++
      if (toP.extra) toP.extra.push(movedCard)
    }
  }
}
