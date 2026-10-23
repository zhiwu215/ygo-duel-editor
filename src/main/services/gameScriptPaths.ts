import { join } from 'path'
import { configService } from './configService'

export function getGameScriptDirectories(): string[] {
  const { gameDirectory, gameType } = configService.get()
  if (!gameDirectory) return []
  const root = join(gameDirectory, 'script')
  if (gameType === 'mdpro3') return [root]
  return [root, join(gameDirectory, 'expansions', 'script')]
}
