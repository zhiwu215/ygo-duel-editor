import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { CardLocation, MASTER_RULES, FieldCard } from '@shared/index'
import { ZoneSlot } from './ZoneSlot'
import { HandTray } from './components/HandTray'
import { CardContextMenu } from './CardContextMenu'
import { PileListModal } from './PileListModal'
import { OverlayListModal } from './OverlayListModal'
import { DeckSwitcherModal } from './DeckSwitcherModal'
import { CardStatPopover } from './components/CardStatPopover'
import { ActionIntentBar } from './ActionIntentBar'

export const DuelBoard: React.FC = () => {
  const { state, activeDuelistId } = useDuelStore()
  const ruleInfo = MASTER_RULES[state.masterRule]

  // 多人对局时「当前查看的决斗者」：棋盘上的主卡组 / 额外卡组等堆叠区跟着TA 切换，
  // 单人（1v1）时为 null，行为与原先完全一致。
  const activeDuelist = state.duelists?.find((d) => d.id === activeDuelistId) || null

  // —— 决斗盘自适应缩放 ——
  // 决斗盘内部是固定像素网格（怪兽/魔陷格 92px、侧翼堆叠区 64px），其自然宽度（MR1/2/4/5 约
  // 690px、MR3 约 900px）可能超出容器，导致内部固定宽度的行溢出网格框、与上下手牌托盘宽度
  // 不一致而错位。这里把「上下手牌托盘 + 对战台网格」作为一个整体做等比缩放：
  //   · 空间充足 → 按 contain 规则放大以填满可用空间；
  //   · 空间不足 → 保持原始尺寸（scale 下限 1）不缩小，由容器滚动条承担溢出。
  // 任何情况下托盘与网格宽度都严格相等，错位问题不复存在。
  // 缩放用 CSS `zoom` 而非 `transform: scale()`：zoom 会真实改变布局尺寸，父容器看到的即
  // 缩放后的大小，因此不会残留「布局仍按原尺寸占位」造成的多余留白。
  const viewportRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [naturalW, setNaturalW] = useState(0)
  const metricsRef = useRef({ scale: 1, w: 0, h: 0 })
  const appliedScaleRef = useRef(1)
  const signalRef = useRef({ w: 0, h: 0 })

  useLayoutEffect(() => {
    appliedScaleRef.current = scale
  }, [scale])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const wrapper = wrapperRef.current
    const board = boardRef.current
    if (!viewport || !wrapper || !board) return

    let frame = 0

    const measure = (): void => {
      const zoom = appliedScaleRef.current || 1

      const boardW = board.getBoundingClientRect().width / zoom
      if (boardW <= 0) return

      const wrapperH = wrapper.getBoundingClientRect().height / zoom

      const widthChanged = Math.abs(boardW - metricsRef.current.w) > 0.5
      const heightChanged = Math.abs(wrapperH - metricsRef.current.h) > 0.5
      if (widthChanged) {
        metricsRef.current.w = boardW
        setNaturalW(boardW)
      }
      if (heightChanged) {
        metricsRef.current.h = wrapperH
      }

      const style = window.getComputedStyle(viewport)
      const availW =
        viewport.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0)
      const availH =
        viewport.clientHeight -
        (parseFloat(style.paddingTop) || 0) -
        (parseFloat(style.paddingBottom) || 0)

      const signalChanged =
        Math.abs(availW - signalRef.current.w) > 1 || Math.abs(availH - signalRef.current.h) > 1
      if (!signalChanged && !widthChanged && !heightChanged) return
      signalRef.current = { w: availW, h: availH }

      const ratioW = availW > 1 ? (availW - 1) / boardW : 1
      const ratioH = availH > 1 && wrapperH > 0 ? (availH - 1) / wrapperH : 1
      const next = Math.max(1, Math.min(ratioW, ratioH))

      if (Math.abs(next - metricsRef.current.scale) > 0.001) {
        metricsRef.current.scale = next
        setScale(next)
      }
    }

    // 用 rAF 延后测量，避免 ResizeObserver 回调内同步改尺寸触发循环告警
    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    measure()
    const observer = new ResizeObserver(schedule)
    observer.observe(viewport)
    observer.observe(wrapper)
    observer.observe(board)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  // 全局快捷键：Del / Delete 键直接删除当前鼠标指向或选中的卡片
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Delete' && e.key !== 'Del') return

      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isInput) return

      const duelStore = useDuelStore.getState()
      const targetId = duelStore.hoveredInstanceId || duelStore.selectedCardId
      if (targetId) {
        e.preventDefault()
        duelStore.removeCard(targetId)
        useContextMenuStore.getState().closeMenu()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 辅助查找对应格子的卡片
  const getCard = (
    controller: 0 | 1,
    location: number,
    sequence: number
  ): FieldCard | undefined => {
    // 堆叠型区域 (主卡组、额外、墓地、除外区)：取最顶层的一张卡进行展示
    if (
      location === CardLocation.DECK ||
      location === CardLocation.GRAVE ||
      location === CardLocation.EXTRA ||
      location === CardLocation.REMOVED
    ) {
      // 仅当「当前查看的决斗者」属于本阵营时才按 duelistId 收窄；
      // 查看对方玩家时，我方/另一侧的堆叠区保持阵营全量，不会被一起过滤掉。
      const ownerScope =
        activeDuelist && activeDuelist.team === controller ? activeDuelist.id : null
      const pile = state.cards.filter(
        (c) =>
          c.controller === controller &&
          c.location === location &&
          (ownerScope ? c.duelistId === ownerScope : true)
      )
      // 主卡组：sequence 最小 = 卡组顶 = 下一抽，与卡组面板列表最左一张保持一致；
      // 墓地/额外/除外：后加入的压在更上层，数组末位即最新一张。
      if (location === CardLocation.DECK) {
        return pile.reduce<FieldCard | undefined>(
          (top, c) => (top === undefined || c.sequence < top.sequence ? c : top),
          undefined
        )
      }
      return pile[pile.length - 1]
    }
    return state.cards.find(
      (c) => c.controller === controller && c.location === location && c.sequence === sequence
    )
  }

  // 辅助统计指定区域的卡片总数 (如卡组、额外、墓地、除外区堆叠计数)
  const getCardCount = (controller: 0 | 1, location: number): number => {
    // 与 getCard 同一口径：只看当前查看决斗者所属阵营的堆叠区
    const ownerScope = activeDuelist && activeDuelist.team === controller ? activeDuelist.id : null
    return state.cards.filter(
      (c) =>
        c.controller === controller &&
        c.location === location &&
        (ownerScope ? c.duelistId === ownerScope : true)
    ).length
  }

  return (
    <div className="flex-1 h-full relative select-none min-h-0 overflow-hidden flex flex-col">
      {/* CSS 六边形网格背景（替代位图纹理，深浅双主题自适应，固定置底不随内容滚动断层） */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,#eef1f7_0%,#e2e7f0_100%)] dark:bg-[linear-gradient(180deg,#0a1128_0%,#060b1a_100%)]" />
      <div
        className="absolute inset-0 pointer-events-none opacity-60 dark:hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='%233a5a8c' fill-opacity='0.05' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v11.2l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/svg%3E")`
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-50 hidden dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='%235b7bd0' fill-opacity='0.06' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v11.2l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/svg%3E")`
        }}
      />

      {/* 核心滚动与排布容器：整体战场形成紧凑舒适、垂直居中的一体化决斗盘台面 */}
      <div
        ref={viewportRef}
        className="w-full flex-1 overflow-auto p-2 sm:p-3 flex flex-col items-center relative z-10 min-h-0"
        style={{ scrollbarGutter: 'stable' }}
      >
        {/* 决斗盘整体（上下手牌托盘 + 对战台网格）作为同一缩放单元，宽度严格对齐。
            m-auto 而非仅 my-auto：宽度不足时 auto 边距归零使内容贴起始边，横向滚动条才能
            完整覆盖整个台面（否则 items-center 会造成左右对称溢出、左侧永远滚不到）。 */}
        <div
          ref={wrapperRef}
          className="flex flex-col items-center gap-2.5 m-auto shrink-0"
          style={{
            width: naturalW > 0 ? naturalW : undefined,
            zoom: String(scale)
          }}
        >
          {/* 顶部：对方手牌托盘 */}
          <HandTray controller={1} />

          {/* 核心对战台网格 (标准 YGOPro 5 行对称矩阵布局) */}
          <div
            ref={boardRef}
            className="relative z-10 w-max py-2 px-3 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col items-center justify-center gap-1 shrink-0"
          >
            {/* ============================================================== */}
            {/* 对方对战区域 (Opponent Sector) */}
            {/* 包含 MR3 左右独立灵摆区（垂直居中）、左翼卡组/墓地、中央对战区 5x2、右翼额外/场地 */}
            {/* ============================================================== */}
            <div className="flex items-center">
              {/* MR3 对方外侧独立灵摆区 (对方面向的右侧 sequence 1，对方右刻度=红) */}
              {ruleInfo.hasIndependentPZones && (
                <div className="mr-3 flex items-center justify-center shrink-0">
                  <ZoneSlot
                    label="灵摆区"
                    controller={1}
                    location={CardLocation.PZONE}
                    sequence={1}
                    card={getCard(1, CardLocation.PZONE, 1)}
                    isPendulum
                    pendulumDirection="left"
                    colorVariant="pendulum-red"
                  />
                </div>
              )}

              {/* 对方内场 2 行 (后场 + 前场) */}
              <div className="flex flex-col gap-1.5">
                {/* Row 1: 对方后场行 (主卡组 - 魔陷5..1 - 额外卡组) */}
                <div className="flex items-center gap-0">
                  {/* 对方主卡组 */}
                  <div className="w-[92px] flex justify-center shrink-0">
                    <ZoneSlot
                      label="主卡组"
                      controller={1}
                      location={CardLocation.DECK}
                      sequence={0}
                      card={getCard(1, CardLocation.DECK, 0)}
                      count={getCardCount(1, CardLocation.DECK)}
                      colorVariant="deck"
                    />
                  </div>

                  <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-0.5">
                    {[4, 3, 2, 1, 0].map((seq) => (
                      <ZoneSlot
                        key={`opp_szone_${seq}`}
                        label={`魔陷 ${seq + 1}`}
                        controller={1}
                        location={CardLocation.SZONE}
                        sequence={seq}
                        card={getCard(1, CardLocation.SZONE, seq)}
                        isPendulum={ruleInfo.pendulumInSZone && (seq === 0 || seq === 4)}
                        pendulumDirection={seq === 4 ? 'left' : seq === 0 ? 'right' : undefined}
                        // 对方场地位镜像：屏幕左 seq4 = 对方右侧刻度(红)，屏幕右 seq0 = 左侧刻度(蓝)
                        colorVariant={
                          ruleInfo.pendulumInSZone && seq === 4
                            ? 'pendulum-red'
                            : ruleInfo.pendulumInSZone && seq === 0
                              ? 'pendulum-blue'
                              : 'spell'
                        }
                      />
                    ))}
                  </div>

                  {/* 对方额外卡组 */}
                  <div className="w-[92px] flex justify-center shrink-0">
                    <ZoneSlot
                      label="额外卡组"
                      controller={1}
                      location={CardLocation.EXTRA}
                      sequence={0}
                      card={getCard(1, CardLocation.EXTRA, 0)}
                      count={getCardCount(1, CardLocation.EXTRA)}
                      colorVariant="extra"
                    />
                  </div>
                </div>

                {/* Row 2: 对方前场行 (墓地 - 怪兽5..1 - 场地魔法) */}
                <div className="flex items-center gap-0">
                  {/* 对方墓地 */}
                  <div className="w-[92px] flex justify-center shrink-0">
                    <ZoneSlot
                      label="墓地"
                      controller={1}
                      location={CardLocation.GRAVE}
                      sequence={0}
                      card={getCard(1, CardLocation.GRAVE, 0)}
                      count={getCardCount(1, CardLocation.GRAVE)}
                      colorVariant="grave"
                    />
                  </div>

                  <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-0.5">
                    {[4, 3, 2, 1, 0].map((seq) => (
                      <ZoneSlot
                        key={`opp_mzone_${seq}`}
                        label={`怪兽 ${seq + 1}`}
                        controller={1}
                        location={CardLocation.MZONE}
                        sequence={seq}
                        card={getCard(1, CardLocation.MZONE, seq)}
                        colorVariant="monster"
                      />
                    ))}
                  </div>

                  {/* 对方场地魔法 */}
                  <div className="w-[92px] flex justify-center shrink-0">
                    <ZoneSlot
                      label="场地魔法"
                      controller={1}
                      location={CardLocation.SZONE}
                      sequence={5}
                      card={getCard(1, CardLocation.SZONE, 5)}
                      colorVariant="field"
                    />
                  </div>
                </div>
              </div>

              {/* MR3 对方外侧独立灵摆区 (对方面向的左侧 sequence 0，对方左刻度=蓝) */}
              {ruleInfo.hasIndependentPZones && (
                <div className="ml-3 flex items-center justify-center shrink-0">
                  <ZoneSlot
                    label="灵摆区"
                    controller={1}
                    location={CardLocation.PZONE}
                    sequence={0}
                    card={getCard(1, CardLocation.PZONE, 0)}
                    isPendulum
                    pendulumDirection="right"
                    colorVariant="pendulum-blue"
                  />
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* Row 3: 中线分界行 (除外区 + 额外怪兽区 EMZ / 纯净细线分界) */}
            {/* ============================================================== */}
            <div className="flex items-center gap-0 my-0.5">
              {/* MR3 占位对齐（保持与外侧灵摆区等宽） */}
              {ruleInfo.hasIndependentPZones && <div className="w-[92px] h-[92px] mr-3 shrink-0" />}

              {/* 对方除外区 (对齐对方墓地正下方，紧挨中线) */}
              <div className="mr-3 shrink-0">
                <ZoneSlot
                  label="除外区"
                  controller={1}
                  location={CardLocation.REMOVED}
                  sequence={0}
                  card={getCard(1, CardLocation.REMOVED, 0)}
                  count={getCardCount(1, CardLocation.REMOVED)}
                  colorVariant="removed"
                />
              </div>

              {/* 中央对战台交界：MR4/5 规范桥接两个 EMZ；MR1/2/3 留出纯净极简中线 */}
              {ruleInfo.hasEMZ ? (
                <div className="flex items-center gap-2 px-2.5 my-0.5">
                  <div className="w-[92px] h-[92px] invisible shrink-0" />
                  <ZoneSlot
                    label="EX 怪兽 1"
                    controller={0}
                    location={CardLocation.MZONE}
                    sequence={5}
                    card={getCard(0, CardLocation.MZONE, 5) || getCard(1, CardLocation.MZONE, 5)}
                    colorVariant="emz"
                  />
                  <div className="w-[92px] h-[92px] invisible shrink-0" />
                  <ZoneSlot
                    label="EX 怪兽 2"
                    controller={0}
                    location={CardLocation.MZONE}
                    sequence={6}
                    card={getCard(0, CardLocation.MZONE, 6) || getCard(1, CardLocation.MZONE, 6)}
                    colorVariant="emz"
                  />
                  <div className="w-[92px] h-[92px] invisible shrink-0" />
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2.5 my-0.5 w-[512px] h-[92px] justify-center shrink-0">
                  <div className="w-full h-px bg-border dark:bg-white/15" />
                </div>
              )}

              {/* 我方除外区 (对齐我方墓地正上方，紧挨中线) */}
              <div className="ml-3 shrink-0">
                <ZoneSlot
                  label="除外区"
                  controller={0}
                  location={CardLocation.REMOVED}
                  sequence={0}
                  card={getCard(0, CardLocation.REMOVED, 0)}
                  count={getCardCount(0, CardLocation.REMOVED)}
                  colorVariant="removed"
                />
              </div>

              {/* MR3 占位对齐（保持与外侧灵摆区等宽等高：均为 92px 方格） */}
              {ruleInfo.hasIndependentPZones && <div className="w-[92px] h-[92px] ml-3 shrink-0" />}
            </div>

            {/* ============================================================== */}
            {/* 我方对战区域 (Player Sector) */}
            {/* 包含 MR3 左右独立灵摆区（垂直居中）、左翼场地/额外、中央对战区 5x2、右翼墓地/卡组 */}
            {/* ============================================================== */}
            <div className="flex items-center">
              {/* MR3 我方外侧独立灵摆区 (我方面向的左侧 sequence 0，我方左刻度=蓝) */}
              {ruleInfo.hasIndependentPZones && (
                <div className="mr-3 flex items-center justify-center shrink-0">
                  <ZoneSlot
                    label="灵摆区"
                    controller={0}
                    location={CardLocation.PZONE}
                    sequence={0}
                    card={getCard(0, CardLocation.PZONE, 0)}
                    isPendulum
                    pendulumDirection="left"
                    colorVariant="pendulum-blue"
                  />
                </div>
              )}

              {/* 我方内场 2 行 (前场 + 后场) */}
              <div className="flex flex-col gap-1.5">
                {/* Row 4: 我方前场行 (场地魔法 - 怪兽1..5 - 墓地) */}
                <div className="flex items-center gap-0">
                  {/* 我方场地魔法 */}
                  <div className="w-[92px] flex justify-center shrink-0">
                    <ZoneSlot
                      label="场地魔法"
                      controller={0}
                      location={CardLocation.SZONE}
                      sequence={5}
                      card={getCard(0, CardLocation.SZONE, 5)}
                      colorVariant="field"
                    />
                  </div>

                  <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-0.5">
                    {[0, 1, 2, 3, 4].map((seq) => (
                      <ZoneSlot
                        key={`my_mzone_${seq}`}
                        label={`怪兽 ${seq + 1}`}
                        controller={0}
                        location={CardLocation.MZONE}
                        sequence={seq}
                        card={getCard(0, CardLocation.MZONE, seq)}
                        colorVariant="monster"
                      />
                    ))}
                  </div>

                  {/* 我方墓地 */}
                  <div className="w-[92px] flex justify-center shrink-0">
                    <ZoneSlot
                      label="墓地"
                      controller={0}
                      location={CardLocation.GRAVE}
                      sequence={0}
                      card={getCard(0, CardLocation.GRAVE, 0)}
                      count={getCardCount(0, CardLocation.GRAVE)}
                      colorVariant="grave"
                    />
                  </div>
                </div>

                {/* Row 5: 我方后场行 (额外卡组 - 魔陷1..5 - 主卡组) */}
                <div className="flex items-center gap-0">
                  {/* 我方额外卡组 */}
                  <div className="w-[92px] flex justify-center shrink-0">
                    <ZoneSlot
                      label="额外卡组"
                      controller={0}
                      location={CardLocation.EXTRA}
                      sequence={0}
                      card={getCard(0, CardLocation.EXTRA, 0)}
                      count={getCardCount(0, CardLocation.EXTRA)}
                      colorVariant="extra"
                    />
                  </div>

                  <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-0.5">
                    {[0, 1, 2, 3, 4].map((seq) => (
                      <ZoneSlot
                        key={`my_szone_${seq}`}
                        label={`魔陷 ${seq + 1}`}
                        controller={0}
                        location={CardLocation.SZONE}
                        sequence={seq}
                        card={getCard(0, CardLocation.SZONE, seq)}
                        isPendulum={ruleInfo.pendulumInSZone && (seq === 0 || seq === 4)}
                        pendulumDirection={seq === 0 ? 'left' : seq === 4 ? 'right' : undefined}
                        // 我方场地位：屏幕左 seq0 = 我方左侧刻度(蓝)，屏幕右 seq4 = 右侧刻度(红)
                        colorVariant={
                          ruleInfo.pendulumInSZone && seq === 0
                            ? 'pendulum-blue'
                            : ruleInfo.pendulumInSZone && seq === 4
                              ? 'pendulum-red'
                              : 'spell'
                        }
                      />
                    ))}
                  </div>

                  {/* 我方主卡组 */}
                  <div className="w-[92px] flex justify-center shrink-0">
                    <ZoneSlot
                      label="主卡组"
                      controller={0}
                      location={CardLocation.DECK}
                      sequence={0}
                      card={getCard(0, CardLocation.DECK, 0)}
                      count={getCardCount(0, CardLocation.DECK)}
                      colorVariant="deck"
                    />
                  </div>
                </div>
              </div>

              {/* MR3 我方外侧独立灵摆区 (我方面向的右侧 sequence 1，我方右刻度=红) */}
              {ruleInfo.hasIndependentPZones && (
                <div className="ml-3 flex items-center justify-center shrink-0">
                  <ZoneSlot
                    label="灵摆区"
                    controller={0}
                    location={CardLocation.PZONE}
                    sequence={1}
                    card={getCard(0, CardLocation.PZONE, 1)}
                    isPendulum
                    pendulumDirection="right"
                    colorVariant="pendulum-red"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 底部：我方手牌托盘 */}
          <HandTray controller={0} />
        </div>
      </div>

      {/* 堆叠型区域 (额外/卡组/墓地/除外) 卡片列表查看与编排弹窗 */}
      <PileListModal />

      {/* 超量素材列表查看与编排弹窗 */}
      <OverlayListModal />

      {/* 主卡组「切换卡组」弹窗 (由主卡组格右键菜单唤起) */}
      <DeckSwitcherModal />

      {/* 全局单例右键上下文菜单 */}
      <CardContextMenu />

      {/* 全局独立实战属性与指示物自由拖拽操作面板 (Shift+左键点击唤出，移动卡片时面板独立不跟随) */}
      <CardStatPopover />

      {/* 选中卡动作条 / 未完成动作的目标选择条 (浮层，不参与布局以免压缩棋盘尺寸) */}
      <ActionIntentBar />
    </div>
  )
}
