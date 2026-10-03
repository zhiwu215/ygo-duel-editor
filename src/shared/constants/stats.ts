/**
 * 决斗数值常量与无限 (∞) 运算辅助
 */

/**
 * 表示无限数值的标量常数 (99,999,999)
 * 在游戏王电子游戏、引擎与 ocgcore 规则实现中，99999999 常作为无限/上限的规范标量，
 * 既能安全保存在 JSON 工程中（避免原生 JavaScript Infinity 被 JSON 序列化为 null），
 * 也能直接导出至 ocgcore 的 32 位整型 Debug.SetPlayerInfo 接口中。
 */
export const INFINITY_VALUE = 99999999

/**
 * 判定一个数值是否代表「无限 (∞)」
 */
export function isInfiniteVal(val: number | undefined | null): boolean {
  if (val === undefined || val === null) return false
  return val >= INFINITY_VALUE || val === Infinity
}

/**
 * 格式化攻守或生命值数值（当为无限时返回 '∞'，未定义返回 '?' 或 '-'）
 */
export function formatStatValue(
  val: number | undefined | null,
  defaultVal: number | string = '-'
): string {
  if (val === undefined || val === null) return String(defaultVal)
  if (isInfiniteVal(val)) return '∞'
  if (val === -2) return '?'
  return String(val)
}
