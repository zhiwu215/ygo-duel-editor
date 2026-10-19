import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { DuelProjectMeta } from '@shared/index'
import { useDuelStore } from '../stores/useDuelStore'
import { useConfigStore } from '../stores/useConfigStore'
import { confirmDialog, alertDialog } from '../stores/useDialogStore'
import { useFlashMessage } from './useFlashMessage'
import type { SeriesGroup } from '../utils/archiveGrouping'

interface UseDuelArchives {
  projects: DuelProjectMeta[]
  lastLoadedPath: string | null
  feedback: string | null
  refresh: () => Promise<void>
  loadProject: (item: DuelProjectMeta) => Promise<void>
  duplicateProject: (e: ReactMouseEvent, item: DuelProjectMeta) => Promise<void>
  revealProject: (e: ReactMouseEvent, item: DuelProjectMeta) => Promise<void>
  deleteProject: (e: ReactMouseEvent, item: DuelProjectMeta) => Promise<void>
  createSeries: (name: string) => Promise<string | null>
  renameSeries: (oldName: string, name: string) => Promise<string | null>
  deleteSeries: (group: SeriesGroup) => Promise<void>
  pickSeries: (filePath: string, series: string | null) => Promise<void>
}

export function useDuelArchives(): UseDuelArchives {
  const [projects, setProjects] = useState<DuelProjectMeta[]>([])
  const [lastLoadedPath, setLastLoadedPath] = useState<string | null>(null)
  const [feedback, flash] = useFlashMessage(3000)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setProjects(await window.api.getProjectList())
    } catch (err) {
      console.error('[DuelArchives] Fetch projects failed:', err)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await refresh()
    })()
  }, [refresh])

  const loadProject = useCallback(
    async (item: DuelProjectMeta): Promise<void> => {
      try {
        const res = await window.api.loadProjectByPath(item.filePath)
        if (res.success && res.state) {
          const duel = useDuelStore.getState()
          duel.loadProjectAndStart(res.state)
          duel.setCurrentProjectPath(item.filePath)
          setLastLoadedPath(item.filePath)
          flash(`已载入《${item.title}》，已就绪于第 1 回合`)
        } else if (res.error) {
          void alertDialog(`载入失败: ${res.error}`)
        }
      } catch (err) {
        console.error('[DuelArchives] Load project failed:', err)
        void alertDialog('载入工程档案失败')
      }
    },
    [flash]
  )

  const duplicateProject = useCallback(
    async (e: ReactMouseEvent, item: DuelProjectMeta): Promise<void> => {
      e.stopPropagation()
      const res = await window.api.duplicateProjectFile(item.filePath)
      if (res.success) {
        void refresh()
      } else if (res.error) {
        void alertDialog(`创建副本失败: ${res.error}`)
      }
    },
    [refresh]
  )

  const revealProject = useCallback(
    async (e: ReactMouseEvent, item: DuelProjectMeta): Promise<void> => {
      e.stopPropagation()
      await window.api.revealFileInFolder(item.filePath)
    },
    []
  )

  const deleteProject = useCallback(
    async (e: ReactMouseEvent, item: DuelProjectMeta): Promise<void> => {
      e.stopPropagation()
      const ok = await confirmDialog({
        title: `删除对局档案《${item.title}》`,
        description: '此操作将从磁盘彻底移除该文件。',
        confirmText: '删除'
      })
      if (ok) {
        const res = await window.api.deleteProjectFile(item.filePath)
        if (res.success) {
          if (lastLoadedPath === item.filePath) {
            setLastLoadedPath(null)
          }
          void refresh()
        } else if (res.error) {
          void alertDialog(`删除失败: ${res.error}`)
        }
      }
    },
    [lastLoadedPath, refresh]
  )

  const createSeries = useCallback(
    async (name: string): Promise<string | null> => {
      const res = await window.api.createProjectSeries(name)
      if (!res.success) return res.error || '新建分类失败'
      await useConfigStore.getState().loadConfig()
      flash(`已新建作品分类「${name.trim()}」`)
      return null
    },
    [flash]
  )

  const renameSeries = useCallback(
    async (oldName: string, name: string): Promise<string | null> => {
      const res = await window.api.renameProjectSeries(oldName, name)
      if (!res.success) return res.error || '重命名失败'
      await useConfigStore.getState().loadConfig()
      await refresh()
      flash(`已重命名为「${name.trim()}」`)
      return null
    },
    [flash, refresh]
  )

  const deleteSeries = useCallback(
    async (group: SeriesGroup): Promise<void> => {
      const ok = await confirmDialog({
        title: `删除分类「${group.label}」`,
        description:
          group.items.length > 0
            ? `该分类下的 ${group.items.length} 场对局会退回「未归类」，文件不会被删除。`
            : '该分类下没有对局，可以安全删除。',
        confirmText: '删除'
      })
      if (!ok) return
      const res = await window.api.deleteProjectSeries(group.key)
      if (!res.success) {
        void alertDialog(`删除分类失败: ${res.error || '未知错误'}`)
        return
      }
      await useConfigStore.getState().loadConfig()
      await refresh()
      flash(`已删除分类「${group.label}」`)
    },
    [flash, refresh]
  )

  const pickSeries = useCallback(
    async (filePath: string, series: string | null): Promise<void> => {
      const res = await window.api.setProjectSeries(filePath, series)
      if (!res.success) {
        void alertDialog(`归类失败: ${res.error || '未知错误'}`)
        return
      }
      await useConfigStore.getState().loadConfig()
      await refresh()
      flash(series ? `已归入「${series}」` : '已移出分类')
    },
    [flash, refresh]
  )

  return {
    projects,
    lastLoadedPath,
    feedback,
    refresh,
    loadProject,
    duplicateProject,
    revealProject,
    deleteProject,
    createSeries,
    renameSeries,
    deleteSeries,
    pickSeries
  }
}
