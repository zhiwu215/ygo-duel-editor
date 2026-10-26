import { app } from 'electron'
import { isAbsolute, resolve } from 'path'
import { mkdirSync } from 'fs'

export type ProfileMode = 'packaged' | 'dev' | 'custom'

const USER_DATA_ARG = '--user-data-dir='
const USER_DATA_ENV = 'YGO_DUEL_EDITOR_USER_DATA'
const DEV_SUFFIX = '-dev'

function explicitUserDataDir(): string | null {
  const fromArg = process.argv
    .find((value) => value.startsWith(USER_DATA_ARG))
    ?.slice(USER_DATA_ARG.length)
    .trim()
  const fromEnv = (process.env[USER_DATA_ENV] ?? '').trim()
  const raw = fromArg || fromEnv
  if (!raw) return null
  return isAbsolute(raw) ? resolve(raw) : resolve(process.cwd(), raw)
}

function applyUserDataDir(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true })
  } catch (err) {
    console.error('[profile] create user data directory failed:', dir, err)
  }
  app.setPath('userData', dir)
  app.setPath('sessionData', dir)
}

const explicitDir = explicitUserDataDir()

export const profileMode: ProfileMode = explicitDir ? 'custom' : app.isPackaged ? 'packaged' : 'dev'

if (explicitDir) {
  applyUserDataDir(explicitDir)
} else if (profileMode === 'dev') {
  applyUserDataDir(`${app.getPath('userData')}${DEV_SUFFIX}`)
}

export const profileRoot = app.getPath('userData')

export function isIsolatedProfile(): boolean {
  return profileMode !== 'packaged'
}
