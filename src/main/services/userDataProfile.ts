import { app } from 'electron'
import { dirname, isAbsolute, join, resolve } from 'path'
import { mkdirSync, statSync } from 'fs'

export type ProfileMode = 'packaged' | 'dev' | 'custom' | 'portable'

const USER_DATA_ARG = '--user-data-dir='
const USER_DATA_ENV = 'YGO_DUEL_EDITOR_USER_DATA'
const DEV_SUFFIX = '-dev'
const PORTABLE_DIR_NAME = 'data'
const PORTABLE_USER_DATA_NAME = 'user-data'

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

function portableDataDirectory(): string | null {
  if (!app.isPackaged) return null
  const root = join(dirname(app.getPath('exe')), PORTABLE_DIR_NAME)
  try {
    return statSync(root).isDirectory() ? root : null
  } catch {
    return null
  }
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
const portableDir = explicitDir ? null : portableDataDirectory()

export const profileMode: ProfileMode = explicitDir
  ? 'custom'
  : portableDir
    ? 'portable'
    : app.isPackaged
      ? 'packaged'
      : 'dev'

if (explicitDir) {
  applyUserDataDir(explicitDir)
} else if (portableDir) {
  applyUserDataDir(join(portableDir, PORTABLE_USER_DATA_NAME))
} else if (profileMode === 'dev') {
  applyUserDataDir(`${app.getPath('userData')}${DEV_SUFFIX}`)
}

export const profileRoot = app.getPath('userData')

export const portableDataRoot = portableDir

export function isPortableProfile(): boolean {
  return profileMode === 'portable'
}

export function isIsolatedProfile(): boolean {
  return profileMode !== 'packaged'
}
