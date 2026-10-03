import { create } from 'zustand'
import { temporal } from 'zundo'
import {
  DuelPuzzleState,
  FieldCard,
  MasterRule,
  PlayerState,
  createInitialDuelState,
  CardLocation,
  CardPosition,
  CdbCard
} from '@shared/index'

interface DuelStoreState {
  // 核心战场状态
  state: DuelPuzzleState

  // 选中与悬停交互
  selectedCardId: string | null
  hoveredCard: CdbCard | null

  // 动作
  setMasterRule: (rule: MasterRule) => void
  setTitle: (title: string) => void
  setHint: (hint: string) => void
  setPlayerLp: (player: 0 | 1, lp: number) => void
  setTurnPlayer: (player: 0 | 1) => void
  setFirstTurnAttack: (allow: boolean) => void

  // 卡片操作
  addCardToZone: (
    card: CdbCard,
    controller: 0 | 1,
    location: number,
    sequence: number,
    position?: number
  ) => void
  moveCard: (
    instanceId: string,
    toLocation: number,
    toSequence: number,
    toController?: 0 | 1
  ) => void
  removeCard: (instanceId: string) => void
  updateCardPosition: (instanceId: string, position: number) => void
  addOverlayMaterial: (targetInstanceId: string, matCode: number) => void
  removeOverlayMaterial: (targetInstanceId: string, matIndex: number) => void

  // 整体替换 / 重置
  loadState: (newState: DuelPuzzleState) => void
  resetDuel: () => void

  // UI 交互
  setSelectedCardId: (id: string | null) => void
  setHoveredCard: (card: CdbCard | null) => void
}

export const useDuelStore = create<DuelStoreState>()(
  temporal(
    (set) => ({
      state: createInitialDuelState(5),
      selectedCardId: null,
      hoveredCard: null,

      setMasterRule: (rule) =>
        set((prev) => {
          // 如果切回 MR1/2/3，移除额外怪兽区中已放置的卡片到额外卡组或主怪兽区
          let newCards = [...prev.state.cards]
          if (rule <= 3) {
            newCards = newCards.filter(
              (c) => !(c.location === CardLocation.MZONE && (c.sequence === 5 || c.sequence === 6))
            )
          }
          return {
            state: { ...prev.state, masterRule: rule, cards: newCards }
          }
        }),

      setTitle: (title) =>
        set((prev) => ({
          state: { ...prev.state, title }
        })),

      setHint: (hint) =>
        set((prev) => ({
          state: { ...prev.state, hint }
        })),

      setPlayerLp: (player, lp) =>
        set((prev) => {
          const updatedLp = Math.max(0, lp)
          const players: [PlayerState, PlayerState] = [
            player === 0 ? { ...prev.state.players[0], lp: updatedLp } : prev.state.players[0],
            player === 1 ? { ...prev.state.players[1], lp: updatedLp } : prev.state.players[1]
          ]
          return {
            state: { ...prev.state, players }
          }
        }),

      setTurnPlayer: (player) =>
        set((prev) => ({
          state: { ...prev.state, turnPlayer: player }
        })),

      setFirstTurnAttack: (allow) =>
        set((prev) => ({
          state: { ...prev.state, firstTurnAttack: allow }
        })),

      addCardToZone: (card, controller, location, sequence, customPos) =>
        set((prev) => {
          const isPileZone =
            location === CardLocation.HAND ||
            location === CardLocation.GRAVE ||
            location === CardLocation.DECK ||
            location === CardLocation.EXTRA ||
            location === CardLocation.REMOVED

          // 默认表示形式: 墓地/除外表侧, 魔陷/卡组/额外盖放, 怪兽表攻
          let defaultPos: number = CardPosition.FACEUP_ATTACK
          if (
            location === CardLocation.SZONE ||
            location === CardLocation.DECK ||
            location === CardLocation.EXTRA
          ) {
            defaultPos = CardPosition.FACEDOWN
          } else if (
            location === CardLocation.GRAVE ||
            location === CardLocation.REMOVED ||
            location === CardLocation.PZONE
          ) {
            defaultPos = CardPosition.FACEUP
          }
          const pos = customPos !== undefined ? customPos : defaultPos

          // 堆叠型区域按已有数量计算新序号；离散格子则替换/覆盖同位置旧卡
          const existingPile = prev.state.cards.filter(
            (c) => c.controller === controller && c.location === location
          )
          const targetSeq = isPileZone ? existingPile.length : sequence

          const filteredCards = isPileZone
            ? prev.state.cards
            : prev.state.cards.filter(
                (c) =>
                  !(
                    c.controller === controller &&
                    c.location === location &&
                    c.sequence === sequence
                  )
              )

          const newCard: FieldCard = {
            instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            code: card.id,
            card,
            controller,
            owner: controller,
            location,
            sequence: targetSeq,
            position: pos,
            overlayMaterials: []
          }

          return {
            state: {
              ...prev.state,
              cards: [...filteredCards, newCard]
            },
            selectedCardId: newCard.instanceId,
            hoveredCard: card
          }
        }),

      moveCard: (instanceId, toLocation, toSequence, toController) =>
        set((prev) => {
          const targetCard = prev.state.cards.find((c) => c.instanceId === instanceId)
          if (!targetCard) return prev

          const ctrl = toController !== undefined ? toController : targetCard.controller

          const isPileZone =
            toLocation === CardLocation.HAND ||
            toLocation === CardLocation.GRAVE ||
            toLocation === CardLocation.DECK ||
            toLocation === CardLocation.EXTRA ||
            toLocation === CardLocation.REMOVED

          let seq = toSequence
          if (isPileZone) {
            const targetPiles = prev.state.cards.filter(
              (c) =>
                c.controller === ctrl && c.location === toLocation && c.instanceId !== instanceId
            )
            seq = targetPiles.length
          }

          let newPos = targetCard.position
          if (toLocation === CardLocation.DECK || toLocation === CardLocation.EXTRA) {
            newPos = CardPosition.FACEDOWN
          } else if (
            toLocation === CardLocation.GRAVE ||
            toLocation === CardLocation.REMOVED ||
            toLocation === CardLocation.PZONE
          ) {
            newPos = CardPosition.FACEUP
          }

          const updatedCards = prev.state.cards.map((c) => {
            if (c.instanceId === instanceId) {
              return {
                ...c,
                location: toLocation,
                sequence: seq,
                controller: ctrl,
                position: newPos
              }
            }
            return c
          })

          return {
            state: {
              ...prev.state,
              cards: updatedCards
            }
          }
        }),

      removeCard: (instanceId) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.filter((c) => c.instanceId !== instanceId)
          },
          selectedCardId: prev.selectedCardId === instanceId ? null : prev.selectedCardId
        })),

      updateCardPosition: (instanceId, position) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) =>
              c.instanceId === instanceId ? { ...c, position } : c
            )
          }
        })),

      addOverlayMaterial: (targetInstanceId, matCode) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === targetInstanceId) {
                return {
                  ...c,
                  overlayMaterials: [...c.overlayMaterials, matCode]
                }
              }
              return c
            })
          }
        })),

      removeOverlayMaterial: (targetInstanceId, matIndex) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === targetInstanceId) {
                const newMats = [...c.overlayMaterials]
                newMats.splice(matIndex, 1)
                return { ...c, overlayMaterials: newMats }
              }
              return c
            })
          }
        })),

      loadState: (newState) =>
        set(() => ({
          state: newState,
          selectedCardId: null
        })),

      resetDuel: () =>
        set((prev) => ({
          state: createInitialDuelState(prev.state.masterRule),
          selectedCardId: null,
          hoveredCard: null
        })),

      setSelectedCardId: (id) => set({ selectedCardId: id }),
      setHoveredCard: (card) => set({ hoveredCard: card })
    }),
    {
      // zundo 撤销历史配置：只追踪 state 的变化
      partialize: (state) => ({ state: state.state }),
      limit: 50
    }
  )
)
