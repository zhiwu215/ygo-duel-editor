import fs from 'fs'
import path from 'path'
import { YGOProMessages } from 'ygopro-msg-encode'
import { createSessionState } from '../../src/main/services/duel/session-state'
import { parseYrpReplay, setupReplayDuel } from '../../src/main/services/duel/replay-session'
import { advanceEngine } from '../../src/main/services/duel/engine-pump'
import { cdbService } from './cdb-shim'
import { getOcgcoreEngine } from './ocgcore-engine-shim'

const hex = (b: Uint8Array): string => [...b].map((v) => v.toString(16).padStart(2, '0')).join('')

function frameSummary(frame: Uint8Array): string {
  const msgs = YGOProMessages.getInstancesFromPayload(frame)
  return `${frame.length}B [${hex(frame)}] types=[${msgs.map((m) => m.constructor.name).join(',')}]`
}

async function runReplay(
  engine: Awaited<ReturnType<typeof getOcgcoreEngine>>,
  bytes: Uint8Array,
  fileName: string,
  opts: { verbose: boolean; guardEnabled: boolean }
): Promise<void> {
  const { yrp } = parseYrpReplay(bytes, fileName)
  const rawFrames = yrp.responses
  const frames = rawFrames.filter((f) => f.length > 0)
  console.log(`\n=== ${fileName} (replaying 守卫=${opts.guardEnabled}) ===`)
  console.log(
    `yrp: 响应帧=${rawFrames.length} (过滤空帧后=${frames.length}) single=${yrp.isSingleMode}`
  )

  const state = createSessionState()
  state.ocgcore = engine
  setupReplayDuel(state, yrp, bytes, fileName)
  state.replaying = opts.guardEnabled

  const initialAuto = advanceEngine(state)
  console.log(
    `开局推进: autoResponses=${initialAuto.length} pending=${state.pendingQueries[0]?.request.kind ?? '无'}`
  )

  let retried = -1
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const head = state.pendingQueries[0]
    if (!head) {
      console.log(`[step ${i}] 引擎已结束，仅回放前 ${i} 步`)
      break
    }
    const req = head.request
    if (opts.verbose) {
      console.log(
        `[step ${i}] ask=${req.kind} player=${req.player} title="${req.title}" frame=${frameSummary(frame)}`
      )
    }
    state.duel!.setResponse(frame)
    advanceEngine(state)
    if (state.lastAdvanceRetried) {
      console.log(`[step ${i}] RETRY! 询问=${req.kind} 期望帧=${frameSummary(frame)}`)
      console.log(`  logs=${JSON.stringify(state.accumulatedLogs)}`)
      retried = i
      break
    }
  }
  if (retried < 0) {
    console.log(
      `结果: 完整回放 ${frames.length}/${frames.length} 步无 RETRY (replaying 守卫=${opts.guardEnabled})`
    )
  } else {
    console.log(`结果: 在第 ${retried + 1} 步发生 RETRY (replaying 守卫=${opts.guardEnabled})`)
  }
  state.replaying = false
}

async function main(): Promise<void> {
  await cdbService.ready()
  const engine = await getOcgcoreEngine()

  const files = process.argv.slice(2)
  const targets =
    files.length > 0
      ? files
      : [
          path.join('node_modules', 'ygopro-yrp-encode', 'ygopro-yrp-test-remake.yrp'),
          path.join('node_modules', 'ygopro-yrp-encode', 'ygopro-yrp-test-remake2.yrp'),
          path.join('scripts', 'smoke', 'out', 'yrp-export-smoke.yrp')
        ]
  for (const file of targets) {
    const bytes = new Uint8Array(fs.readFileSync(file))
    await runReplay(engine, bytes, path.basename(file), { verbose: true, guardEnabled: true })
    await runReplay(engine, bytes, path.basename(file), { verbose: false, guardEnabled: false })
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('[replay-import-smoke] FAILED:', err)
  process.exit(1)
})
