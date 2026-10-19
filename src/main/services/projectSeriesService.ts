import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DuelPuzzleState } from '@shared/index'
import { configService } from './configService'
import { projectFileService } from './projectFileService'

export class ProjectSeriesService {
  private listProjectFilePaths(): string[] {
    const paths: string[] = []
    const dir = projectFileService.getProjectsDirectory()
    try {
      if (existsSync(dir)) {
        for (const file of readdirSync(dir)) {
          if (file.endsWith('.ygoduel') || file.endsWith('.json')) {
            paths.push(join(dir, file))
          }
        }
      }
    } catch (err) {
      console.error('[FileService] Error listing projects directory:', err)
    }

    for (const p of configService.get().recentProjectPaths || []) {
      if (!paths.includes(p)) paths.push(p)
    }
    return paths
  }

  private readSeriesList(): string[] {
    const list = configService.get().projectSeries
    return Array.isArray(list) ? [...list] : []
  }

  private writeSeriesList(list: string[]): void {
    configService.save({ projectSeries: list })
  }

  private rewriteSeries(filePath: string, transform: (current: string) => string | null): boolean {
    try {
      if (!existsSync(filePath)) return false
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as DuelPuzzleState
      if (!data || typeof data !== 'object') return false

      const current = typeof data.series === 'string' ? data.series : ''
      const next = transform(current)
      if (next === null || next === current) return true

      if (next) data.series = next
      else delete data.series

      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.warn('[FileService] Failed to rewrite series:', filePath, err)
      return false
    }
  }

  public createProjectSeries(name: string): { success: boolean; error?: string } {
    const trimmed = name.trim()
    if (!trimmed) return { success: false, error: '分类名不能为空' }
    const list = this.readSeriesList()
    if (list.includes(trimmed)) return { success: false, error: '已存在同名分类' }
    this.writeSeriesList([...list, trimmed])
    return { success: true }
  }

  public renameProjectSeries(
    oldName: string,
    newName: string
  ): { success: boolean; error?: string } {
    const from = oldName.trim()
    const to = newName.trim()
    if (!from) return { success: false, error: '原分类名为空' }
    if (!to) return { success: false, error: '分类名不能为空' }

    const list = this.readSeriesList()
    if (to !== from && list.includes(to)) return { success: false, error: '已存在同名分类' }

    for (const filePath of this.listProjectFilePaths()) {
      this.rewriteSeries(filePath, (current) => (current === from ? to : null))
    }

    const nextList = list.map((n) => (n === from ? to : n))
    if (!nextList.includes(to)) nextList.push(to)
    this.writeSeriesList(nextList)
    return { success: true }
  }

  public deleteProjectSeries(name: string): { success: boolean; error?: string } {
    const target = name.trim()
    if (!target) return { success: false, error: '分类名为空' }

    for (const filePath of this.listProjectFilePaths()) {
      this.rewriteSeries(filePath, (current) => (current === target ? '' : null))
    }
    this.writeSeriesList(this.readSeriesList().filter((n) => n !== target))
    return { success: true }
  }

  public setProjectSeries(
    filePath: string,
    series: string | null
  ): { success: boolean; error?: string } {
    if (!existsSync(filePath)) return { success: false, error: '文件不存在或已被移除' }
    const next = (series || '').trim()

    if (!this.rewriteSeries(filePath, () => next)) {
      return { success: false, error: '写入工程文件失败' }
    }

    if (next) {
      const list = this.readSeriesList()
      if (!list.includes(next)) this.writeSeriesList([...list, next])
    }
    return { success: true }
  }
}

export const projectSeriesService = new ProjectSeriesService()
