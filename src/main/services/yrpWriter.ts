import type { OcgResponse } from 'ocgcore-wasm'

export const YRP_ID = 0x31707279
export const YRP_VERSION = 0x1362
export const YRP_FLAG_COMPRESSED = 0x1
export const YRP_FLAG_UNIFORM = 0x10
export const YRP_HEADER_SIZE = 32
export const YRP_NAME_BYTES = 40
export const YRP_MAX_PAYLOAD = 0x80000
export interface YrpDeck {
  main: number[]
  extra: number[]
}

export interface YrpWriteOptions {
  names: [string, string]
  startLp: number
  startHand: number
  drawCount: number
  duelRule: number
  extraFlags?: number
  decks: [YrpDeck, YrpDeck]
  responses: Uint8Array[]
}

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

function int32Response(value: number): Uint8Array {
  const w = new ByteWriter()
  w.i32(value)
  return w.toUint8Array()
}

function indexListResponse(indices: number[] | null): Uint8Array {
  const list = indices ?? []
  const w = new ByteWriter()
  w.u8(list.length)
  for (const i of list) w.u8(i)
  return w.toUint8Array()
}

function placesResponse(
  places: { player: number; location: number; sequence: number }[]
): Uint8Array {
  const w = new ByteWriter()
  for (const p of places) {
    w.u8(p.player)
    w.u8(p.location)
    w.u8(p.sequence)
  }
  return w.toUint8Array()
}

function counterResponse(counters: number[]): Uint8Array {
  const w = new ByteWriter()
  for (const c of counters) w.u16(c)
  return w.toUint8Array()
}

export function encodeOcgResponse(response: OcgResponse): Uint8Array {
  const r = response as unknown as Record<string, unknown>
  switch (response.type) {
    case 0:
      return int32Response(((r.index as number) ?? 0) << 16)
    case 1:
      return int32Response((((r.index as number) ?? 0) << 16) + 5)
    case 2:
      return int32Response(r.yes ? 1 : 0)
    case 3:
      return int32Response(r.yes ? 1 : 0)
    case 4:
      return int32Response((r.index as number) ?? 0)
    case 5:
      return indexListResponse(r.indicies as number[] | null)
    case 6:
      return indexListResponse(r.codes as number[] | null)
    case 7:
      return indexListResponse(r.indicies as number[] | null)
    case 8:
      return int32Response((r.index as number | null) ?? -1)
    case 9:
      return placesResponse(
        (r.places ?? []) as { player: number; location: number; sequence: number }[]
      )
    case 10:
      return placesResponse(
        (r.places ?? []) as { player: number; location: number; sequence: number }[]
      )
    case 11:
      return int32Response((r.position as number) ?? 1)
    case 12:
    case 14:
    case 15:
      return indexListResponse((r.indicies ?? r.order ?? []) as number[])
    case 13:
      return counterResponse((r.counters ?? []) as number[])
    case 16:
      return int32Response(((r.races ?? []) as number[])[0] ?? 1)
    case 17:
      return int32Response(((r.attributes ?? []) as number[])[0] ?? 1)
    case 18:
      return int32Response((r.card as number) ?? 0)
    case 19:
      return int32Response((r.value as number) ?? 0)
    case 20:
      return int32Response((r.value as number) ?? 1)
    default:
      return new Uint8Array(0)
  }
}

export function buildYrpPayload(options: YrpWriteOptions): Uint8Array {
  const w = new ByteWriter()

  w.ascii40(options.names[0])
  w.ascii40(options.names[1])

  w.i32(options.startLp)
  w.i32(options.startHand)
  w.i32(options.drawCount)
  w.i32(((options.duelRule << 16) | (options.extraFlags ?? 0)) >>> 0)

  for (const deck of options.decks) {
    w.i32(deck.main.length)
    for (let i = deck.main.length - 1; i >= 0; i--) w.i32(deck.main[i])
    w.i32(deck.extra.length)
    for (let i = deck.extra.length - 1; i >= 0; i--) w.i32(deck.extra[i])
  }

  for (const res of options.responses) {
    const len = Math.min(res.length, 255)
    if (len === 0) continue
    w.u8(len)
    w.bytes(res.subarray(0, len))
  }

  return w.toUint8Array()
}

export function buildYrpFile(options: YrpWriteOptions): Uint8Array {
  const payload = buildYrpPayload(options)
  if (payload.length > YRP_MAX_PAYLOAD) {
    throw new Error(
      `回放数据 ${payload.length} 字节超出 ygopro 上限 ${YRP_MAX_PAYLOAD}，请缩短对局`
    )
  }

  const out = new ByteWriter()
  out.i32(YRP_ID)
  out.i32(YRP_VERSION)
  out.i32(YRP_FLAG_UNIFORM)
  out.i32(0)
  out.i32(payload.length)
  out.i32(0)
  for (let i = 0; i < 8; i++) out.u8(0)

  out.bytes(payload)
  return out.toUint8Array()
}
