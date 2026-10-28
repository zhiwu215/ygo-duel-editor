import { existsSync } from 'fs'
import type { AppConfig, GamePathStatus } from '@shared/index'

export function checkGamePathStatus(config: AppConfig): GamePathStatus {
  return {
    gameDirectory: config.gameDirectory,
    directoryExists: config.gameDirectory ? existsSync(config.gameDirectory) : false,
    cdbExists: config.cdbPath ? existsSync(config.cdbPath) : false
  }
}
