export function splitSetcode(value: number | bigint): number[] {
  let raw = BigInt.asUintN(64, typeof value === 'bigint' ? value : BigInt(Math.trunc(value)))
  const setcodes: number[] = []
  while (raw !== 0n && setcodes.length < 4) {
    const chunk = Number(raw & 0xffffn)
    if (chunk !== 0) setcodes.push(chunk)
    raw >>= 16n
  }
  return setcodes
}
