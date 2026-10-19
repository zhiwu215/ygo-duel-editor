import {
  AGENT_BOARD_FACING_TO_POSITION,
  AGENT_BOARD_ZONE_TO_LOCATION,
  AgentBoardCardPlacement,
  AgentStepProposal,
  CdbCard,
  DuelStep,
  ResolvedBoardPlacement
} from '@shared/index'

export function defaultFacingForZone(zone: AgentBoardCardPlacement['location']): number {
  switch (zone) {
    case 'SZONE':
    case 'HAND':
    case 'DECK':
    case 'EXTRA':
      return AGENT_BOARD_FACING_TO_POSITION.FACEDOWN
    case 'GRAVE':
    case 'REMOVED':
      return AGENT_BOARD_FACING_TO_POSITION.FACEUP
    default:
      return AGENT_BOARD_FACING_TO_POSITION.FACEUP_ATTACK
  }
}

export function resolveBoardPlacements(
  placements: AgentBoardCardPlacement[],
  dict: Record<number, CdbCard>
): ResolvedBoardPlacement[] {
  return placements
    .map((p) => {
      if (p.isUnknown) {
        return {
          card: { id: 0, name: p.cardName || '未知盖卡' } as CdbCard,
          controller: p.side,
          location: AGENT_BOARD_ZONE_TO_LOCATION[p.location],
          sequence: p.sequence ?? 0,
          position: p.position
            ? AGENT_BOARD_FACING_TO_POSITION[p.position]
            : defaultFacingForZone(p.location),
          duelistName: p.duelistName
        }
      }
      const card = dict[p.code]
      if (!card) return null
      return {
        card,
        controller: p.side,
        location: AGENT_BOARD_ZONE_TO_LOCATION[p.location],
        sequence: p.sequence ?? 0,
        position: p.position
          ? AGENT_BOARD_FACING_TO_POSITION[p.position]
          : defaultFacingForZone(p.location),
        duelistName: p.duelistName,
        customAtk: p.customAtk,
        customDef: p.customDef
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
}

export function buildNameToCode(
  dict: Record<number, CdbCard>,
  resolved: ResolvedBoardPlacement[]
): Map<string, number> {
  const nameToCode = new Map<string, number>()
  Object.values(dict).forEach((c) => nameToCode.set(c.name, c.id))
  resolved.forEach((r) => nameToCode.set(r.card.name, r.card.id))
  return nameToCode
}

export function buildDuelSteps(
  proposals: AgentStepProposal[],
  nameToCode: Map<string, number>
): Array<Omit<DuelStep, 'id'>> {
  return proposals.map((p) => ({
    turn: p.turn || 1,
    phase: p.phase,
    turnPlayer: p.actionPlayer ?? 0,
    actionPlayer: p.actionPlayer ?? 0,
    actionType: p.actionType,
    cardCode: p.cardCode ?? (p.cardName ? nameToCode.get(p.cardName) : undefined),
    cardName: p.cardName,
    speaker: p.speaker,
    dialogue: p.dialogue,
    innerThoughts: p.innerThoughts,
    description: p.description,
    chainIndex: p.chainIndex,
    fromLocation: p.fromLocation,
    toLocation: p.toLocation,
    toSequence: p.toSequence,
    sourceQuote: p.sourceQuote,
    lpChange: p.lpChange
  }))
}
