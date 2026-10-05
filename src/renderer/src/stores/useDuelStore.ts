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
  CardType,
  CdbCard,
  DuelStep,
  DuelPhase,
  DuelActionType,
  Duelist,
  MatchConfig,
  DuelSceneSnapshot,
  getMatchScenarioKey,
  createDefaultDuelists,
  normalizeDuelState,
  createLightweightSnapshot,
  DeckData,
  DuelType
} from '@shared/index'
import { inferMoveAction, inferPositionChangeAction } from '../utils/duelActionInference'

interface DuelStoreState {
  // 装载卡组到对局
  applyDeckToPlayer: (player: 0 | 1, deck: DeckData, drawCount?: number, duelistId?: string) => void
  // 核心战场状态
  state: DuelPuzzleState

  // 多人手牌交互
  expandedDuelistId: string | null
  setExpandedDuelistId: (id: string | null) => void

  // 当前查看的决斗者 (多人时决定棋盘主卡组/额外卡组等区域归属谁)
  activeDuelistId: string | null
  setActiveDuelistId: (id: string | null) => void

  // 多人对阵场景与角色管理
  switchMatchConfig: (config: MatchConfig) => void
  updateDuelist: (duelistId: string, patch: Partial<Duelist>) => void
  setFirstDuelist: (duelistId: string) => void
  setDuelistTurnOrder: (duelistId: string, newOrder: number) => void
  toggleSharedLp: () => void

  // 选中与悬停交互
  selectedCardId: string | null
  activeStatPopoverCardId: string | null
  statPopoverPosition: { x: number; y: number } | null
  hoveredCard: CdbCard | null
  hoveredInstanceId: string | null
  tacticalView: boolean

  // 左侧栏模态 (VSCode 风格活动栏与多模态面板)
  activeLeftTab: 'archives' | 'library' | 'card' | 'agent'
  isLeftOpen: boolean
  leftWidth: number
  setActiveLeftTab: (tab: 'archives' | 'library' | 'card' | 'agent') => void
  setLeftOpen: (open: boolean) => void
  toggleLeftTab: (tab: 'archives' | 'library' | 'card' | 'agent') => void
  setLeftWidth: (width: number) => void
  loadProjectAndStart: (state: DuelPuzzleState) => void

  // 右侧栏模态与剧情步骤编排
  activeRightTab: 'search' | 'steps'
  currentStepIndex: number | null
  isScreenplayOpen: boolean
  selectedStepId: string | null

  // 决斗推进时序与实战自动记谱
  currentTurn: number
  currentPhase: DuelPhase
  currentChain: number
  activeTurnPlayer: 0 | 1 // 当前推演回合所属玩家 (独立于初始先攻方)
  isAutoRecording: boolean

  setCurrentTurn: (turn: number) => void
  setCurrentPhase: (phase: DuelPhase) => void
  setCurrentChain: (chain: number) => void
  resetChain: () => void
  nextPhase: () => void
  nextTurn: () => void
  setActiveTurnPlayer: (player: 0 | 1) => void
  setIsAutoRecording: (recording: boolean) => void
  previewStepBoard: (stepIndex: number | null) => void

  /** 记录一条决斗操作至步骤流中 */
  recordAction: (params: {
    actionType: DuelActionType
    card?: { code: number; name?: string }
    actionPlayer?: 0 | 1
    fromLocation?: number
    fromSequence?: number
    toLocation?: number
    toSequence?: number
    chainIndex?: number
    description?: string
  }) => void

  // 决斗盘实战动作执行器 (直接在盘面上打牌并自动记谱)
  executeActivateCard: (instanceId: string) => void
  executeChainCard: (instanceId: string) => void
  executeAttackCard: (instanceId: string) => void
  executeNormalSummon: (instanceId: string) => void
  executeSpecialSummon: (instanceId: string) => void
  executeSetCard: (instanceId: string) => void
  executeDrawCard: (controller: 0 | 1) => void
  executeSendToGrave: (instanceId: string) => void
  executeBanishCard: (instanceId: string) => void

  setActiveRightTab: (tab: 'search' | 'steps') => void
  setCurrentStepIndex: (index: number | null) => void
  setIsScreenplayOpen: (open: boolean) => void
  setSelectedStepId: (id: string | null) => void
  openScreenplayWithStep: (stepId?: string | null) => void
  addStep: (step: Omit<DuelStep, 'id'>) => void
  updateStep: (stepId: string, patch: Partial<DuelStep>) => void
  deleteStep: (stepId: string) => void
  moveStep: (stepId: string, direction: 'up' | 'down') => void
  clearSteps: () => void

  // 动作
  setActiveStatPopoverCardId: (id: string | null) => void
  setStatPopoverPosition: (pos: { x: number; y: number } | null) => void
  openStatPopover: (id: string, initialPos?: { x: number; y: number }) => void
  closeStatPopover: () => void
  /** 设置规则（如大师规则3） */
  setMasterRule: (rule: MasterRule) => void
  /** 设置决斗类型（如残局、Combo） */
  setDuelType: (type: DuelType) => void
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
    position?: number,
    duelistId?: string
  ) => void
  /**
   * 整体写入一份场面布局（AI 复盘 / 批量导入共用）
   *
   * 与逐条调用 `addCardToZone` 的区别是**单次 set**：布局天然是一次性动作，
   * 逐条调用会让中途状态被 temporal 记录成一串撤销步骤，且堆叠区序号要在
   * 同一次计算里连续分配。这里先算好所有卡再一次性落盘。
   *
   * @param params.lp 生命值设定；`duelistName` 命中该阵营决斗者时只改那一位
   * @param params.cards 已解析出 CdbCard 的落位列表，顺序即堆叠区顺序
   * @param params.clearExisting 是否先清空盘面
   */
  applyBoardSetup: (params: {
    lp: Array<{ side: 0 | 1; lp: number; duelistName?: string }>
    cards: Array<{
      card: CdbCard
      controller: 0 | 1
      location: number
      sequence: number
      position: number
      duelistName?: string
      duelistId?: string
      customAtk?: number
      customDef?: number
    }>
    clearExisting: boolean
  }) => void
  /**
   * 移动场上或手牌中的卡片至目标区域与槽位
   *
   * **参数说明：**
   * - `instanceId`：要移动卡片的唯一实例 ID（UUID，非卡密 code）
   * - `toLocation`：目标区域（CardLocation，如 MZONE、SZONE、HAND、GRAVE 等）
   * - `toSequence`：目标格子序号（如怪兽/魔陷区 0~4；牌堆区域会自动追加到末尾）
   * - `toController`：可选，目标控制者（0: 我方, 1: 对方；缺省时保持原控制者）
   * - `customPos`：可选，自定义卡片表示形式（CardPosition；如按住 Ctrl 拖拽切换默认放置状态）
   * - `targetDuelistId`：可选，目标决斗者 ID（当移动至手牌区时关联）
   *
   * @param instanceId 要移动卡片的唯一实例 ID
   * @param toLocation 目标区域
   * @param toSequence 目标格子序号
   * @param toController 可选，目标控制者 (0: 我方, 1: 对方)
   * @param customPos 可选，自定义卡片表示形式
   * @param targetDuelistId 可选，目标决斗者 ID
   */
  moveCard: (
    instanceId: string,
    toLocation: number,
    toSequence: number,
    toController?: 0 | 1,
    customPos?: number,
    targetDuelistId?: string
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
    toIndex: number,
    duelistId?: string
  ) => void
  /** 在同一位决斗者的手牌中，将一张卡插入另一张卡的前方或后方 */
  reorderHandCards: (
    controller: 0 | 1,
    duelistId: string,
    movingInstanceId: string,
    targetInstanceId: string,
    insertAfter: boolean
  ) => void

  // 实战属性与指示物操作
  setCardCounter: (instanceId: string, counterType: number, count: number) => void
  removeCardCounter: (instanceId: string, counterType: number) => void
  clearCardCounters: (instanceId: string) => void
  setCardCustomStats: (instanceId: string, customAtk?: number, customDef?: number) => void

  toggleTacticalView: () => void
  setTacticalView: (enabled: boolean) => void

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
      expandedDuelistId: null,
      activeDuelistId: null,
      selectedCardId: null,
      activeStatPopoverCardId: null,
      statPopoverPosition: null,
      hoveredCard: null,
      hoveredInstanceId: null,
      tacticalView: false,
      activeLeftTab: 'card',
      isLeftOpen: true,
      leftWidth: 340,
      activeRightTab: 'search',
      currentStepIndex: null,
      isScreenplayOpen: false,
      selectedStepId: null,

      setExpandedDuelistId: (id) => set({ expandedDuelistId: id }),
      setActiveDuelistId: (id) => set({ activeDuelistId: id }),

      currentTurn: 1,
      currentPhase: 'M1',
      currentChain: 0,
      activeTurnPlayer: 0,
      isAutoRecording: true,

      setCurrentTurn: (turn) => set({ currentTurn: turn }),
      setCurrentPhase: (phase) => set({ currentPhase: phase }),
      setCurrentChain: (chain) => set({ currentChain: chain }),
      resetChain: () =>
        set((prev) => {
          if (prev.currentChain === 0) return prev
          let nextSteps = prev.state.steps || []
          if (prev.isAutoRecording) {
            nextSteps = [
              ...nextSteps,
              {
                id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                turn: prev.currentTurn,
                turnPlayer: prev.activeTurnPlayer,
                phase: prev.currentPhase,
                actionPlayer: prev.activeTurnPlayer,
                actionType: 'RESOLVE_CHAIN',
                description: `连锁结算 (Chain ${prev.currentChain} ~ Chain 1 依次处理)`,
                boardAfter: createLightweightSnapshot(prev.state.cards)
              }
            ]
          }
          return {
            currentChain: 0,
            state: { ...prev.state, steps: nextSteps }
          }
        }),
      nextPhase: () =>
        set((prev) => {
          const phases: DuelPhase[] = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP']
          const curIdx = phases.indexOf(prev.currentPhase)
          let nextSteps = prev.state.steps || []

          if (curIdx < phases.length - 1) {
            const targetPhase = phases[curIdx + 1]
            if (prev.isAutoRecording) {
              const phaseLabel =
                targetPhase === 'DP'
                  ? '抽卡阶段'
                  : targetPhase === 'SP'
                    ? '准备阶段'
                    : targetPhase === 'M1'
                      ? '主要阶段1'
                      : targetPhase === 'BP'
                        ? '战斗阶段'
                        : targetPhase === 'M2'
                          ? '主要阶段2'
                          : '结束阶段'
              nextSteps = [
                ...nextSteps,
                {
                  id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  turn: prev.currentTurn,
                  turnPlayer: prev.activeTurnPlayer,
                  phase: targetPhase,
                  actionPlayer: prev.activeTurnPlayer,
                  actionType: 'PHASE_CHANGE',
                  description: `进入${phaseLabel}`,
                  boardAfter: createLightweightSnapshot(prev.state.cards)
                }
              ]
            }
            return {
              currentPhase: targetPhase,
              currentChain: 0,
              state: { ...prev.state, steps: nextSteps }
            }
          } else {
            const nextTurn = prev.currentTurn + 1
            const nextActive = (prev.activeTurnPlayer === 0 ? 1 : 0) as 0 | 1
            const pName = nextActive === 0 ? '我方' : '对方'
            if (prev.isAutoRecording) {
              nextSteps = [
                ...nextSteps,
                {
                  id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  turn: nextTurn,
                  turnPlayer: nextActive,
                  phase: 'DP',
                  actionPlayer: nextActive,
                  actionType: 'TURN_CHANGE',
                  description: `回合结束，进入第 ${nextTurn} 回合 (${pName}回合)`,
                  boardAfter: createLightweightSnapshot(prev.state.cards)
                }
              ]
            }
            return {
              currentTurn: nextTurn,
              currentPhase: 'DP',
              currentChain: 0,
              activeTurnPlayer: nextActive,
              state: {
                ...prev.state,
                steps: nextSteps
              }
            }
          }
        }),
      nextTurn: () =>
        set((prev) => {
          const nextTurn = prev.currentTurn + 1
          const nextActive = (prev.activeTurnPlayer === 0 ? 1 : 0) as 0 | 1
          const pName = nextActive === 0 ? '我方' : '对方'
          let nextSteps = prev.state.steps || []
          if (prev.isAutoRecording) {
            nextSteps = [
              ...nextSteps,
              {
                id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                turn: nextTurn,
                turnPlayer: nextActive,
                phase: 'DP',
                actionPlayer: nextActive,
                actionType: 'TURN_CHANGE',
                description: `进入第 ${nextTurn} 回合 (${pName}回合)`,
                boardAfter: createLightweightSnapshot(prev.state.cards)
              }
            ]
          }
          return {
            currentTurn: nextTurn,
            currentPhase: 'DP',
            currentChain: 0,
            activeTurnPlayer: nextActive,
            state: {
              ...prev.state,
              steps: nextSteps
            }
          }
        }),
      setActiveTurnPlayer: (player) => set({ activeTurnPlayer: player }),
      setIsAutoRecording: (recording) => set({ isAutoRecording: recording }),

      // 真实回放与盘面还原
      previewStepBoard: (stepIndex) =>
        set((prev) => {
          if (stepIndex === null) {
            const snap = prev.state.initialBoardSnapshot
            if (!snap) return { currentStepIndex: null }
            const cardMap = new Map(prev.state.cards.map((c) => [c.instanceId, c]))
            const restoredCards: FieldCard[] = snap.map((s) => {
              const existing = cardMap.get(s.instanceId)
              return {
                instanceId: s.instanceId,
                code: s.code,
                card: existing?.card,
                controller: s.controller,
                owner: s.owner ?? s.controller,
                location: s.location,
                sequence: s.sequence,
                position: s.position,
                overlayMaterials: [...(s.overlayMaterials || [])],
                duelistId: s.duelistId,
                customAtk: s.customAtk,
                customDef: s.customDef
              }
            })
            return {
              currentStepIndex: null,
              state: { ...prev.state, cards: restoredCards }
            }
          }

          const steps = prev.state.steps || []
          const targetStep = steps[stepIndex]
          if (!targetStep || !targetStep.boardAfter) {
            return { currentStepIndex: stepIndex }
          }

          const cardMap = new Map(prev.state.cards.map((c) => [c.instanceId, c]))
          const restoredCards: FieldCard[] = targetStep.boardAfter.map((s) => {
            const existing = cardMap.get(s.instanceId)
            return {
              instanceId: s.instanceId,
              code: s.code,
              card: existing?.card,
              controller: s.controller,
              owner: s.owner ?? s.controller,
              location: s.location,
              sequence: s.sequence,
              position: s.position,
              overlayMaterials: [...(s.overlayMaterials || [])],
              duelistId: s.duelistId,
              customAtk: s.customAtk,
              customDef: s.customDef
            }
          })

          return {
            currentStepIndex: stepIndex,
            currentTurn: targetStep.turn,
            currentPhase: targetStep.phase,
            currentChain: targetStep.chainIndex ?? 0,
            activeTurnPlayer: targetStep.turnPlayer,
            state: { ...prev.state, cards: restoredCards }
          }
        }),

      recordAction: (params) =>
        set((prev) => {
          const newStep: DuelStep = {
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            turn: prev.currentTurn,
            turnPlayer: prev.activeTurnPlayer,
            phase: prev.currentPhase,
            actionPlayer: params.actionPlayer ?? prev.activeTurnPlayer,
            actionType: params.actionType,
            cardCode: params.card?.code,
            cardName: params.card?.name,
            fromLocation: params.fromLocation,
            fromSequence: params.fromSequence,
            toLocation: params.toLocation,
            toSequence: params.toSequence,
            chainIndex: params.chainIndex,
            description: params.description,
            boardAfter: createLightweightSnapshot(prev.state.cards)
          }
          const existing = prev.state.steps || []
          return {
            state: {
              ...prev.state,
              steps: [...existing, newStep],
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            }
          }
        }),

      // 决斗盘实战动作执行器 (统一走 moveCard / updateCardPosition，保证完整规整与牌堆序列)
      executeActivateCard: (instanceId) => {
        const { state, moveCard, updateCardPosition } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        if (card.location === CardLocation.HAND) {
          const occupiedSeqs = state.cards
            .filter((c) => c.controller === card.controller && c.location === CardLocation.SZONE)
            .map((c) => c.sequence)
          const freeSeq = [0, 1, 2, 3, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0
          moveCard(instanceId, CardLocation.SZONE, freeSeq, undefined, CardPosition.FACEUP)
        } else if (card.location === CardLocation.SZONE) {
          updateCardPosition(instanceId, CardPosition.FACEUP)
        } else {
          // 怪兽区/墓地发动怪兽效果
          const { currentTurn, currentPhase, currentChain, activeTurnPlayer } =
            useDuelStore.getState()
          const nextChain = currentChain + 1
          const pName = card.controller === 0 ? '我方' : '对方'
          const cName = card.card?.name || (card.code ? String(card.code) : '卡片')
          const newStep: DuelStep = {
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            turn: currentTurn,
            turnPlayer: activeTurnPlayer,
            phase: currentPhase,
            actionPlayer: card.controller,
            actionType: 'ACTIVATE',
            instanceId,
            cardCode: card.code,
            cardName: card.card?.name,
            fromLocation: card.location,
            fromSequence: card.sequence,
            chainIndex: nextChain,
            description: `${pName}发动【${cName}】效果 (Chain ${nextChain})`,
            boardAfter: createLightweightSnapshot(state.cards)
          }
          set((prev) => ({
            currentChain: nextChain,
            state: {
              ...prev.state,
              steps: [...(prev.state.steps || []), newStep],
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            }
          }))
        }
      },

      executeChainCard: (instanceId) => {
        // 直接调用 executeActivateCard 即可自动自增连锁，避免连锁跳跃至 C2
        useDuelStore.getState().executeActivateCard(instanceId)
      },

      executeAttackCard: (instanceId) => {
        const { state, currentTurn, currentPhase, activeTurnPlayer } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        const pName = card.controller === 0 ? '我方' : '对方'
        const cName = card.card?.name || (card.code ? String(card.code) : '怪兽')
        const newStep: DuelStep = {
          id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          turn: currentTurn,
          turnPlayer: activeTurnPlayer,
          phase: currentPhase,
          actionPlayer: card.controller,
          actionType: 'ATTACK',
          instanceId,
          cardCode: card.code,
          cardName: card.card?.name,
          fromLocation: CardLocation.MZONE,
          fromSequence: card.sequence,
          description: `${pName}【${cName}】发动攻击！`,
          boardAfter: createLightweightSnapshot(state.cards)
        }

        set((prev) => ({
          currentChain: 0,
          state: {
            ...prev.state,
            steps: [...(prev.state.steps || []), newStep],
            initialBoardSnapshot:
              prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
          }
        }))
      },

      executeNormalSummon: (instanceId) => {
        const { state, moveCard } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        const occupiedSeqs = state.cards
          .filter(
            (c) =>
              c.controller === card.controller &&
              c.location === CardLocation.MZONE &&
              c.sequence <= 4
          )
          .map((c) => c.sequence)
        const freeSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 2
        moveCard(instanceId, CardLocation.MZONE, freeSeq, undefined, CardPosition.FACEUP_ATTACK)
      },

      executeSpecialSummon: (instanceId) => {
        const { state, moveCard } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        const occupiedSeqs = state.cards
          .filter(
            (c) =>
              c.controller === card.controller &&
              c.location === CardLocation.MZONE &&
              c.sequence <= 4
          )
          .map((c) => c.sequence)
        const freeSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 2
        moveCard(instanceId, CardLocation.MZONE, freeSeq, undefined, CardPosition.FACEUP_ATTACK)
      },

      executeSetCard: (instanceId) => {
        const { state, moveCard } = useDuelStore.getState()
        const card = state.cards.find((c) => c.instanceId === instanceId)
        if (!card) return

        const isMonster = card.card
          ? (card.card.type & CardType.MONSTER) !== 0
          : card.location === CardLocation.MZONE
        const targetLocation = isMonster ? CardLocation.MZONE : CardLocation.SZONE
        const targetPosition = isMonster ? CardPosition.FACEDOWN_DEFENSE : CardPosition.FACEDOWN

        const occupiedSeqs = state.cards
          .filter(
            (c) =>
              c.controller === card.controller && c.location === targetLocation && c.sequence <= 4
          )
          .map((c) => c.sequence)
        const freeSeq = [2, 1, 3, 0, 4].find((s) => !occupiedSeqs.includes(s)) ?? 0

        moveCard(instanceId, targetLocation, freeSeq, undefined, targetPosition)
      },

      executeSendToGrave: (instanceId) => {
        useDuelStore.getState().moveCard(instanceId, CardLocation.GRAVE, 999)
      },

      executeBanishCard: (instanceId) => {
        useDuelStore.getState().moveCard(instanceId, CardLocation.REMOVED, 999)
      },

      executeDrawCard: (controller) => {
        const { state, moveCard, activeDuelistId } = useDuelStore.getState()
        // 多人时每位决斗者是独立牌堆：只从「当前查看的决斗者」的卡组顶抽，
        // 否则会对整个阵营的DECK 排序，可能抽走同阵营其他人的牌。
        const activeDuelist = (state.duelists || []).find(
          (d) => d.id === activeDuelistId && d.team === controller
        )
        const ownerScope = activeDuelist?.id ?? null
        // 卡组顶 = 卡组列表最左（sequence 最小）= 下一抽。必须显式按 sequence 排序：
        // 经过列表重排或移入移出后，cards 数组的物理顺序会与sequence 脱钩，
        // 直接取数组末位会抽错卡。
        const deckCards = state.cards
          .filter(
            (c) =>
              c.controller === controller &&
              c.location === CardLocation.DECK &&
              (ownerScope ? c.duelistId === ownerScope : true)
          )
          .sort((a, b) => a.sequence - b.sequence)
        if (deckCards.length === 0) return

        const topCard = deckCards[0]
        moveCard(
          topCard.instanceId,
          CardLocation.HAND,
          999,
          controller,
          CardPosition.FACEDOWN,
          ownerScope ?? undefined
        )
      },

      setActiveLeftTab: (tab) => set({ activeLeftTab: tab, isLeftOpen: true }),
      setLeftOpen: (open) => set({ isLeftOpen: open }),
      toggleLeftTab: (tab) =>
        set((prev) => ({
          activeLeftTab: tab,
          isLeftOpen: prev.activeLeftTab === tab ? !prev.isLeftOpen : true
        })),
      setLeftWidth: (width) => set({ leftWidth: Math.max(280, Math.min(width, 600)) }),

      /** 加载决斗档案并开始第一回合 */
      loadProjectAndStart: (newState) => {
        const normalized = normalizeDuelState(newState)
        set({
          state: normalized,
          currentTurn: 1,
          currentPhase: 'M1',
          currentChain: 0,
          activeTurnPlayer: normalized.turnPlayer ?? 0,
          selectedCardId: null,
          expandedDuelistId: null,
          hoveredCard: null
        })
        useDuelStore.temporal.getState().clear()
      },

      setActiveRightTab: (tab) => set({ activeRightTab: tab }),
      setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
      setIsScreenplayOpen: (open) => set({ isScreenplayOpen: open }),
      setSelectedStepId: (id) => set({ selectedStepId: id }),
      openScreenplayWithStep: (stepId) =>
        set((prev) => ({
          isScreenplayOpen: true,
          selectedStepId:
            stepId !== undefined ? stepId : prev.selectedStepId || prev.state.steps?.[0]?.id || null
        })),

      addStep: (stepData) =>
        set((prev) => {
          const newStep: DuelStep = {
            ...stepData,
            id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          }
          const existing = prev.state.steps || []
          return {
            state: {
              ...prev.state,
              steps: [...existing, newStep]
            }
          }
        }),

      updateStep: (stepId, patch) =>
        set((prev) => {
          const existing = prev.state.steps || []
          return {
            state: {
              ...prev.state,
              steps: existing.map((s) => (s.id === stepId ? { ...s, ...patch } : s))
            }
          }
        }),

      deleteStep: (stepId) =>
        set((prev) => {
          const existing = prev.state.steps || []
          return {
            state: {
              ...prev.state,
              steps: existing.filter((s) => s.id !== stepId)
            }
          }
        }),

      moveStep: (stepId, direction) =>
        set((prev) => {
          const existing = [...(prev.state.steps || [])]
          const idx = existing.findIndex((s) => s.id === stepId)
          if (idx === -1) return prev
          if (direction === 'up' && idx > 0) {
            const temp = existing[idx - 1]
            existing[idx - 1] = existing[idx]
            existing[idx] = temp
          } else if (direction === 'down' && idx < existing.length - 1) {
            const temp = existing[idx + 1]
            existing[idx + 1] = existing[idx]
            existing[idx] = temp
          }
          return {
            state: {
              ...prev.state,
              steps: existing
            }
          }
        }),

      clearSteps: () =>
        set((prev) => ({
          state: {
            ...prev.state,
            steps: []
          },
          currentStepIndex: null
        })),

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

      setDuelType: (duelType) =>
        set((prev) => ({
          state: { ...prev.state, duelType }
        })),

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
          const isShared = prev.state.matchConfig?.sharedLp
          let baseDuelists = prev.state.duelists
          if (!baseDuelists || baseDuelists.length === 0) {
            baseDuelists = createDefaultDuelists(
              prev.state.matchConfig?.team0Count ?? 1,
              prev.state.matchConfig?.team1Count ?? 1
            )
          }
          const duelists = baseDuelists.map((d) => {
            if (d.team === player) {
              if (isShared || baseDuelists!.filter((item) => item.team === player).length <= 1) {
                return { ...d, lp: updatedLp }
              }
            }
            return d
          })
          return {
            state: { ...prev.state, players, duelists }
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

      switchMatchConfig: (newConfig) =>
        set((prev) => {
          const currentConfig = prev.state.matchConfig || {
            mode: '1v1',
            team0Count: 1,
            team1Count: 1,
            sharedLp: false
          }
          const currentKey = getMatchScenarioKey(currentConfig)
          const targetKey = getMatchScenarioKey(newConfig)

          // 1. 将当前这整场决斗完整存档：场面、血量、决斗者、步骤、开局盘面一个都不能少，
          //    否则切回本场景时信息会丢失。players 与 initialBoardSnapshot 是后补的字段，
          //    旧快照可能没有，这里原样保留 undefined 由读取侧兜底。
          const currentSnapshot: DuelSceneSnapshot = {
            duelists:
              prev.state.duelists ||
              createDefaultDuelists(currentConfig.team0Count, currentConfig.team1Count),
            cards: prev.state.cards,
            turnPlayer: prev.state.turnPlayer,
            firstTurnAttack: prev.state.firstTurnAttack,
            steps: prev.state.steps,
            matchConfig: currentConfig,
            players: prev.state.players,
            initialBoardSnapshot: prev.state.initialBoardSnapshot
          }

          const updatedScenarios: Record<string, DuelSceneSnapshot> = {
            ...(prev.state.scenarios || {}),
            [currentKey]: currentSnapshot
          }

          // 切换场景后残留的运行时状态统一清零，避免带着上一场的回合/阶段/选中项进来
          const resetRuntime = {
            expandedDuelistId: null,
            activeDuelistId: null,
            selectedCardId: null,
            currentStepIndex: null,
            currentTurn: 1,
            currentPhase: 'M1' as const,
            currentChain: 0
          }

          // 2. 目标场景已有独立存档 → 整场还原（场面/血量/步骤/开局盘面）
          if (updatedScenarios[targetKey]) {
            const snap = updatedScenarios[targetKey]
            return {
              state: {
                ...prev.state,
                matchConfig: newConfig,
                duelists: snap.duelists,
                cards: snap.cards,
                // 旧存档可能没有 players / initialBoardSnapshot，回落到当前值而不是硬写8000
                players: snap.players ?? prev.state.players,
                initialBoardSnapshot: snap.initialBoardSnapshot ?? prev.state.initialBoardSnapshot,
                turnPlayer: snap.turnPlayer,
                firstTurnAttack: snap.firstTurnAttack,
                steps: snap.steps,
                scenarios: updatedScenarios
              },
              ...resetRuntime,
              activeTurnPlayer: snap.turnPlayer
            }
          }

          // 3. 首次进入该场景：这是一场全新的决斗，场面从零开始（不继承上一场的任何卡片）。
          //    旧场景的完整对局已存进上面的 currentSnapshot，切回来时会原样还原。
          const newDuelists = createDefaultDuelists(newConfig.team0Count, newConfig.team1Count)

          return {
            state: {
              ...prev.state,
              matchConfig: newConfig,
              duelists: newDuelists,
              cards: [],
              players: [
                { lp: 8000, maxHand: 0, startHand: 0 },
                { lp: 8000, maxHand: 0, startHand: 0 }
              ],
              steps: [],
              initialBoardSnapshot: undefined,
              turnPlayer: 0,
              firstTurnAttack: newConfig.mode === '1v1' ? prev.state.firstTurnAttack : true,
              scenarios: updatedScenarios
            },
            ...resetRuntime
          }
        }),

      updateDuelist: (duelistId, patch) =>
        set((prev) => {
          let baseDuelists = prev.state.duelists
          if (!baseDuelists || baseDuelists.length === 0) {
            baseDuelists = createDefaultDuelists(
              prev.state.matchConfig?.team0Count ?? 1,
              prev.state.matchConfig?.team1Count ?? 1
            )
            if (prev.state.players[0]) baseDuelists[0].lp = prev.state.players[0].lp
            if (prev.state.players[1]) baseDuelists[1].lp = prev.state.players[1].lp
          }

          let target = baseDuelists.find((d) => d.id === duelistId)
          if (!target) {
            if (duelistId.includes('_0_')) target = baseDuelists.find((d) => d.team === 0)
            else if (duelistId.includes('_1_')) target = baseDuelists.find((d) => d.team === 1)
          }

          const targetId = target ? target.id : duelistId
          const targetTeam: 0 | 1 = target ? target.team : duelistId.includes('_1_') ? 1 : 0
          const updatedLp = patch.lp !== undefined ? Math.max(0, patch.lp) : undefined

          const duelists = baseDuelists.map((d) => {
            if (d.id === targetId) {
              return { ...d, ...patch, ...(updatedLp !== undefined ? { lp: updatedLp } : {}) }
            }
            return d
          })

          let players = prev.state.players
          let nextSteps = prev.state.steps || []

          if (updatedLp !== undefined) {
            const oldLp = target ? target.lp : (players[targetTeam]?.lp ?? 8000)
            const diff = Math.abs(updatedLp - oldLp)
            if (prev.isAutoRecording && diff > 0) {
              const isDamage = updatedLp < oldLp
              const roleName = target?.name || (targetTeam === 0 ? '我方' : '对方')
              nextSteps = [
                ...nextSteps,
                {
                  id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  turn: prev.currentTurn,
                  turnPlayer: prev.activeTurnPlayer,
                  phase: prev.currentPhase,
                  actionPlayer: targetTeam,
                  actionType: isDamage ? 'DAMAGE' : 'RECOVER',
                  description: isDamage
                    ? `${roleName}受到 ${diff} 点伤害 (LP: ${oldLp} → ${updatedLp})`
                    : `${roleName}回复 ${diff} 点生命值 (LP: ${oldLp} → ${updatedLp})`,
                  lpChange: { player: targetTeam, oldLp, newLp: updatedLp },
                  boardAfter: createLightweightSnapshot(prev.state.cards)
                }
              ]
            }

            if (prev.state.matchConfig?.sharedLp) {
              duelists.forEach((d) => {
                if (d.team === targetTeam) {
                  d.lp = updatedLp
                }
              })
            }
            players = [
              targetTeam === 0 ? { ...players[0], lp: updatedLp } : players[0],
              targetTeam === 1 ? { ...players[1], lp: updatedLp } : players[1]
            ]
          }

          return {
            state: {
              ...prev.state,
              duelists,
              players,
              steps: nextSteps,
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            }
          }
        }),

      setDuelistTurnOrder: (duelistId, newOrder) =>
        set((prev) => {
          const rawDuelists = prev.state.duelists || []
          const target = rawDuelists.find((d) => d.id === duelistId)
          if (!target) return prev

          const currentTargetOrder = target.turnOrder ?? (target.isFirst ? 1 : 2)
          if (currentTargetOrder === newOrder) return prev

          const duelists = rawDuelists.map((d) => ({ ...d }))
          const targetInList = duelists.find((d) => d.id === duelistId)!
          const otherInList = duelists.find(
            (d) => d.id !== duelistId && (d.turnOrder ?? (d.isFirst ? 1 : 2)) === newOrder
          )

          targetInList.turnOrder = newOrder
          if (otherInList) {
            otherInList.turnOrder = currentTargetOrder
          }

          // 同步 isFirst 与 turnPlayer
          let turnPlayer = prev.state.turnPlayer
          duelists.forEach((d) => {
            const order = d.turnOrder ?? 2
            d.isFirst = order === 1
            if (d.isFirst) {
              turnPlayer = d.team
            }
          })

          return {
            state: {
              ...prev.state,
              duelists,
              turnPlayer
            }
          }
        }),

      setFirstDuelist: (duelistId) => {
        useDuelStore.getState().setDuelistTurnOrder(duelistId, 1)
      },

      toggleSharedLp: () =>
        set((prev) => {
          const currentConfig = prev.state.matchConfig || {
            mode: '1v1',
            team0Count: 1,
            team1Count: 1,
            sharedLp: false
          }
          const nextShared = !currentConfig.sharedLp
          const nextConfig: MatchConfig = { ...currentConfig, sharedLp: nextShared }

          let duelists = prev.state.duelists || []
          let players = prev.state.players
          if (nextShared) {
            const team0Lp = duelists.find((d) => d.team === 0)?.lp ?? prev.state.players[0].lp
            const team1Lp = duelists.find((d) => d.team === 1)?.lp ?? prev.state.players[1].lp
            duelists = duelists.map((d) => ({
              ...d,
              lp: d.team === 0 ? team0Lp : team1Lp
            }))
            players = [
              { ...players[0], lp: team0Lp },
              { ...players[1], lp: team1Lp }
            ]
          }

          return {
            state: {
              ...prev.state,
              matchConfig: nextConfig,
              duelists,
              players
            }
          }
        }),

      addCardToZone: (card, controller, location, sequence, customPos, duelistId) =>
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

          // 归属决斗者 ID：手牌与堆叠区（主卡组/额外/墓地/除外）都必须写。
          // 堆叠区若留空，这些牌在多人对局里会因`c.duelistId === ownerScope` 不成立
          // 而既不显示也清不掉。取值优先级：调用方指定 > 当前查看的决斗者 > 该阵营首位。
          const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === controller)
          const isOwnerScopedZone =
            location === CardLocation.HAND ||
            location === CardLocation.DECK ||
            location === CardLocation.EXTRA ||
            location === CardLocation.GRAVE ||
            location === CardLocation.REMOVED
          let assignedDuelistId = duelistId
          if (isOwnerScopedZone && !assignedDuelistId) {
            assignedDuelistId =
              teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ||
              teamDuelists[0]?.id ||
              (controller === 0 ? 'duelist_0_0' : 'duelist_1_0')
          }

          // 堆叠型区域按已有数量计算新序号；离散格子则替换/覆盖同位置旧卡
          const existingPile = prev.state.cards
            .filter((c) => {
              if (c.controller !== controller || c.location !== location) return false
              // 手牌与堆叠区都按归属过滤：多人时每位决斗者是独立牌堆，
              // 混算序号会让 A 的新卡插到 B 的堆里造成错位。
              if (isOwnerScopedZone && assignedDuelistId) {
                return c.duelistId === assignedDuelistId
              }
              return true
            })
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
            overlayMaterials: [],
            duelistId: isOwnerScopedZone ? assignedDuelistId : undefined
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

      applyBoardSetup: ({ lp, cards, clearExisting }) =>
        set((prev) => {
          const baseDuelists =
            prev.state.duelists && prev.state.duelists.length > 0
              ? prev.state.duelists
              : createDefaultDuelists(
                  prev.state.matchConfig?.team0Count ?? 1,
                  prev.state.matchConfig?.team1Count ?? 1
                )

          // 生命值：指定了决斗者名就只改那一位；共享 LP 或该阵营仅一位时全阵营同步
          const sharedLp = Boolean(prev.state.matchConfig?.sharedLp)
          const nextLpBySide = new Map<0 | 1, number>()
          lp.forEach((t) => {
            const v = Math.max(0, Math.trunc(t.lp))
            nextLpBySide.set(t.side, v)
          })
          const duelists = baseDuelists.map((d) => {
            if (!nextLpBySide.has(d.team)) return d
            const v = nextLpBySide.get(d.team)!
            const sameTeam = baseDuelists.filter((x) => x.team === d.team)
            return sharedLp || sameTeam.length <= 1 ? { ...d, lp: v } : d
          })
          // 逐个决斗者单独指定时覆盖上一轮按阵营算出的值
          lp.forEach((t) => {
            if (!t.duelistName) return
            const idx = duelists.findIndex((d) => d.name === t.duelistName)
            if (idx >= 0) {
              duelists[idx] = { ...duelists[idx], lp: Math.max(0, Math.trunc(t.lp)) }
            }
          })
          const players: [PlayerState, PlayerState] = [
            nextLpBySide.has(0)
              ? { ...prev.state.players[0], lp: nextLpBySide.get(0)! }
              : prev.state.players[0],
            nextLpBySide.has(1)
              ? { ...prev.state.players[1], lp: nextLpBySide.get(1)! }
              : prev.state.players[1]
          ]

          let workingCards = clearExisting ? [] : [...prev.state.cards]
          const created: FieldCard[] = []
          const unresolvedDuelists: string[] = []

          cards.forEach((c) => {
            const location = c.location
            const isPileZone =
              location === CardLocation.HAND ||
              location === CardLocation.GRAVE ||
              location === CardLocation.DECK ||
              location === CardLocation.EXTRA ||
              location === CardLocation.REMOVED
            const isOwnerScopedZone = isPileZone

            let duelistId = c.duelistId
            if (!duelistId && c.duelistName) {
              const hit = baseDuelists.find((d) => d.name === c.duelistName)
              if (hit) duelistId = hit.id
              else unresolvedDuelists.push(c.duelistName)
            }
            if (isOwnerScopedZone && !duelistId) {
              const teamDuelists = baseDuelists.filter((d) => d.team === c.controller)
              duelistId =
                teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ||
                teamDuelists[0]?.id ||
                (c.controller === 0 ? 'duelist_0_0' : 'duelist_1_0')
            }

            const newCard: FieldCard = {
              instanceId: `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              code: c.card.id,
              card: c.card,
              controller: c.controller,
              owner: c.controller,
              location,
              sequence: 0,
              position: c.position,
              overlayMaterials: [],
              duelistId: isOwnerScopedZone ? duelistId : undefined,
              customAtk: c.customAtk,
              customDef: c.customDef
            }

            if (isPileZone) {
              const pileSize = workingCards.filter(
                (x) =>
                  x.controller === c.controller &&
                  x.location === location &&
                  (!isOwnerScopedZone || x.duelistId === newCard.duelistId)
              ).length
              newCard.sequence = pileSize
              workingCards.push(newCard)
            } else {
              // 离散格子：同格旧卡被覆盖（与 addCardToZone 行为一致）
              workingCards = workingCards.filter(
                (x) =>
                  !(
                    x.controller === c.controller &&
                    x.location === location &&
                    x.sequence === c.sequence
                  )
              )
              newCard.sequence = c.sequence
              workingCards.push(newCard)
            }
            created.push(newCard)
          })

          if (unresolvedDuelists.length > 0) {
            console.warn(
              '[useDuelStore] applyBoardSetup 未找到决斗者，已回落到阵营首位:',
              unresolvedDuelists.join(', ')
            )
          }

          return {
            state: {
              ...prev.state,
              players,
              duelists,
              cards: workingCards,
              // 布局即新的开局基线：清空盘面时必须把初始快照也清掉，
              // 否则「上一步 / 下一步」复位会回到 AI 落位前的旧场面。
              initialBoardSnapshot: clearExisting
                ? createLightweightSnapshot(workingCards)
                : prev.state.initialBoardSnapshot
            },
            selectedCardId: created.length > 0 ? created[created.length - 1].instanceId : null,
            hoveredCard: created.length > 0 ? created[created.length - 1].card : null
          }
        }),

      /**
       * 移动场上或手牌中的卡片至新位置
       * @param instanceId 要移动卡片的唯一实例 ID
       * @param toLocation 目标区域 (CardLocation，如 MZONE/SZONE/HAND/GRAVE 等)
       * @param toSequence 目标格子序号 (如 0~4；牌堆区域会自动追加到末尾)
       * @param toController 可选，目标控制者 (0: 我方, 1: 对方；缺省时保持原控制者)
       * @param customPos 可选，自定义卡片表示形式 (CardPosition；如按住 Ctrl 拖拽切换默认放置状态)
       * @param targetDuelistId 可选，目标决斗者 ID
       */
      moveCard: (instanceId, toLocation, toSequence, toController, customPos, targetDuelistId) =>
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

          let assignedDuelistId = targetDuelistId
          if (isPileZone && !assignedDuelistId) {
            // 保留原属主（从 A 手牌拖到墓地仍是 A 的牌）；原卡无归属时
            // 回落到当前查看的决斗者 / 该阵营首位，保证堆叠区卡片都有明确归属。
            const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === ctrl)
            assignedDuelistId =
              targetCard.duelistId ||
              teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ||
              teamDuelists[0]?.id ||
              (ctrl === 0 ? 'duelist_0_0' : 'duelist_1_0')
          }

          let seq = toSequence
          let updatedCards = prev.state.cards

          if (isPileZone) {
            const targetPiles = prev.state.cards
              .filter((c) => {
                if (
                  c.controller !== ctrl ||
                  c.location !== toLocation ||
                  c.instanceId === instanceId
                ) {
                  return false
                }
                if (isPileZone && assignedDuelistId) {
                  return c.duelistId === assignedDuelistId
                }
                return true
              })
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
                position: newPos,
                duelistId: isPileZone ? assignedDuelistId : c.duelistId
              }
            }
            return c
          })

          let nextSteps = prev.state.steps || []
          let nextChain = prev.currentChain

          if (prev.isAutoRecording) {
            const inferred = inferMoveAction({
              fromLocation: targetCard.location,
              fromSequence: targetCard.sequence,
              toLocation,
              toSequence: seq,
              fromPosition: targetCard.position,
              finalPosition: newPos,
              actionPlayer: ctrl,
              cardCode: targetCard.code,
              cardName: targetCard.card?.name,
              cardType: targetCard.card?.type,
              currentPhase: prev.currentPhase,
              currentChain: prev.currentChain
            })

            if (inferred) {
              if (inferred.chainIndex) {
                nextChain = inferred.chainIndex
              }
              const newStep: DuelStep = {
                id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                turn: prev.currentTurn,
                turnPlayer: prev.activeTurnPlayer,
                phase: prev.currentPhase,
                actionPlayer: ctrl,
                actionType: inferred.actionType,
                instanceId,
                cardCode: targetCard.code,
                cardName: targetCard.card?.name,
                fromLocation: targetCard.location,
                fromSequence: targetCard.sequence,
                toLocation,
                toSequence: seq,
                chainIndex: inferred.chainIndex,
                description: inferred.description,
                boardAfter: createLightweightSnapshot(finalCards)
              }
              nextSteps = [...nextSteps, newStep]
            }
          }

          return {
            currentChain: nextChain,
            state: {
              ...prev.state,
              cards: finalCards,
              steps: nextSteps,
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
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
        set((prev) => {
          const targetCard = prev.state.cards.find((c) => c.instanceId === instanceId)
          if (!targetCard) return prev
          const oldPos = targetCard.position
          if (oldPos === position) return prev

          const updatedCards = prev.state.cards.map((c) =>
            c.instanceId === instanceId ? { ...c, position } : c
          )

          const nextSteps = [...(prev.state.steps || [])]
          let nextChain = prev.currentChain

          if (prev.isAutoRecording) {
            const lastStep = nextSteps[nextSteps.length - 1]
            const isJustDropped =
              lastStep &&
              lastStep.instanceId === instanceId &&
              (lastStep.actionType === 'SET_SPELL_TRAP' ||
                lastStep.actionType === 'ACTIVATE' ||
                lastStep.actionType === 'SET_MONSTER' ||
                lastStep.actionType === 'NORMAL_SUMMON' ||
                lastStep.actionType === 'SPECIAL_SUMMON')

            const pName = targetCard.controller === 0 ? '我方' : '对方'
            const cName =
              targetCard.card?.name || (targetCard.code ? String(targetCard.code) : '卡片')

            if (isJustDropped) {
              // 用户刚落子紧接着用浮条修改了表示形式（例如魔陷：盖放 ⇄ 发动；怪兽：表攻 ⇄ 盖守）
              if (
                targetCard.location === CardLocation.SZONE ||
                targetCard.location === CardLocation.FZONE
              ) {
                const isFacedown = Boolean(position & CardPosition.FACEDOWN)
                if (isFacedown) {
                  nextSteps[nextSteps.length - 1] = {
                    ...lastStep,
                    actionType: 'SET_SPELL_TRAP',
                    chainIndex: undefined,
                    description: `${pName}覆盖魔陷【${cName}】`,
                    boardAfter: createLightweightSnapshot(updatedCards)
                  }
                } else {
                  const chainIdx = prev.currentChain + 1
                  nextChain = chainIdx
                  nextSteps[nextSteps.length - 1] = {
                    ...lastStep,
                    actionType: 'ACTIVATE',
                    chainIndex: chainIdx,
                    description: `${pName}发动【${cName}】(Chain ${chainIdx})`,
                    boardAfter: createLightweightSnapshot(updatedCards)
                  }
                }
              } else if (targetCard.location === CardLocation.MZONE) {
                const isFacedown = Boolean(position & CardPosition.FACEDOWN)
                if (isFacedown) {
                  nextSteps[nextSteps.length - 1] = {
                    ...lastStep,
                    actionType: 'SET_MONSTER',
                    description: `${pName}里侧盖放怪兽【${cName}】`,
                    boardAfter: createLightweightSnapshot(updatedCards)
                  }
                } else {
                  nextSteps[nextSteps.length - 1] = {
                    ...lastStep,
                    actionType: 'NORMAL_SUMMON',
                    description: `${pName}通常召唤【${cName}】`,
                    boardAfter: createLightweightSnapshot(updatedCards)
                  }
                }
              }
            } else {
              // 场上已有卡片的表示形式变更（翻开发动、反转召唤、守备/攻击切换）
              const inferred = inferPositionChangeAction({
                location: targetCard.location,
                oldPosition: oldPos,
                newPosition: position,
                actionPlayer: targetCard.controller,
                cardCode: targetCard.code,
                cardName: targetCard.card?.name,
                currentChain: prev.currentChain
              })

              if (inferred) {
                if (inferred.chainIndex) {
                  nextChain = inferred.chainIndex
                }
                const newStep: DuelStep = {
                  id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  turn: prev.currentTurn,
                  turnPlayer: prev.activeTurnPlayer,
                  phase: prev.currentPhase,
                  actionPlayer: targetCard.controller,
                  actionType: inferred.actionType,
                  instanceId,
                  cardCode: targetCard.code,
                  cardName: targetCard.card?.name,
                  fromLocation: targetCard.location,
                  fromSequence: targetCard.sequence,
                  toLocation: targetCard.location,
                  toSequence: targetCard.sequence,
                  chainIndex: inferred.chainIndex,
                  description: inferred.description,
                  boardAfter: createLightweightSnapshot(updatedCards)
                }
                nextSteps.push(newStep)
              }
            }
          }

          return {
            currentChain: nextChain,
            state: {
              ...prev.state,
              cards: updatedCards,
              steps: nextSteps,
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
            }
          }
        }),

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

          const finalCards = updatedCards.map((c) => {
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

          let nextSteps = prev.state.steps || []
          if (prev.isAutoRecording) {
            const hostCard = prev.state.cards.find((c) => c.instanceId === targetInstanceId)
            const pName = hostCard?.controller === 0 ? '我方' : '对方'
            nextSteps = [
              ...nextSteps,
              {
                id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                turn: prev.currentTurn,
                turnPlayer: prev.activeTurnPlayer,
                phase: prev.currentPhase,
                actionPlayer: hostCard?.controller ?? 0,
                actionType: 'XYZ_SUMMON',
                instanceId: targetInstanceId,
                cardCode: newCardData.id,
                cardName: newCardData.name,
                toLocation: CardLocation.MZONE,
                toSequence: hostCard?.sequence ?? 0,
                description: `${pName}以叠放怪兽为素材超量召唤【${newCardData.name}】！`,
                boardAfter: createLightweightSnapshot(finalCards)
              }
            ]
          }

          return {
            state: {
              // 保留生命值、规则版本等其他局面信息不变
              ...prev.state,
              cards: finalCards,
              steps: nextSteps,
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
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

          const finalResultCards = [
            // 更新宿主怪兽的素材列表
            ...prev.state.cards.map((c) =>
              c.instanceId === targetInstanceId ? { ...c, overlayMaterials: newMats } : c
            ),
            // 将拔除出的卡片加入到目标区域
            newCard
          ]

          let nextSteps = prev.state.steps || []
          if (prev.isAutoRecording) {
            const pName = host.controller === 0 ? '我方' : '对方'
            const hostName = host.card?.name || (host.code ? String(host.code) : '超量怪兽')
            nextSteps = [
              ...nextSteps,
              {
                id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                turn: prev.currentTurn,
                turnPlayer: prev.activeTurnPlayer,
                phase: prev.currentPhase,
                actionPlayer: host.controller,
                actionType: 'DETACH_MATERIAL',
                instanceId: targetInstanceId,
                cardCode: matCode,
                toLocation: targetLocation,
                toSequence: targetSeq,
                description: `${pName}取除【${hostName}】的超量素材`,
                boardAfter: createLightweightSnapshot(finalResultCards)
              }
            ]
          }

          return {
            state: {
              ...prev.state,
              cards: finalResultCards,
              steps: nextSteps,
              initialBoardSnapshot:
                prev.state.initialBoardSnapshot || createLightweightSnapshot(prev.state.cards)
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

      reorderPileCards: (controller, location, fromIndex, toIndex, duelistId) =>
        set((prev) => {
          const pile = prev.state.cards
            .filter(
              (card) =>
                card.controller === controller &&
                card.location === location &&
                (!duelistId || card.duelistId === duelistId)
            )
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

      reorderHandCards: (controller, duelistId, movingInstanceId, targetInstanceId, insertAfter) =>
        set((prev) => {
          if (movingInstanceId === targetInstanceId) return prev

          const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === controller)
          const fallbackDuelistId = teamDuelists[0]?.id ?? `duelist_${controller}_0`
          const belongsToDuelist = (card: FieldCard): boolean =>
            card.duelistId === duelistId || (!card.duelistId && fallbackDuelistId === duelistId)
          const hand = prev.state.cards
            .filter(
              (card) =>
                card.controller === controller &&
                card.location === CardLocation.HAND &&
                belongsToDuelist(card)
            )
            .sort((a, b) => a.sequence - b.sequence)
          const fromIndex = hand.findIndex((card) => card.instanceId === movingInstanceId)
          const targetIndex = hand.findIndex((card) => card.instanceId === targetInstanceId)
          if (fromIndex < 0 || targetIndex < 0) return prev

          const reordered = [...hand]
          const [movingCard] = reordered.splice(fromIndex, 1)
          const adjustedTargetIndex = reordered.findIndex(
            (card) => card.instanceId === targetInstanceId
          )
          const insertIndex = adjustedTargetIndex + (insertAfter ? 1 : 0)
          reordered.splice(insertIndex, 0, movingCard)

          const sequenceById = new Map<string, number>()
          reordered.forEach((card, index) => sequenceById.set(card.instanceId, index))
          return {
            state: {
              ...prev.state,
              cards: prev.state.cards.map((card) => {
                const sequence = sequenceById.get(card.instanceId)
                return sequence === undefined ? card : { ...card, sequence }
              })
            }
          }
        }),

      loadState: (newState) =>
        set(() => ({
          state: normalizeDuelState(newState),
          selectedCardId: null,
          expandedDuelistId: null
        })),

      resetDuel: () =>
        set((prev) => {
          const baseState = createInitialDuelState(
            prev.state.masterRule,
            prev.state.duelType || 'full'
          )
          if (prev.state.matchConfig) {
            baseState.matchConfig = prev.state.matchConfig
            baseState.duelists = createDefaultDuelists(
              prev.state.matchConfig.team0Count,
              prev.state.matchConfig.team1Count
            )
          }
          return {
            state: baseState,
            selectedCardId: null,
            activeStatPopoverCardId: null,
            statPopoverPosition: null,
            hoveredCard: null,
            expandedDuelistId: null
          }
        }),

      swapSides: () =>
        set((prev) => {
          const duelists = (prev.state.duelists || []).map((d) => ({
            ...d,
            team: (d.team === 0 ? 1 : 0) as 0 | 1
          }))
          return {
            state: {
              ...prev.state,
              cards: prev.state.cards.map((c) => ({
                ...c,
                controller: (c.controller === 0 ? 1 : 0) as 0 | 1
              })),
              duelists,
              players: [prev.state.players[1], prev.state.players[0]],
              turnPlayer: (prev.state.turnPlayer === 0 ? 1 : 0) as 0 | 1
            },
            selectedCardId: null,
            expandedDuelistId: null
          }
        }),

      // 实战属性与指示物操作
      setCardCounter: (instanceId, counterType, count) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === instanceId) {
                const newCounters = { ...(c.counters || {}) }
                if (count <= 0) {
                  delete newCounters[counterType]
                } else {
                  newCounters[counterType] = count
                }
                return { ...c, counters: newCounters }
              }
              return c
            })
          }
        })),

      removeCardCounter: (instanceId, counterType) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === instanceId && c.counters) {
                const newCounters = { ...c.counters }
                delete newCounters[counterType]
                return { ...c, counters: newCounters }
              }
              return c
            })
          }
        })),

      clearCardCounters: (instanceId) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === instanceId) {
                return { ...c, counters: {} }
              }
              return c
            })
          }
        })),

      setCardCustomStats: (instanceId, customAtk, customDef) =>
        set((prev) => ({
          state: {
            ...prev.state,
            cards: prev.state.cards.map((c) => {
              if (c.instanceId === instanceId) {
                return { ...c, customAtk, customDef }
              }
              return c
            })
          }
        })),

      applyDeckToPlayer: (player, deck, drawCount = 0, duelistId) =>
        set((prev) => {
          // 多人对局时每位决斗者拥有独立卡组：只清掉该决斗者自己的主卡组 / 额外卡组，
          // 同阵营其他人的卡组必须原样保留。未传 duelistId（1v1、跨窗口广播）时清整个阵营。
          const teamDuelists = (prev.state.duelists || []).filter((d) => d.team === player)
          const multi = teamDuelists.length > 1
          // 未指定时回落到「当前查看的决斗者」，再回落到该阵营首位——与 addCardToZone 同口径
          const ownerScope =
            duelistId && teamDuelists.some((d) => d.id === duelistId)
              ? duelistId
              : multi
                ? (teamDuelists.find((d) => d.id === prev.activeDuelistId)?.id ??
                  teamDuelists[0]?.id)
                : null
          const otherCards = prev.state.cards.filter(
            (c) =>
              !(
                c.controller === player &&
                (c.location === CardLocation.DECK || c.location === CardLocation.EXTRA) &&
                (ownerScope ? c.duelistId === ownerScope : true)
              )
          )

          const newCards: FieldCard[] = []
          const totalMain = deck.main.length
          const actualDraw = Math.min(drawCount, totalMain)

          // 1. 如果指定了抽卡数，主卡组顶部卡片进入手牌
          for (let i = 0; i < actualDraw; i++) {
            const code = deck.main[i]
            newCards.push({
              instanceId: `inst_${Date.now()}_h_${i}_${Math.random().toString(36).slice(2, 6)}`,
              code,
              controller: player,
              owner: player,
              location: CardLocation.HAND,
              sequence: i,
              // 这就是普通的起手抽卡，与 executeDrawCard 保持一致用里侧：
              // 手牌里侧 = 未公开。若用 FACEUP_ATTACK，CardItem 的 isPublicHand 会成立，
              // 5 张起手会被打上「公开」角标。
              position: CardPosition.FACEDOWN,
              overlayMaterials: [],
              duelistId: ownerScope ?? undefined
            })
          }

          // 2. 其余主卡组卡片进 DECK
          for (let i = actualDraw; i < totalMain; i++) {
            const code = deck.main[i]
            newCards.push({
              instanceId: `inst_${Date.now()}_d_${i}_${Math.random().toString(36).slice(2, 6)}`,
              code,
              controller: player,
              owner: player,
              location: CardLocation.DECK,
              sequence: i - actualDraw,
              // 主卡组一律里侧备着。不能用 FACEDOWN_ATTACK(0x2)——它是「暗黑同调」那类
              // 特殊表里侧，不在 CardItem 的 isFacedown 判定内，会被当成表侧渲染出卡面。
              position: CardPosition.FACEDOWN,
              overlayMaterials: [],
              duelistId: ownerScope ?? undefined
            })
          }

          // 3. 额外卡组卡片进 EXTRA
          for (let i = 0; i < deck.extra.length; i++) {
            const code = deck.extra[i]
            newCards.push({
              instanceId: `inst_${Date.now()}_e_${i}_${Math.random().toString(36).slice(2, 6)}`,
              code,
              controller: player,
              owner: player,
              location: CardLocation.EXTRA,
              sequence: i,
              position: CardPosition.FACEDOWN,
              overlayMaterials: [],
              duelistId: ownerScope ?? undefined
            })
          }

          return {
            state: {
              ...prev.state,
              cards: [...otherCards, ...newCards]
            }
          }
        }),

      toggleTacticalView: () => set((prev) => ({ tacticalView: !prev.tacticalView })),
      setTacticalView: (enabled) => set({ tacticalView: enabled }),

      setSelectedCardId: (id) => set({ selectedCardId: id }),
      setActiveStatPopoverCardId: (id) => set({ activeStatPopoverCardId: id }),
      setStatPopoverPosition: (pos) => set({ statPopoverPosition: pos }),
      openStatPopover: (id, initialPos) =>
        set((prev) => ({
          activeStatPopoverCardId: id,
          statPopoverPosition: initialPos !== undefined ? initialPos : prev.statPopoverPosition
        })),
      closeStatPopover: () => set({ activeStatPopoverCardId: null }),
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

// 跨窗口卡组应用广播监听
if (typeof window !== 'undefined' && window.api?.onApplyDeckToDuel) {
  window.api.onApplyDeckToDuel(({ player, deck, drawCount }) => {
    useDuelStore.getState().applyDeckToPlayer(player, deck, drawCount)
  })
}
