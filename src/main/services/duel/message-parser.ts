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

/**
 * 空连锁询问：引擎在「无可连锁卡」时依然会问一次是否连锁，玩家实际无牌可连。
 *
 * 这类询问由 main 侧用 defaultResponse() 静默放弃（等价于点「不连锁」），
 * 因此必须把它从「批内交互点」和「待答请求」中排除 —— 否则空连锁自己就会
 * 触发防自动应答守卫，导致高频的空连锁弹窗骚扰 UI。
 * 有卡可连（chains.length > 0）的询问不受影响，照常弹给玩家。
 */
export function isEmptyChainQuery(msg: unknown): boolean {
  return msg instanceof YGOProMsgSelectChain && msg.chains.length === 0
}
