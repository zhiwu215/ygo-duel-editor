import { existsSync } from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'
import {
  customCardToCdbCard,
  type CustomCard,
  type CustomScriptTestPlan,
  type CustomScriptTestReport
} from '@shared/index'
import { getCustomScriptDirectory } from './customCardScript'
import { configService } from './configService'
import { getGameScriptDirectories } from './gameScriptPaths'
import { engineCardDataFromCdbCard, readEngineCardData } from './duel/card-reader'
import {
  defaultCustomCardScriptTestPlan,
  normalizeCustomCardScriptTestPlan
} from './customCardScriptTestPlan'
import {
  runCustomCardScriptTestCore,
  type CustomCardScriptTestCoreInput
} from './customCardScriptTestCore'

const TEST_TIMEOUT_MS = 30_000

export interface RunCustomCardScriptTestInput {
  card: CustomCard
  script: string
  plan?: unknown
}

function scriptDirectories(): string[] {
  const cfg = configService.get()
  const dirs = new Set<string>([getCustomScriptDirectory(), ...getGameScriptDirectories()])
  for (const cdbPath of cfg.extraCdbPaths ?? []) {
    const dir = path.dirname(cdbPath)
    dirs.add(path.join(dir, 'script'))
    dirs.add(dir)
  }
  return [...dirs].filter((dir) => existsSync(dir))
}

function buildCoreInput(
  input: RunCustomCardScriptTestInput,
  plan: CustomScriptTestPlan
): CustomCardScriptTestCoreInput {
  const cardDataMap: CustomCardScriptTestCoreInput['cardDataMap'] = {}
  for (const card of plan.setup) {
    if (card.code === input.card.id || cardDataMap[card.code]) continue
    const data = readEngineCardData(card.code)
    if (data) cardDataMap[card.code] = data
  }
  return {
    card: input.card,
    cardData: engineCardDataFromCdbCard(customCardToCdbCard(input.card)),
    cardDataMap,
    script: input.script,
    scriptDirs: scriptDirectories(),
    plan
  }
}

async function runInWorker(input: CustomCardScriptTestCoreInput): Promise<CustomScriptTestReport> {
  const workerPath = path.join(__dirname, 'customCardScriptTestWorker.js')
  if (!existsSync(workerPath)) {
    return runCustomCardScriptTestCore(input)
  }
  return new Promise((resolve) => {
    const worker = new Worker(workerPath, { workerData: input })
    let settled = false
    const finish = (report: CustomScriptTestReport): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(report)
    }
    const timer = setTimeout(() => {
      finish({
        ok: false,
        summary: `测试超时（${TEST_TIMEOUT_MS / 1000} 秒），可能是脚本死循环。`,
        loadedScripts: [`c${input.card.id}.lua`],
        logs: [],
        errors: ['脚本执行超时'],
        steps: 0
      })
    }, TEST_TIMEOUT_MS)
    worker.once('message', (message: { report?: CustomScriptTestReport; error?: string }) => {
      if (message.report) {
        finish(message.report)
        return
      }
      finish({
        ok: false,
        summary: message.error ?? '测试 worker 执行失败。',
        loadedScripts: [`c${input.card.id}.lua`],
        logs: [],
        errors: [message.error ?? '未知错误'],
        steps: 0
      })
    })
    worker.once('error', (error) => {
      finish({
        ok: false,
        summary: error.message || '测试 worker 崩溃。',
        loadedScripts: [`c${input.card.id}.lua`],
        logs: [],
        errors: [error.message || '未知错误'],
        steps: 0
      })
    })
    worker.once('exit', (code) => {
      if (settled) return
      finish({
        ok: false,
        summary: `测试 worker 异常退出（code ${code}）。`,
        loadedScripts: [`c${input.card.id}.lua`],
        logs: [],
        errors: [`worker exit ${code}`],
        steps: 0
      })
    })
  })
}

export async function runCustomCardScriptTest(
  input: RunCustomCardScriptTestInput
): Promise<CustomScriptTestReport> {
  const plan = normalizeCustomCardScriptTestPlan(
    input.plan ?? defaultCustomCardScriptTestPlan(input.card.id),
    input.card.id
  )
  return runInWorker(buildCoreInput(input, plan))
}
