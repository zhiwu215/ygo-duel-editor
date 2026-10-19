export const YRP2_ID = 0x32707279
export const YRP_VERSION = 0x1362
export const YRP_FLAG_UNIFORM = 0x10
export const YRP_FLAG_SINGLE_MODE = 0x8
export const YRP_MAX_PAYLOAD = 0x80000
export const DUEL_PSEUDO_SHUFFLE = 0x10

class ByteWriter {
  private buf: number[] = []

  public u8(v: number): void {
    this.buf.push(v & 0xff)
  }

  public u16(v: number): void {
    this.buf.push(v & 0xff, (v >>> 8) & 0xff)
  }

  public i32(v: number): void {
    const n = v | 0
    this.buf.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff)
  }

  public bytes(arr: Uint8Array | number[]): void {
    for (const b of arr) this.buf.push(b & 0xff)
  }

  public ascii40(text: string): void {
    const units: number[] = []
    for (const ch of text.slice(0, 19)) units.push(ch.charCodeAt(0))
    while (units.length < 20) units.push(0)
    for (const u of units) this.u16(u)
  }

  public get length(): number {
    return this.buf.length
  }

  public toUint8Array(): Uint8Array {
    return Uint8Array.from(this.buf)
  }
}

export interface YrpSingleWriteOptions {
  names: [string, string]
  startLp: number
  startHand: number
  drawCount: number
  opt: number
  scriptFile: string
  responses: Uint8Array[]
}

export function buildYrpSingleFile(options: YrpSingleWriteOptions): Uint8Array {
  const payload = new ByteWriter()
  payload.ascii40(options.names[0])
  payload.ascii40(options.names[1])
  payload.i32(options.startLp)
  payload.i32(options.startHand)
  payload.i32(options.drawCount)
  payload.i32(options.opt)

  const scriptBytes = new TextEncoder().encode(options.scriptFile)
  payload.u16(scriptBytes.length)
  payload.bytes(scriptBytes)

  for (const res of options.responses) {
    const len = Math.min(res.length, 255)
    if (len === 0) continue
    payload.u8(len)
    payload.bytes(res.subarray(0, len))
  }

  if (payload.length > YRP_MAX_PAYLOAD) {
    throw new Error(
      `回放数据 ${payload.length} 字节超出 ygopro 上限 ${YRP_MAX_PAYLOAD}，请缩短编排`
    )
  }

  const out = new ByteWriter()
  out.i32(YRP2_ID)
  out.i32(YRP_VERSION)
  out.i32(YRP_FLAG_UNIFORM | YRP_FLAG_SINGLE_MODE)
  out.i32(0)
  out.i32(0)
  out.i32(Math.floor(Date.now() / 1000))
  for (let i = 0; i < 8; i++) out.u8(0)
  const seedSequence = [100, 200, 300, 400, 500, 600, 700, 800]
  for (const s of seedSequence) out.i32(s)
  out.i32(1)
  out.i32(0)
  out.i32(0)
  out.i32(0)
  out.bytes(payload.toUint8Array())
  return out.toUint8Array()
}
