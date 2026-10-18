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

/**
 * 判断消息是否为玩家交互询问。
 *
 * 交互内容本身由 request-router 转成 EngineRequest（纯数据），这里只负责在
 * advanceEngine 中识别「引擎正在等待作答」的时点。
 */
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
