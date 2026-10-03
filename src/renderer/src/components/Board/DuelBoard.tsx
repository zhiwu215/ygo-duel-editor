import React, { useEffect } from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { CardLocation, MASTER_RULES, FieldCard } from '@shared/index'
import { ZoneSlot } from './ZoneSlot'
import { HandTray } from './components/HandTray'
import { CardContextMenu } from './CardContextMenu'
import { PileListModal } from './PileListModal'
import { OverlayListModal } from './OverlayListModal'
import { CardStatPopover } from './components/CardStatPopover'

export const DuelBoard: React.FC = () => {
  const { state } = useDuelStore()
  const ruleInfo = MASTER_RULES[state.masterRule]

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
      const pile = state.cards.filter((c) => c.controller === controller && c.location === location)
      return pile[pile.length - 1]
    }
    return state.cards.find(
      (c) => c.controller === controller && c.location === location && c.sequence === sequence
    )
  }

  // 辅助统计指定区域的卡片总数 (如卡组、额外、墓地、除外区堆叠计数)
  const getCardCount = (controller: 0 | 1, location: number): number => {
    return state.cards.filter((c) => c.controller === controller && c.location === location).length
  }

  return (
    <div className="flex-1 h-full overflow-hidden p-2.5 flex flex-col justify-between items-center relative select-none">
      {/* CSS 六边形网格背景（替代位图纹理，深浅双主题自适应） */}
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

      {/* 顶部：对方手牌托盘 */}
      <HandTray controller={1} ruleName={ruleInfo.name} />

      {/* 核心对战台网格 (标准 YGOPro 5 行对称矩阵布局) */}
      <div className="relative z-10 w-full max-w-5xl my-auto py-2.5 px-3 rounded-lg bg-card border border-border shadow-sm flex flex-col items-center justify-center gap-1.5 shrink-0">
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
              <div className="mr-3 shrink-0">
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

              {/* 对方魔陷区 5 ~ 1 (红描边语义框：对方侧) */}
              <div className="flex items-center gap-2 px-2.5 pt-2 pb-1 rounded-t-lg border-t border-x border-red-500/30 dark:border-red-400/20 bg-background/40 dark:bg-black/25">
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
              <div className="ml-3 shrink-0">
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
              <div className="mr-3 shrink-0">
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

              {/* 对方怪兽区 5 ~ 1 (红描边语义框，与魔陷区无缝合璧) */}
              <div className="flex items-center gap-2 px-2.5 pb-2 pt-1 rounded-b-lg border-b border-x border-red-500/30 dark:border-red-400/20 bg-background/40 dark:bg-black/25">
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
              <div className="ml-3 shrink-0">
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
          {ruleInfo.hasIndependentPZones && <div className="w-[104px] h-[104px] mr-3 shrink-0" />}

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
            <div className="relative w-[492px] h-[104px] flex items-center justify-center shrink-0">
              {/* 两个 EMZ 槽位分别对应下方怪兽区 2 号位与 4 号位 */}
              <div className="w-full flex items-center justify-between px-[130px] relative z-10">
                <ZoneSlot
                  label="EX 怪兽 1"
                  controller={0}
                  location={CardLocation.MZONE}
                  sequence={5}
                  card={getCard(0, CardLocation.MZONE, 5) || getCard(1, CardLocation.MZONE, 5)}
                  colorVariant="emz"
                />
                <ZoneSlot
                  label="EX 怪兽 2"
                  controller={0}
                  location={CardLocation.MZONE}
                  sequence={6}
                  card={getCard(0, CardLocation.MZONE, 6) || getCard(1, CardLocation.MZONE, 6)}
                  colorVariant="emz"
                />
              </div>
            </div>
          ) : (
            <div className="relative w-[422px] h-[104px] flex items-center justify-center shrink-0">
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

          {/* MR3 占位对齐（保持与外侧灵摆区等宽） */}
          {ruleInfo.hasIndependentPZones && <div className="w-[104px] h-[104px] ml-3 shrink-0" />}
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
              <div className="mr-3 shrink-0">
                <ZoneSlot
                  label="场地魔法"
                  controller={0}
                  location={CardLocation.SZONE}
                  sequence={5}
                  card={getCard(0, CardLocation.SZONE, 5)}
                  colorVariant="field"
                />
              </div>

              {/* 我方怪兽区 1 ~ 5 (蓝描边语义框，与下方魔陷区无缝合璧) */}
              <div className="flex items-center gap-2 px-2.5 pt-2 pb-1 rounded-t-lg border-t border-x border-blue-500/30 dark:border-blue-400/20 bg-background/40 dark:bg-black/25">
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
              <div className="ml-3 shrink-0">
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
              <div className="mr-3 shrink-0">
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

              {/* 我方魔陷区 1 ~ 5 (蓝描边语义框) */}
              <div className="flex items-center gap-2 px-2.5 pb-2 pt-1 rounded-b-lg border-b border-x border-blue-500/30 dark:border-blue-400/20 bg-background/40 dark:bg-black/25">
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
              <div className="ml-3 shrink-0">
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

      {/* 堆叠型区域 (额外/卡组/墓地/除外) 卡片列表查看与编排弹窗 */}
      <PileListModal />

      {/* 超量素材列表查看与编排弹窗 */}
      <OverlayListModal />

      {/* 全局单例右键上下文菜单 */}
      <CardContextMenu />

      {/* 全局独立实战属性与指示物自由拖拽操作面板 (Shift+左键点击唤出，移动卡片时面板独立不跟随) */}
      <CardStatPopover />
    </div>
  )
}
