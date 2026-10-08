import { openSync, readSync, closeSync, statSync, existsSync } from 'fs'
import { inflateRawSync } from 'zlib'

interface ZipEntry {
  method: number
  compressedSize: number
  localHeaderOffset: number
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50

export class ZipFileReader {
  private readonly entries: Map<string, ZipEntry>

  private constructor(
    private readonly handle: number,
    entries: Map<string, ZipEntry>
  ) {
    this.entries = entries
  }

  public static open(filePath: string): ZipFileReader | null {
    if (!existsSync(filePath)) return null
    let size: number
    try {
      size = statSync(filePath).size
    } catch {
      return null
    }
    if (size < 22) return null
    const handle = openSync(filePath, 'r')
    try {
      const tail = Buffer.alloc(Math.min(size, 66000))
      readSync(handle, tail, 0, tail.length, size - tail.length)
      let eocdOffset = -1
      for (let i = tail.length - 22; i >= 0; i--) {
        if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
          eocdOffset = i
          break
        }
      }
      if (eocdOffset < 0) return null
      const dirOffsetInTail = eocdOffset + 16
      const dirSize = tail.readUInt32LE(eocdOffset + 12)
      const dirStart = tail.readUInt32LE(dirOffsetInTail)
      if (dirStart === 0xffffffff || dirSize === 0xffffffff) return null
      const central = Buffer.alloc(dirSize)
      let read = 0
      while (read < dirSize) {
        const n = readSync(handle, central, read, dirSize - read, dirStart + read)
        if (n <= 0) break
        read += n
      }
      const entries = new Map<string, ZipEntry>()
      let pos = 0
      while (pos + 46 <= central.length && central.readUInt32LE(pos) === CENTRAL_SIGNATURE) {
        const method = central.readUInt16LE(pos + 10)
        const compressedSize = central.readUInt32LE(pos + 20)
        const nameLength = central.readUInt16LE(pos + 28)
        const extraLength = central.readUInt16LE(pos + 30)
        const commentLength = central.readUInt16LE(pos + 32)
        const localHeaderOffset = central.readUInt32LE(pos + 42)
        const name = central.toString('utf-8', pos + 46, pos + 46 + nameLength)
        if (method === 0 || method === 8) {
          const normalized = name.replace(/\\/g, '/')
          if (!normalized.endsWith('/'))
            entries.set(normalized, { method, compressedSize, localHeaderOffset })
        }
        pos += 46 + nameLength + extraLength + commentLength
      }
      return new ZipFileReader(handle, entries)
    } catch {
      closeSync(handle)
      return null
    }
  }

  public has(name: string): boolean {
    return this.entries.has(name) || this.entries.has(`script/${name}`)
  }

  public read(name: string): Buffer | null {
    const entry = this.entries.get(name) ?? this.entries.get(`script/${name}`)
    if (!entry) return null
    const header = Buffer.alloc(30)
    readSync(this.handle, header, 0, 30, entry.localHeaderOffset)
    if (header.readUInt32LE(0) !== LOCAL_SIGNATURE) return null
    const nameLength = header.readUInt16LE(26)
    const extraLength = header.readUInt16LE(28)
    const dataOffset = entry.localHeaderOffset + 30 + nameLength + extraLength
    if (entry.method === 0) {
      const raw = Buffer.alloc(entry.compressedSize)
      readSync(this.handle, raw, 0, entry.compressedSize, dataOffset)
      return raw
    }
    const compressed = Buffer.alloc(entry.compressedSize)
    readSync(this.handle, compressed, 0, entry.compressedSize, dataOffset)
    try {
      return inflateRawSync(compressed)
    } catch {
      return null
    }
  }

  public close(): void {
    try {
      closeSync(this.handle)
    } catch {
      void 0
    }
  }
  public get entryCount(): number {
    return this.entries.size
  }
}
