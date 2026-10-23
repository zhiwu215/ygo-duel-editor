import React, { useEffect } from 'react'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { useContextMenuStore } from '../../stores/useContextMenuStore'
import { CardLocation, MASTER_RULES, FieldCard, isStandardTag } from '@shared/index'
import { ZoneSlot } from './ZoneSlot'
import { HandTray } from './components/HandTray'
import { BoardSector } from './BoardSector'
import { DuelBoardOverlays } from './DuelBoardOverlays'
import { PhaseStatusButton, PhaseMiddleButton, PhaseEpButton } from './PhaseControlButtons'
import { DuelStartButton } from './DuelStartButton'
import { useBoardAutoScale } from '../../hooks/useBoardAutoScale'
import { getPileTopCard, getPileCount } from '../../utils/duelBoardQuery'
import { resolveOwnerScope } from '../../utils/duelistNames'

export const DuelBoard: React.FC = () => {
  const state = useDuelStore((s) => s.state)
  const activeDuelistIds = useDuelStore((s) => s.activeDuelistIds)
  const currentTurn = useDuelStore((s) => s.currentTurn)
  const duelStarted = useDuelStore((s) => s.duelStarted)
  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const ruleInfo = MASTER_RULES[state.masterRule]

  const showPhaseControls = duelStarted || isEngineActive
  const middleSlot = duelStarted || isEngineActive ? <PhaseMiddleButton /> : <DuelStartButton />

  const { viewportRef, wrapperRef, boardRef, scale, naturalW } = useBoardAutoScale()

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

  const standardTag = isStandardTag(state.matchConfig)
  const ownerScopeOf = (controller: 0 | 1, location: number): string | null => {
    if (standardTag && (location === CardLocation.GRAVE || location === CardLocation.REMOVED)) {
      return null
    }
    return resolveOwnerScope(state.duelists, controller, activeDuelistIds[controller], currentTurn)
  }

  const getCard = (
    controller: 0 | 1,
    location: number,
    sequence: number
  ): FieldCard | undefined => {
    if (
      location === CardLocation.DECK ||
      location === CardLocation.GRAVE ||
      location === CardLocation.EXTRA ||
      location === CardLocation.REMOVED
    ) {
      return getPileTopCard(
        state.cards,
        controller,
        location,
        ownerScopeOf(controller, location),
        isEngineActive
      )
    }
    return state.cards.find(
      (c) => c.controller === controller && c.location === location && c.sequence === sequence
    )
  }

  const getCardCount = (controller: 0 | 1, location: number): number =>
    getPileCount(state.cards, controller, location, ownerScopeOf(controller, location))

  return (
    <div className="flex-1 h-full relative select-none min-h-0 overflow-hidden flex flex-col">
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

      <div
        ref={viewportRef}
        className="w-full flex-1 overflow-auto p-2 sm:p-3 flex flex-col items-center relative z-10 min-h-0"
        style={{
          scrollbarGutter: 'stable'
        }}
      >
        <div
          ref={wrapperRef}
          className="flex flex-col items-center gap-2.5 m-auto shrink-0 transition-transform duration-500 ease-out"
          style={{
            width: naturalW > 0 ? naturalW : undefined,
            zoom: String(scale)
          }}
        >
          <HandTray controller={1} />

          <div
            ref={boardRef}
            className="relative z-10 w-max py-2 px-3 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col items-center justify-center gap-1 shrink-0"
          >
            <BoardSector
              controller={1}
              pendulumInSZone={ruleInfo.pendulumInSZone}
              hasIndependentPZones={ruleInfo.hasIndependentPZones}
              getCard={getCard}
              getCardCount={getCardCount}
            />

            <div className="flex items-center gap-0 my-0.5">
              {ruleInfo.hasIndependentPZones && <div className="w-[92px] h-[92px] mr-3 shrink-0" />}

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

              {ruleInfo.hasEMZ ? (
                <div className="flex items-center gap-2 px-2.5 my-0.5 w-[512px] justify-center shrink-0">
                  {showPhaseControls && (
                    <div className="w-[92px] h-[92px] flex items-center justify-center shrink-0">
                      <PhaseStatusButton />
                    </div>
                  )}
                  <ZoneSlot
                    label="EX 怪兽 1"
                    controller={0}
                    location={CardLocation.MZONE}
                    sequence={5}
                    card={getCard(0, CardLocation.MZONE, 5) || getCard(1, CardLocation.MZONE, 5)}
                    colorVariant="emz"
                  />
                  <div className="w-[92px] h-[92px] flex items-center justify-center shrink-0">
                    {middleSlot}
                  </div>
                  <ZoneSlot
                    label="EX 怪兽 2"
                    controller={0}
                    location={CardLocation.MZONE}
                    sequence={6}
                    card={getCard(0, CardLocation.MZONE, 6) || getCard(1, CardLocation.MZONE, 6)}
                    colorVariant="emz"
                  />
                  {showPhaseControls && (
                    <div className="w-[92px] h-[92px] flex items-center justify-center shrink-0">
                      <PhaseEpButton />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`flex items-center gap-2 my-0.5 w-[512px] h-[92px] px-6 shrink-0 relative ${
                    showPhaseControls ? 'justify-between' : 'justify-center'
                  }`}
                >
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border dark:bg-white/15" />
                  {showPhaseControls && (
                    <div className="relative z-10 w-[92px] flex items-center justify-center">
                      <PhaseStatusButton />
                    </div>
                  )}
                  <div className="relative z-10 w-[92px] flex items-center justify-center">
                    {middleSlot}
                  </div>
                  {showPhaseControls && (
                    <div className="relative z-10 w-[92px] flex items-center justify-center">
                      <PhaseEpButton />
                    </div>
                  )}
                </div>
              )}

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

              {ruleInfo.hasIndependentPZones && <div className="w-[92px] h-[92px] ml-3 shrink-0" />}
            </div>

            <BoardSector
              controller={0}
              pendulumInSZone={ruleInfo.pendulumInSZone}
              hasIndependentPZones={ruleInfo.hasIndependentPZones}
              getCard={getCard}
              getCardCount={getCardCount}
            />
          </div>

          <HandTray controller={0} />
        </div>
      </div>

      <DuelBoardOverlays />
    </div>
  )
}
