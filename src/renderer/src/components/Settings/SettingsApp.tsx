import React, { useEffect, useState, JSX } from 'react'
import { X, Palette, FolderOpen, Plug, MessageSquareText, Folder, FolderKanban } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useConfigStore } from '../../stores/useConfigStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { AgentSettingsContent, AgentSettingsSection } from './AgentSettingsContent'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { cn } from '../../lib/utils'

/** 设置窗全部分区：常规 (外观 / 路径) + AI 顾问 (提供商 / 模型 / 对话) */
type SettingsSectionId = 'appearance' | 'paths' | AgentSettingsSection

interface SettingsNavItem {
  id: SettingsSectionId
  label: string
  icon: LucideIcon
  description: string
}

interface SettingsNavGroup {
  title: string
  items: SettingsNavItem[]
}

const NAV_GROUPS: SettingsNavGroup[] = [
  {
    title: '常规',
    items: [
      {
        id: 'appearance',
        label: '外观',
        icon: Palette,
        description: '切换浅色 / 深色主题外观'
      },
      {
        id: 'paths',
        label: '路径与目录',
        icon: FolderOpen,
        description: 'YGO 主程序目录与决斗档案保存位置'
      }
    ]
  },
  {
    title: 'AI 顾问 (背后灵)',
    items: [
      {
        id: 'model-settings',
        label: '模型设置',
        icon: Plug,
        description: '管理模型供应商、API Key 与模型列表'
      },
      {
        id: 'chat',
        label: '对话',
        icon: MessageSquareText,
        description: '创作者背景设定、推理开关与 token 上限'
      }
    ]
  }
]

const ALL_ITEMS: SettingsNavItem[] = NAV_GROUPS.flatMap((g) => g.items)

interface SettingsRowProps {
  title: string
  description?: string
  children?: React.ReactNode
}

/** 设置行：左侧标题与说明，右侧控件 (OpenCode 设置页的行式布局) */
function SettingsRow({ title, description, children }: SettingsRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4 border-b border-border/60 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 break-all">{description}</div>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

/** 外观分区：主题切换 */
function AppearanceSection(): JSX.Element {
  const { config, setTheme } = useConfigStore()
  return (
    <section className="rounded-xl border border-border bg-card/60">
      <SettingsRow title="主题" description="切换应用的浅色 / 深色外观">
        <Select
          value={config.theme || 'light'}
          onValueChange={(val) => {
            if (val === 'light' || val === 'dark') void setTheme(val)
          }}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">浅色模式</SelectItem>
            <SelectItem value="dark">深色模式</SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
    </section>
  )
}

/** 路径与目录分区：YGO 主程序目录 / 决斗档案目录 */
function PathsSection(): JSX.Element {
  const { config, selectYgoDir, selectProjectsDir } = useConfigStore()
  return (
    <section className="rounded-xl border border-border bg-card/60">
      <SettingsRow
        title="YGO 主程序目录"
        description={
          config.gameDirectory
            ? `${config.gameDirectory}${config.cdbPath ? ` (cards.cdb: ${config.cdbPath})` : ''}`
            : '未设置 (指定后自动定位 cards.cdb 与本地卡图)'
        }
      >
        <Button size="xs" variant="outline" onClick={() => void selectYgoDir()} className="gap-1">
          <Folder className="w-3.5 h-3.5" />
          <span>{config.gameDirectory ? '更换...' : '设置...'}</span>
        </Button>
      </SettingsRow>
      <SettingsRow
        title="决斗档案保存目录"
        description={config.projectsDirectory || '默认目录 (userData/projects)'}
      >
        <Button
          size="xs"
          variant="outline"
          onClick={() => void selectProjectsDir()}
          className="gap-1"
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>更换...</span>
        </Button>
      </SettingsRow>
    </section>
  )
}

/**
 * 全局设置独立窗口页面 (hash 路由 #settings，见 App.tsx)
 * 参照 VSCode / OpenCode：左侧分区导航 + 右侧内容，改动即时生效
 */
export function SettingsApp(): JSX.Element {
  const [section, setSection] = useState<SettingsSectionId>('appearance')
  const [ready, setReady] = useState(false)

  // 设置窗独立于主窗口启动，需自行等待双 store 配置加载完成再渲染内容
  useEffect(() => {
    void (async (): Promise<void> => {
      await useConfigStore.getState().loadConfig()
      await useAgentStore.getState().loadConfig()
      setReady(true)
    })()
  }, [])

  const current = ALL_ITEMS.find((i) => i.id === section) ?? ALL_ITEMS[0]

  return (
    <div className="relative h-screen w-screen flex bg-background text-foreground overflow-hidden select-none">
      {/* 顶部拖拽区：无边框窗口用于移动窗口；右侧留出关闭按钮的位置 (不重叠才能点击) */}
      <div className="absolute top-0 left-0 right-16 h-10 z-50 [-webkit-app-region:drag]" />
      {/* 右上角关闭按钮：设置子窗口唯一窗口控制 (无边框窗口，无最小化/最大化) */}
      <button
        type="button"
        onClick={() => window.close()}
        aria-label="关闭设置"
        title="关闭"
        className="absolute top-2 right-2 z-50 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* 左侧导航 */}
      <aside className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col p-3">
        <div className="text-sm font-bold px-2">偏好设置</div>
        <div className="mt-0.5 px-2 text-[10px] text-muted-foreground">
          自定义外观、路径与 AI 顾问行为
        </div>

        <nav className="mt-4 flex flex-col gap-3 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground/80">
                {group.title}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = section === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium text-left transition-colors',
                        active
                          ? 'bg-accent/70 text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* 右侧内容 */}
      <main className="flex-1 overflow-y-auto">
        <div
          className={cn(
            'mx-auto px-8 py-8',
            section === 'model-settings' ? 'max-w-4xl' : 'max-w-2xl'
          )}
        >
          <header className="mb-6">
            <h1 className="text-lg font-bold">{current.label}</h1>
            <p className="text-xs text-muted-foreground mt-1">{current.description}</p>
          </header>

          {!ready ? (
            <div className="text-xs text-muted-foreground">加载配置中...</div>
          ) : section === 'appearance' ? (
            <AppearanceSection />
          ) : section === 'paths' ? (
            <PathsSection />
          ) : (
            <AgentSettingsContent section={section} />
          )}
        </div>
      </main>
    </div>
  )
}
