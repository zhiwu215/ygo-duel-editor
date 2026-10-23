import { EngineSupportInfo } from '@shared/index'
import { configService } from '../configService'
import { isKcgGameDirectory } from '../gameContent'

export function getDuelEngineSupport(): EngineSupportInfo {
  const { gameDirectory } = configService.get()
  if (isKcgGameDirectory(gameDirectory)) {
    return {
      supported: false,
      reason:
        'EDOPro-KCG 使用修改版 ocgcore，内置引擎是标准 ocgcore，无法可靠校验其扩展卡与脚本。请改用「ygo → 使用游戏测试该局」。'
    }
  }
  return { supported: true }
}
