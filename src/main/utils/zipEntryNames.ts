import { readFileSync } from 'fs'

const EOCD_SIGNATURE = 0x06054b50
const CEN_SIGNATURE = 0x02014b50

export function readZipEntryNames(zipPath: string): string[] {
  try {
    const buf = readFileSync(zipPath)
    const eocdOffset = findEocdOffset(buf)
    if (eocdOffset < 0) return []
    let offset = buf.readUInt32LE(eocdOffset + 16)
    const count = buf.readUInt16LE(eocdOffset + 10)
    const names: string[] = []
    for (let i = 0; i < count; i++) {
      if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== CEN_SIGNATURE) break
      const nameLen = buf.readUInt16LE(offset + 28)
      const extraLen = buf.readUInt16LE(offset + 30)
      const commentLen = buf.readUInt16LE(offset + 32)
      names.push(buf.toString('utf8', offset + 46, offset + 46 + nameLen))
      offset += 46 + nameLen + extraLen + commentLen
    }
    return names
  } catch (err) {
    console.error('[zipEntryNames] Failed to read zip:', zipPath, err)
    return []
  }
}

function findEocdOffset(buf: Buffer): number {
  const min = Math.max(0, buf.length - 0xffff - 22)
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) return i
  }
  return -1
}
