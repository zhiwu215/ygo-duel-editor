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
  hoveredInstanceId: string | null

  // 动作
  setMasterRule: (rule: MasterRule) => void
  setTitle: (title: string) => void
  setHint: (hint: string) => void
  setPlayerLp: (player: 0 | 1, lp: number) => void
  setTurnPlayer: (player: 0 | 1) => void
  setFirstTurnAttack: (allow: boolean) => void

  // 卡片操作
  /**
   * 向指定区域和格子槽位中新增放置一张卡片
   *
   * **参数说明：**
   * - `card`：卡片数据库原型对象 (CdbCard)
   * - `controller`：放置的控制者方 (0: 我方, 1: 对方)
   * - `location`：目标区域 (CardLocation，如 MZONE、SZONE、HAND、GRAVE 等)
   * - `sequence`：目标格子序号 (0~4；牌堆区域会自动追加到末尾)
   * - `position`：可选，卡片表示形式 (CardPosition；缺省时按目标区域惯例赋予默认表示)
   */
  addCardToZone: (
    card: CdbCard,
    controller: 0 | 1,
    location: number,
    sequence: number,
    position?: number
  ) => void
  /**
   * 移动场上或手牌中的卡片至目标区域与槽位
   *
   * **参数说明：**
   * - `instanceId`：要移动卡片的唯一实例 ID（UUID，非卡密 code）
   * - `toLocation`：目标区域（CardLocation，如 MZONE、SZONE、HAND、GRAVE 等）
   * - `toSequence`：目标格子序号（如怪兽/魔陷区 0~4；牌堆区域会自动追加到末尾）
   * - `toController`：可选，目标控制者（0: 我方, 1: 对方；缺省时保持原控制者）
   * - `customPos`：可选，自定义卡片表示形式（CardPosition；如按住 Ctrl 拖拽切换默认放置状态）
   *
   * @param instanceId 要移动卡片的唯一实例 ID
   * @param toLocation 目标区域
   * @param toSequence 目标格子序号
   * @param toController 可选，目标控制者 (0: 我方, 1: 对方)
   * @param customPos 可选，自定义卡片表示形式
   */
  moveCard: (
    instanceId: string,
    toLocation: number,
    toSequence: number,
    toController?: 0 | 1,
    customPos?: number
  ) => void
  removeCard: (instanceId: string) => void
  updateCardPosition: (instanceId: string, position: number) => void
  addOverlayMaterial: (targetInstanceId: string, matCode: number) => void
  removeOverlayMaterial: (targetInstanceId: string, matIndex: number) => void
  /** 将新卡作为顶层主怪兽卡，原怪兽及原有素材全部垫在下方作为素材 */
  overlayOnTop: (
    targetInstanceId: string,
    newCardData: CdbCard,
    sourceCardInstanceId?: string
  ) => void
  /** 将某张素材与顶层主怪兽互换位置 */
  swapHostWithMaterial: (targetInstanceId: string, matIndex: number) => void
  /** 拔除某张素材并送去指定区域（如墓地、手牌、除外） */
  detachMaterialToLocation: (
    targetInstanceId: string,
    matIndex: number,
    targetLocation: number
  ) => void
  /** 调整超量素材的层叠顺序 */
  reorderOverlayMaterials: (targetInstanceId: string, fromIndex: number, toIndex: number) => void
  /** 更新指定场上卡片的 CDB 详情数据缓存 */
  setCardData: (instanceId: string, card: CdbCard) => void
  /**
   * 调整堆叠型区域（如主卡组、额外卡组、墓地、除外区）内卡片的排序位置
   *
   * @param controller 控制者 (0: 我方, 1: 对方)
   * @param location 区域 (CardLocation)
   * @param fromIndex 当前索引位置
   * @param toIndex 目标索引位置
   */
  reorderPileCards: (
    controller: 0 | 1,
    location: number,
    fromIndex: number,
    toIndex: number
  ) => void

  // 整体替换 / 重置
  loadState: (newState: DuelPuzzleState) => void
  resetDuel: () => void
  swapSides: () => void

  // UI 交互
  setSelectedCardId: (id: string | null) => void
  setHoveredCard: (card: CdbCard | null) => void
  setHoveredInstanceId: (id: string | null) => void
}

export const useDuelStore = create<DuelStoreState>()(
  temporal(
    (set) => ({
      state: createInitialDuelState(5),
      selectedCardId: null,
      hoveredCard: null,
      hoveredInstanceId: null,

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

          // 默认表示形式: 魔陷/卡组/额外/手牌盖放 (手牌盖放=未公开, 编排者仍可见卡面),
          // 墓地/除外/灵摆表侧, 怪兽表攻
          let defaultPos: number = CardPosition.FACEUP_ATTACK
          if (
            location === CardLocation.SZONE ||
            location === CardLocation.DECK ||
            location === CardLocation.EXTRA ||
            location === CardLocation.HAND
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
          const existingPile = prev.state.cards
            .filter((c) => c.controller === controller && c.location === location)
            .sort((a, b) => a.sequence - b.sequence)

          let targetSeq = isPileZone ? existingPile.length : sequence
          let updatedCards = prev.state.cards

          if (isPileZone) {
            const insertIdx =
              sequence !== undefined && sequence >= 0 && sequence <= existingPile.length
                ? sequence
                : existingPile.length
            targetSeq = insertIdx

            if (insertIdx < existingPile.length) {
              const seqShiftMap = new Map<string, number>()
              existingPile.forEach((c, idx) => {
                if (idx >= insertIdx) {
                  seqShiftMap.set(c.instanceId, idx + 1)
                }
              })
              updatedCards = prev.state.cards.map((c) => {
                if (seqShiftMap.has(c.instanceId)) {
                  return { ...c, sequence: seqShiftMap.get(c.instanceId)! }
                }
                return c
              })
            }
          }

          const filteredCards = isPileZone
            ? updatedCards
            : updatedCards.filter(
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

      /**
       * 移动场上或手牌中的卡片至新位置
       * @param instanceId 要移动卡片的唯一实例 ID
       * @param toLocation 目标区域 (CardLocation，如 MZONE/SZONE/HAND/GRAVE 等)
       * @param toSequence 目标格子序号 (如 0~4；牌堆区域会自动追加到末尾)
       * @param toController 可选，目标控制者 (0: 我方, 1: 对方；缺省时保持原控制者)
       * @param customPos 可选，自定义卡片表示形式 (CardPosition；如按住 Ctrl 拖拽切换默认放置状态)
       */
      moveCard: (instanceId, toLocation, toSequence, toController, customPos) =>
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
          let updatedCards = prev.state.cards

          if (isPileZone) {
            const targetPiles = prev.state.cards
              .filter(
                (c) =>
                  c.controller === ctrl && c.location === toLocation && c.instanceId !== instanceId
              )
              .sort((a, b) => a.sequence - b.sequence)

            const insertIdx =
              toSequence !== undefined && toSequence >= 0 && toSequence <= targetPiles.length
                ? toSequence
                : targetPiles.length
            seq = insertIdx

            if (insertIdx < targetPiles.length) {
              const seqShiftMap = new Map<string, number>()
              targetPiles.forEach((c, idx) => {
                if (idx >= insertIdx) {
                  seqShiftMap.set(c.instanceId, idx + 1)
                }
              })
              updatedCards = prev.state.cards.map((c) => {
                if (seqShiftMap.has(c.instanceId)) {
                  return { ...c, sequence: seqShiftMap.get(c.instanceId)! }
                }
                return c
              })
            }
          }

          // 表示形式：customPos (如 Ctrl 拖入切换放置状态) 优先级最高；
          // 否则跨区域移动按目标区域惯例给默认表示，同区域内移动保持原表示
          const sameZone = targetCard.location === toLocation
          let newPos = targetCard.position
          if (customPos !== undefined) {
            newPos = customPos
          } else if (!sameZone) {
            if (toLocation === CardLocation.SZONE) {
              newPos = CardPosition.FACEDOWN // 魔陷默认盖放 (与搜索拖入一致)
            } else if (toLocation === CardLocation.MZONE) {
              newPos = CardPosition.FACEUP_ATTACK // 怪兽默认表攻
            } else if (toLocation === CardLocation.HAND) {
              newPos = CardPosition.FACEDOWN // 手牌默认未公开 (编排者仍可见卡面)
            } else if (toLocation === CardLocation.DECK || toLocation === CardLocation.EXTRA) {
              newPos = CardPosition.FACEDOWN
            } else if (
              toLocation === CardLocation.GRAVE ||
              toLocation === CardLocation.REMOVED ||
              toLocation === CardLocation.PZONE
            ) {
              newPos = CardPosition.FACEUP
            }
          }

          const finalCards = updatedCards.map((c) => {
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
              cards: finalCards
            }
          }
        }),

      removeCard: (instanceId) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.filter((c) => c.instanceId !== instanceId)
          },
          selectedCardId: prev.selectedCardId === instanceId ? null : prev.selectedCardId,
          hoveredInstanceId: prev.hoveredInstanceId === instanceId ? null : prev.hoveredInstanceId
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

      // 1. 新怪兽置顶叠放（重叠超量做场：新怪兽当大哥，原怪兽与老素材垫在下方）
      overlayOnTop: (targetInstanceId, newCardData, sourceCardInstanceId) =>
        set((prev) => {
          let sourceMats: number[] = []
          if (sourceCardInstanceId) {
            const src = prev.state.cards.find((c) => c.instanceId === sourceCardInstanceId)
            if (src && src.overlayMaterials) {
              // 若来源怪兽自身带有素材，根据规则将其已有素材全数抽出垫入新怪兽底下
              sourceMats = src.overlayMaterials
            }
          }

          let updatedCards = prev.state.cards
          if (sourceCardInstanceId) {
            // 来源怪兽已被搬移至目标格，清空其原本占用的场上旧格子，防止一卡双份
            updatedCards = updatedCards.filter((c) => c.instanceId !== sourceCardInstanceId)
          }

          return {
            state: {
              // 保留生命值、规则版本等其他局面信息不变
              ...prev.state,
              cards: updatedCards.map((c) => {
                // 遍历场上的卡，不是目标格子的怪兽就原样返回
                if (c.instanceId === targetInstanceId) {
                  return {
                    // 继承原卡片在场上的位置(格子)、控制者与攻守表示形式等不变
                    ...c,
                    // 把顶层怪兽卡密换成新卡
                    code: newCardData.id,
                    // 把卡片详情换成新卡的数据
                    card: newCardData,
                    // 重新排布素材的千层饼结构
                    overlayMaterials: [
                      // 最底下：原本肚子里的老素材
                      ...c.overlayMaterials,
                      // 中间层：原怪兽自己退居二线，变成素材
                      c.code,
                      // 如果搬过来的新怪兽本身也有素材，也一并垫进去
                      ...sourceMats
                    ]
                  }
                }
                return c
              })
            },
            // 叠放完成后，界面上的选中高亮蓝框会自动平滑转移到新的目标怪兽上
            selectedCardId:
              prev.selectedCardId === sourceCardInstanceId ? targetInstanceId : prev.selectedCardId
          }
        }),

      // 更新指定场上卡片的 CDB 详情数据缓存
      setCardData: (instanceId, card) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => (c.instanceId === instanceId ? { ...c, card } : c))
          }
        })),

      // 2. 顶层主怪兽与指定素材互换位置（设为主怪兽）
      swapHostWithMaterial: (targetInstanceId, matIndex) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === targetInstanceId) {
                // 边界检查：若素材索引越界则不作修改
                if (matIndex < 0 || matIndex >= c.overlayMaterials.length) return c
                const oldHostCode = c.code
                const newHostCode = c.overlayMaterials[matIndex]
                const newMats = [...c.overlayMaterials]
                // 将被提升的素材位置替换为原主怪兽卡密
                newMats[matIndex] = oldHostCode
                return {
                  ...c,
                  code: newHostCode,
                  // 清空 card 详情以触发自动重新拉取新主怪兽的 CDB 详情
                  card: undefined,
                  overlayMaterials: newMats
                }
              }
              return c
            })
          }
        })),

      // 3. 拔除素材送至指定目标区域（如墓地、手牌、除外）并在目标区域生成新卡片实例
      detachMaterialToLocation: (targetInstanceId, matIndex, targetLocation) =>
        set((prev) => {
          const host = prev.state.cards.find((c) => c.instanceId === targetInstanceId)
          if (!host || matIndex < 0 || matIndex >= host.overlayMaterials.length) return prev
          const matCode = host.overlayMaterials[matIndex]
          const newMats = [...host.overlayMaterials]
          // 从超量怪兽肚子里移除该素材
          newMats.splice(matIndex, 1)

          // 计算目标堆叠区域当前张数，以此作为新卡落位的 sequence 序号
          const existingPile = prev.state.cards
            .filter((c) => c.controller === host.controller && c.location === targetLocation)
            .sort((a, b) => a.sequence - b.sequence)
          const targetSeq = existingPile.length

          // 生成离开素材堆后的全新独立卡片实例
          const newCard: FieldCard = {
            instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            code: matCode,
            controller: host.controller,
            owner: host.controller,
            location: targetLocation,
            sequence: targetSeq,
            position:
              targetLocation === CardLocation.HAND ? CardPosition.FACEDOWN : CardPosition.FACEUP,
            overlayMaterials: []
          }

          return {
            state: {
              ...prev.state,
              cards: [
                // 更新宿主怪兽的素材列表
                ...prev.state.cards.map((c) =>
                  c.instanceId === targetInstanceId ? { ...c, overlayMaterials: newMats } : c
                ),
                // 将拔除出的卡片加入到目标区域
                newCard
              ]
            }
          }
        }),

      // 4. 重排超量素材层叠顺序（做场时调整谁在上谁在下）
      reorderOverlayMaterials: (targetInstanceId, fromIndex, toIndex) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === targetInstanceId) {
                const mats = [...c.overlayMaterials]
                // 索引有效性校验
                if (
                  fromIndex < 0 ||
                  fromIndex >= mats.length ||
                  toIndex < 0 ||
                  toIndex >= mats.length ||
                  fromIndex === toIndex
                ) {
                  return c
                }
                // 从原位置移出并插入至目标位置
                const [moved] = mats.splice(fromIndex, 1)
                mats.splice(toIndex, 0, moved)
                return { ...c, overlayMaterials: mats }
              }
              return c
            })
          }
        })),

      reorderPileCards: (controller, location, fromIndex, toIndex) =>
        set((prev) => {
          const pile = prev.state.cards
            .filter((c) => c.controller === controller && c.location === location)
            .sort((a, b) => a.sequence - b.sequence)

          if (
            fromIndex < 0 ||
            fromIndex >= pile.length ||
            toIndex < 0 ||
            toIndex >= pile.length ||
            fromIndex === toIndex
          ) {
            return prev
          }

          const reordered = [...pile]
          const [movedCard] = reordered.splice(fromIndex, 1)
          reordered.splice(toIndex, 0, movedCard)

          const seqMap = new Map<string, number>()
          reordered.forEach((c, idx) => {
            seqMap.set(c.instanceId, idx)
          })

          return {
            state: {
              ...prev.state,
              cards: prev.state.cards.map((c) => {
                if (seqMap.has(c.instanceId)) {
                  return { ...c, sequence: seqMap.get(c.instanceId)! }
                }
                return c
              })
            }
          }
        }),

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

      swapSides: () =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => ({
              ...c,
              controller: (c.controller === 0 ? 1 : 0) as 0 | 1
            })),
            players: [prev.state.players[1], prev.state.players[0]],
            turnPlayer: (prev.state.turnPlayer === 0 ? 1 : 0) as 0 | 1
          },
          selectedCardId: null
        })),

      setSelectedCardId: (id) => set({ selectedCardId: id }),
      setHoveredCard: (card) => set({ hoveredCard: card }),
      setHoveredInstanceId: (id) => set({ hoveredInstanceId: id })
    }),
    {
      // zundo 撤销历史配置：只追踪 state 的变化
      partialize: (state) => ({ state: state.state }),
      limit: 50
    }
  )
)
