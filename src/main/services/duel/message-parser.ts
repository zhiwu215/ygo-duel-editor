import {
  YGOProMsgSelectIdleCmd,
  YGOProMsgSelectBattleCmd,
  YGOProMsgSelectPlace,
  YGOProMsgSelectDisField,
  YGOProMsgSelectChain,
  YGOProMsgSelectCard,
  YGOProMsgSelectTribute,
  YGOProMsgSelectPosition,
  YGOProMsgSelectYesNo,
  YGOProMsgSelectEffectYn,
  YGOProMsgSelectOption,
  YGOProMsgAnnounceAttrib,
  YGOProMsgAnnounceRace,
  YGOProMsgAnnounceNumber,
  YGOProMsgAnnounceCard,
  YGOProMsgSelectCounter,
  YGOProMsgSelectSum,
  YGOProMsgSortCard,
  YGOProMsgSelectUnselectCard,
  YGOProMsgRockPaperScissors
} from 'ygopro-msg-encode'

export function isInteractiveQuery(msg: unknown): boolean {
  return (
    msg instanceof YGOProMsgSelectIdleCmd ||
    msg instanceof YGOProMsgSelectBattleCmd ||
    msg instanceof YGOProMsgSelectPlace ||
    msg instanceof YGOProMsgSelectDisField ||
    msg instanceof YGOProMsgSelectChain ||
    msg instanceof YGOProMsgSelectCard ||
    msg instanceof YGOProMsgSelectTribute ||
    msg instanceof YGOProMsgSelectPosition ||
    msg instanceof YGOProMsgSelectYesNo ||
    msg instanceof YGOProMsgSelectEffectYn ||
    msg instanceof YGOProMsgSelectOption ||
    msg instanceof YGOProMsgAnnounceAttrib ||
    msg instanceof YGOProMsgAnnounceRace ||
    msg instanceof YGOProMsgAnnounceNumber ||
    msg instanceof YGOProMsgAnnounceCard ||
    msg instanceof YGOProMsgSelectCounter ||
    msg instanceof YGOProMsgSelectSum ||
    msg instanceof YGOProMsgSortCard ||
    msg instanceof YGOProMsgSelectUnselectCard ||
    msg instanceof YGOProMsgRockPaperScissors
  )
}
