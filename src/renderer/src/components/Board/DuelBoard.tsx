import React from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { CardLocation, MASTER_RULES, FieldCard } from '@shared/index'
import { ZoneSlot } from './ZoneSlot'
import { HandTray } from './components/HandTray'
import { CardContextMenu } from './CardContextMenu'
import duelBg from '../../assets/textures/bg.jpg'

export const DuelBoard: React.FC = () => {
  const { state } = useDuelStore()
  const ruleInfo = MASTER_RULES[state.masterRule]

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
    <div
      className="flex-1 h-full overflow-hidden p-2.5 flex flex-col justify-between items-center bg-cover bg-center bg-no-repeat relative select-none"
      style={{
        backgroundImage: `linear-gradient(rgba(10, 11, 15, 0.84), rgba(10, 11, 15, 0.90)), url(${duelBg})`
      }}
    >
      {/* 顶部：对方手牌托盘 */}
      <HandTray controller={1} ruleName={ruleInfo.name} />

      {/* 核心对战台网格 (标准 YGOPro 5 行对称矩阵布局) */}
      <div className="relative w-full max-w-5xl my-auto py-2.5 px-3 rounded-xl bg-card/40 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center gap-1.5 shrink-0">
        {/* ============================================================== */}
        {/* 对方对战区域 (Opponent Sector) */}
        {/* 包含 MR3 左右独立灵摆区（垂直居中）、左翼卡组/墓地、中央对战区 5x2、右翼额外/场地 */}
        {/* ============================================================== */}
        <div className="flex items-center">
          {/* MR3 对方外侧独立灵摆区 (红刻度 / 面对场地的左侧 -> 对方面向的右侧 sequence 1) */}
          {ruleInfo.hasIndependentPZones && (
            <div className="mr-3 flex items-center justify-center shrink-0">
              <ZoneSlot
                label="对方灵摆(红)"
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

              {/* 对方魔陷区 5 ~ 1 (顶部带红调对战台边框) */}
              <div className="flex items-center gap-2 px-2.5 pt-2 pb-1 rounded-t-xl bg-gradient-to-b from-red-950/25 via-black/40 to-black/30 border-t border-x border-red-500/25 shadow-sm">
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
                    colorVariant="spell"
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

              {/* 对方怪兽区 5 ~ 1 (底部带红调对战台边框，与魔陷区无缝合璧) */}
              <div className="flex items-center gap-2 px-2.5 pb-2 pt-1 rounded-b-xl bg-gradient-to-t from-red-950/25 via-black/40 to-black/30 border-b border-x border-red-500/25 shadow-sm">
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

          {/* MR3 对方外侧独立灵摆区 (蓝刻度 / 面对场地的右侧 -> 对方面向的左侧 sequence 0) */}
          {ruleInfo.hasIndependentPZones && (
            <div className="ml-3 flex items-center justify-center shrink-0">
              <ZoneSlot
                label="对方灵摆(蓝)"
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
          {ruleInfo.hasIndependentPZones && <div className="w-[74px] h-[104px] mr-3 shrink-0" />}

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
            <div className="relative w-[422px] h-[104px] flex items-center justify-center shrink-0">
              {/* 贯穿 EMZ 的高科技轨道底线 */}
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none" />

              {/* 两个 EMZ 槽位分别对应下方怪兽区 2 号位与 4 号位 */}
              <div className="w-full flex items-center justify-between px-[90px] relative z-10">
                <ZoneSlot
                  label="额外怪兽区 1"
                  controller={0}
                  location={CardLocation.MZONE}
                  sequence={5}
                  card={getCard(0, CardLocation.MZONE, 5) || getCard(1, CardLocation.MZONE, 5)}
                  colorVariant="emz"
                />
                <ZoneSlot
                  label="额外怪兽区 2"
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
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
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
          {ruleInfo.hasIndependentPZones && <div className="w-[74px] h-[104px] ml-3 shrink-0" />}
        </div>

        {/* ============================================================== */}
        {/* 我方对战区域 (Player Sector) */}
        {/* 包含 MR3 左右独立灵摆区（垂直居中）、左翼场地/额外、中央对战区 5x2、右翼墓地/卡组 */}
        {/* ============================================================== */}
        <div className="flex items-center">
          {/* MR3 我方外侧独立灵摆区 (蓝刻度 / 面对场地的左侧 sequence 0) */}
          {ruleInfo.hasIndependentPZones && (
            <div className="mr-3 flex items-center justify-center shrink-0">
              <ZoneSlot
                label="我方灵摆(蓝)"
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

              {/* 我方怪兽区 1 ~ 5 (顶部带蓝调对战台边框，与下方魔陷区无缝合璧) */}
              <div className="flex items-center gap-2 px-2.5 pt-2 pb-1 rounded-t-xl bg-gradient-to-b from-blue-950/25 via-black/40 to-black/30 border-t border-x border-blue-500/25 shadow-sm">
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

              {/* 我方魔陷区 1 ~ 5 (底部带蓝调对战台边框) */}
              <div className="flex items-center gap-2 px-2.5 pb-2 pt-1 rounded-b-xl bg-gradient-to-t from-blue-950/25 via-black/40 to-black/30 border-b border-x border-blue-500/25 shadow-sm">
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
                    colorVariant="spell"
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

          {/* MR3 我方外侧独立灵摆区 (红刻度 / 面对场地的右侧 sequence 1) */}
          {ruleInfo.hasIndependentPZones && (
            <div className="ml-3 flex items-center justify-center shrink-0">
              <ZoneSlot
                label="我方灵摆(红)"
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

      {/* 全局单例右键上下文菜单 */}
      <CardContextMenu />
    </div>
  )
}
