import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createInitialDuelState,
  DuelSessionParseError,
  parseDuelDocumentJson,
  type DuelDocumentReadResult
} from '@shared/index'
import { DuelDocumentIndex } from '../../src/main/services/duelDocumentIndex'
import { readDuelDocumentForEditing } from '../../src/renderer/src/utils/readDuelDocumentForEditing'
import { useDialogStore } from '../../src/renderer/src/stores/useDialogStore'

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'duel-library-'))
  const index = new DuelDocumentIndex()
  let reads = 0
  const read = (filePath: string): DuelDocumentReadResult => {
    reads++
    try {
      return {
        success: true,
        filePath,
        document: parseDuelDocumentJson(readFileSync(filePath, 'utf8'))
      }
    } catch (error) {
      if (!(error instanceof DuelSessionParseError)) throw error
      return { success: false, filePath, recoveryState: error.state, error: error.message }
    }
  }
  try {
    const state = createInitialDuelState(5, 'full')
    const steps = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      description: '台词',
      turn: 1,
      phase: 'M1',
      actionType: 'EVENT',
      origin: 'manual'
    }))
    const valid = JSON.stringify({ state: { ...state, steps } })
    for (let i = 0; i < 100; i++) writeFileSync(join(root, i + '.ygoduel'), valid)
    const path = join(root, '0.ygoduel')
    const damaged = JSON.stringify({ state: { ...state, steps }, engine: { version: 999 } })
    writeFileSync(path, damaged)
    const cold = performance.now()
    assert.equal(index.scan(root, read).documents.length, 100)
    const warm = performance.now()
    assert.equal(reads, 100)
    const tree = index.scan(root, read)
    assert.equal(reads, 100)
    console.log(
      '100 × 1000 步台本扫描：首次 %d ms，再次 %d ms',
      Math.round(warm - cold),
      Math.round(performance.now() - warm)
    )
    writeFileSync(join(root, '1.ygoduel'), valid + ' ')
    rmSync(join(root, '2.ygoduel'))
    assert.equal(index.scan(root, read).documents.length, 99)
    assert.equal(reads, 101)
    let copies = 0
    Object.assign(globalThis, {
      window: {
        api: {
          readDuelDocument: read,
          getDuelDocumentTree: async () => ({ success: true, tree: { ...tree, rootPath: root } }),
          createDuelDocument: async (_folder: string, document: unknown) => {
            copies++
            const filePath = join(root, '0_恢复.ygoduel')
            writeFileSync(filePath, JSON.stringify(document), { flag: 'wx' })
            return { success: true, filePath }
          }
        }
      }
    })
    for (const accept of [false, true]) {
      const pending = readDuelDocumentForEditing(path)
      await Promise.resolve()
      const dialog = useDialogStore.getState().requests[0]
      assert.match(dialog.description!, /999/)
      useDialogStore.getState().settle(dialog.id, accept)
      const result = await pending
      assert.equal(result.success, accept)
      assert.equal(copies, Number(accept))
      if (accept) assert.equal(read(result.filePath!).document?.state.steps?.length, steps.length)
      assert.equal(readFileSync(path, 'utf8'), damaged)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
