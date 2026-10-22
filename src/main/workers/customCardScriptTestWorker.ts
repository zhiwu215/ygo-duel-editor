import { parentPort, workerData } from 'worker_threads'
import type { CustomScriptTestReport } from '@shared/index'
import {
  runCustomCardScriptTestCore,
  type CustomCardScriptTestCoreInput
} from '../services/customCardScriptTestCore'

const input = workerData as CustomCardScriptTestCoreInput

runCustomCardScriptTestCore(input)
  .then((report: CustomScriptTestReport) => {
    parentPort?.postMessage({ report })
  })
  .catch((err: unknown) => {
    parentPort?.postMessage({
      error: err instanceof Error ? err.message : String(err)
    })
  })
