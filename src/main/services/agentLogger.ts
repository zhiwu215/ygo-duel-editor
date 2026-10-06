import { app } from 'electron'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, appendFileSync, statSync, renameSync, rmSync } from 'fs'
import { join } from 'path'

export type AgentLogLevel = 'INFO' | 'WARN' | 'ERROR'

const MAX_LOG_BYTES = 2 * 1024 * 1024
const ASCII_MAX = 127

function readConsoleCodePage(): number {
  try {
    const out = execSync('chcp', {
      shell: 'cmd.exe',
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const m = out.match(/(\d{3,5})/)
    return m ? Number(m[1]) : 0
  } catch {
    return 0
  }
}

function ensureUtf8Console(): boolean {
  if (process.platform !== 'win32') return true
  if (readConsoleCodePage() === 65001) return true
  try {
    execSync('chcp 65001', { stdio: 'ignore' })
  } catch {
    return false
  }
  return readConsoleCodePage() === 65001
}

const escapeNonAscii = process.env.AGENT_LOG_ESCAPE === '1' || !ensureUtf8Console()

function asciiEscape(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    out += cp > ASCII_MAX ? '\\u' + cp.toString(16).padStart(4, '0') : ch
  }
  return out
}

function flattenValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' | ')
}

function formatExtra(extra?: Record<string, unknown>): string {
  if (!extra) return ''
  const compact: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) continue
    const text = typeof v === 'string' ? v : JSON.stringify(v)
    compact[k] =
      typeof text === 'string' && text.length > 300
        ? `${flattenValue(text.slice(0, 300))}...`
        : flattenValue(text)
  }
  const entries = Object.entries(compact)
  return entries.length > 0 ? ` | ${entries.map(([k, v]) => `${k}=${v}`).join(' ')}` : ''
}

export class AgentLogger {
  private logDirEnsured = false
  private bannerWritten = false

  private takeBanner(): string {
    if (this.bannerWritten) return ''
    this.bannerWritten = true
    const where = 'userData/logs/agent.log'
    return escapeNonAscii
      ? `[agent] log: console code page is not UTF-8, non-ASCII escaped as \\uXXXX; full text in ${where}\n`
      : ''
  }

  private write(line: string): void {
    const stamp = new Date().toISOString()
    const full = `${flattenValue(line)}\n`
    const banner = this.takeBanner()
    try {
      process.stdout.write(`${banner}[agent ${stamp}] ${escapeNonAscii ? asciiEscape(full) : full}`)
    } catch {
      void 0
    }
    try {
      this.appendToDisk(`${banner}[agent ${stamp}] ${full}`)
    } catch {
      void 0
    }
  }

  private ensureDir(): string {
    const dir = join(app.getPath('userData'), 'logs')
    if (!this.logDirEnsured) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      this.logDirEnsured = true
    }
    return dir
  }

  private rotateIfNeeded(filePath: string): void {
    try {
      if (existsSync(filePath) && statSync(filePath).size > MAX_LOG_BYTES) {
        const rotated = `${filePath}.old`
        if (existsSync(rotated)) rmSync(rotated)
        renameSync(filePath, rotated)
      }
    } catch {
      void 0
    }
  }

  private appendToDisk(full: string): void {
    const dir = this.ensureDir()
    const filePath = join(dir, 'agent.log')
    this.rotateIfNeeded(filePath)
    appendFileSync(filePath, full)
  }

  public info(scope: string, message: string, extra?: Record<string, unknown>): void {
    this.write(`${scope} INFO ${message}${formatExtra(extra)}`)
  }

  public warn(scope: string, message: string, extra?: Record<string, unknown>): void {
    this.write(`${scope} WARN ${message}${formatExtra(extra)}`)
  }

  public error(scope: string, message: string, extra?: Record<string, unknown>): void {
    this.write(`${scope} ERROR ${message}${formatExtra(extra)}`)
  }
}

export const agentLogger = new AgentLogger()
