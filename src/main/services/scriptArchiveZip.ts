import { inflateRawSync } from 'zlib'

export interface ZipScriptEntry {
  offset: number
  compressedSize: number
  size: number
  method: number
}

const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50
const LOCAL_FILE_HEADER = 0x04034b50
const EOCD_MIN_SIZE = 22
const MAX_COMMENT_SIZE = 0xffff

export function buildZipScriptIndex(buffer: Buffer): Map<number, ZipScriptEntry> | null {
  const searchStart = Math.max(0, buffer.length - EOCD_MIN_SIZE - MAX_COMMENT_SIZE)
  let eocd = -1
  for (let offset = buffer.length - EOCD_MIN_SIZE; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      eocd = offset
      break
    }
  }
  if (eocd < 0) return null

  const entryCount = buffer.readUInt16LE(eocd + 10)
  const centralOffset = buffer.readUInt32LE(eocd + 16)
  const entries = new Map<number, ZipScriptEntry>()
  let offset = centralOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length) return null
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY) return null
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const size = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const nameEnd = offset + 46 + nameLength
    if (nameEnd > buffer.length) return null
    const match = /(?:^|\/)c(\d+)\.lua$/i.exec(buffer.toString('utf8', offset + 46, nameEnd))
    if (match) {
      const code = Number(match[1])
      if (Number.isInteger(code) && code > 0 && !entries.has(code)) {
        entries.set(code, { offset: localOffset, compressedSize, size, method })
      }
    }
    offset = nameEnd + extraLength + commentLength
  }
  return entries
}

export function readZipScriptEntry(buffer: Buffer, entry: ZipScriptEntry): string | null {
  const local = entry.offset
  if (local < 0 || local + 30 > buffer.length) return null
  if (buffer.readUInt32LE(local) !== LOCAL_FILE_HEADER) return null
  const nameLength = buffer.readUInt16LE(local + 26)
  const extraLength = buffer.readUInt16LE(local + 28)
  const start = local + 30 + nameLength + extraLength
  const end = start + entry.compressedSize
  if (start < 0 || end > buffer.length) return null

  try {
    const data = buffer.subarray(start, end)
    const raw = entry.method === 0 ? data : entry.method === 8 ? inflateRawSync(data) : null
    return raw ? raw.toString('utf8').replace(/^\uFEFF/, '') : null
  } catch {
    return null
  }
}
