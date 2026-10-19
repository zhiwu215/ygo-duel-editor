import React from 'react'
import { CardLocation, FieldCard } from '@shared/index'
import { ZoneSlot, type ZoneColorVariant } from './ZoneSlot'

interface BoardWingSpec {
  label: string
  location: number
  sequence: number
  colorVariant: ZoneColorVariant
  withCount: boolean
}

interface BoardRowSpec {
  left: BoardWingSpec
  right: BoardWingSpec
  centerLocation: number
  centerLabel: string
  centerKey: string
}

interface BoardSectorProps {
  controller: 0 | 1
  pendulumInSZone: boolean
  hasIndependentPZones: boolean
  getCard: (controller: 0 | 1, location: number, sequence: number) => FieldCard | undefined
  getCardCount: (controller: 0 | 1, location: number) => number
}

export const BoardSector: React.FC<BoardSectorProps> = ({
  controller,
  pendulumInSZone,
  hasIndependentPZones,
  getCard,
  getCardCount
}) => {
  const isOpponent = controller === 1
  const seqs = isOpponent ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4]
  const keyPrefix = isOpponent ? 'opp' : 'my'

  const deckWing: BoardWingSpec = {
    label: '主卡组',
    location: CardLocation.DECK,
    sequence: 0,
    colorVariant: 'deck',
    withCount: true
  }
  const extraWing: BoardWingSpec = {
    label: '额外卡组',
    location: CardLocation.EXTRA,
    sequence: 0,
    colorVariant: 'extra',
    withCount: true
  }
  const graveWing: BoardWingSpec = {
    label: '墓地',
    location: CardLocation.GRAVE,
    sequence: 0,
    colorVariant: 'grave',
    withCount: true
  }
  const fieldWing: BoardWingSpec = {
    label: '场地魔法',
    location: CardLocation.SZONE,
    sequence: 5,
    colorVariant: 'field',
    withCount: false
  }

  const rows: BoardRowSpec[] = isOpponent
    ? [
        {
          left: deckWing,
          right: extraWing,
          centerLocation: CardLocation.SZONE,
          centerLabel: '魔陷',
          centerKey: `${keyPrefix}_szone`
        },
        {
          left: graveWing,
          right: fieldWing,
          centerLocation: CardLocation.MZONE,
          centerLabel: '怪兽',
          centerKey: `${keyPrefix}_mzone`
        }
      ]
    : [
        {
          left: fieldWing,
          right: graveWing,
          centerLocation: CardLocation.MZONE,
          centerLabel: '怪兽',
          centerKey: `${keyPrefix}_mzone`
        },
        {
          left: extraWing,
          right: deckWing,
          centerLocation: CardLocation.SZONE,
          centerLabel: '魔陷',
          centerKey: `${keyPrefix}_szone`
        }
      ]

  return (
    <div className="flex items-center">
      {hasIndependentPZones && (
        <div className="mr-3 flex items-center justify-center shrink-0">
          <ZoneSlot
            label="灵摆区"
            controller={controller}
            location={CardLocation.PZONE}
            sequence={isOpponent ? 1 : 0}
            card={getCard(controller, CardLocation.PZONE, isOpponent ? 1 : 0)}
            isPendulum
            pendulumDirection="left"
            colorVariant={isOpponent ? 'pendulum-red' : 'pendulum-blue'}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {rows.map((row, rowIdx) => (
          <div key={row.centerKey} className="flex items-center gap-0">
            <div className="w-[92px] flex justify-center shrink-0">
              <ZoneSlot
                label={row.left.label}
                controller={controller}
                location={row.left.location}
                sequence={row.left.sequence}
                card={getCard(controller, row.left.location, row.left.sequence)}
                count={row.left.withCount ? getCardCount(controller, row.left.location) : undefined}
                colorVariant={row.left.colorVariant}
              />
            </div>

            <div
              className={
                rowIdx === 0
                  ? 'flex items-center gap-2 px-2.5 pt-1.5 pb-0.5'
                  : 'flex items-center gap-2 px-2.5 pb-1.5 pt-0.5'
              }
            >
              {seqs.map((seq) => (
                <ZoneSlot
                  key={`${row.centerKey}_${seq}`}
                  label={`${row.centerLabel} ${seq + 1}`}
                  controller={controller}
                  location={row.centerLocation}
                  sequence={seq}
                  card={getCard(controller, row.centerLocation, seq)}
                  isPendulum={
                    row.centerLocation === CardLocation.SZONE &&
                    pendulumInSZone &&
                    (seq === 0 || seq === 4)
                  }
                  pendulumDirection={
                    row.centerLocation === CardLocation.SZONE
                      ? seq === (isOpponent ? 4 : 0)
                        ? 'left'
                        : seq === (isOpponent ? 0 : 4)
                          ? 'right'
                          : undefined
                      : undefined
                  }
                  colorVariant={
                    row.centerLocation === CardLocation.SZONE
                      ? pendulumInSZone && seq === 4
                        ? 'pendulum-red'
                        : pendulumInSZone && seq === 0
                          ? 'pendulum-blue'
                          : 'spell'
                      : 'monster'
                  }
                />
              ))}
            </div>

            <div className="w-[92px] flex justify-center shrink-0">
              <ZoneSlot
                label={row.right.label}
                controller={controller}
                location={row.right.location}
                sequence={row.right.sequence}
                card={getCard(controller, row.right.location, row.right.sequence)}
                count={
                  row.right.withCount ? getCardCount(controller, row.right.location) : undefined
                }
                colorVariant={row.right.colorVariant}
              />
            </div>
          </div>
        ))}
      </div>

      {hasIndependentPZones && (
        <div className="ml-3 flex items-center justify-center shrink-0">
          <ZoneSlot
            label="灵摆区"
            controller={controller}
            location={CardLocation.PZONE}
            sequence={isOpponent ? 0 : 1}
            card={getCard(controller, CardLocation.PZONE, isOpponent ? 0 : 1)}
            isPendulum
            pendulumDirection="right"
            colorVariant={isOpponent ? 'pendulum-blue' : 'pendulum-red'}
          />
        </div>
      )}
    </div>
  )
}
