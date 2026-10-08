import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { ScrollArea } from '../ui/scroll-area'
import React, { useEffect, useState, JSX } from 'react'
import {
  X,
  Palette,
  FolderOpen,
  Plug,
  MessageSquareText,
  Folder,
  FolderKanban,
  FolderPlus,
  Loader2,
  Eye,
  EyeOff,
  Swords
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useConfigStore } from '../../stores/useConfigStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { AgentSettingsContent } from './AgentSettingsContent'
import { SettingsSectionId } from '@shared/index'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Switch } from '../ui/switch'
import { cn } from '../../lib/utils'

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
      },
      {
        id: 'duel',
        label: '对局',
        icon: Swords,
        description: '规则校验 (ocgcore 引擎过滤操作)'
      }
    ]
  },
  {
    title: '背后灵',
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

const isSettingsSectionId = (value: string | undefined): value is SettingsSectionId =>
  value !== undefined && ALL_ITEMS.some((item) => item.id === value)

/** 主题展示名：base-ui 的 Select.Value 默认渲染原始 value，必须显式给文案，否则会显示 light / dark */
const THEME_LABELS: Record<string, string> = {
  light: '浅色模式',
  dark: '深色模式'
}

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
          {/* 与同行的 outline 按钮对齐：默认触发器用 border-input + 透明底，深色下描边会比按钮亮一档 */}
          <SelectTrigger
            size="xs"
            className="w-28 border-border bg-background dark:bg-background dark:hover:bg-background"
          >
            <SelectValue>{(value) => THEME_LABELS[value as string] ?? '浅色模式'}</SelectValue>
          </SelectTrigger>
          {/* 弹层默认锁成触发器宽度、且自身没有内边距，基础类的 min-w-36 还会比触发器的 w-28 更宽；
              这里改成按内容收缩 + 4px 内边距，选项才不会贴着弹层圆角 */}
          <SelectContent align="start" className="w-auto min-w-28 p-1">
            <SelectItem value="light" className="text-xs py-1.5 pr-7 pl-2">
              浅色模式
            </SelectItem>
            <SelectItem value="dark" className="text-xs py-1.5 pr-7 pl-2">
              深色模式
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
    </section>
  )
}

function DataDirectorySection(): JSX.Element {
  const { config, selectDataDir, resetDataDir, openDataDir } = useConfigStore()
  const [migrate, setMigrate] = useState(true)
  const [busy, setBusy] = useState(false)
  const current = config.dataDirectory

  const handleSelect = async (): Promise<void> => {
    setBusy(true)
    try {
      await selectDataDir(migrate)
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (): Promise<void> => {
    setBusy(true)
    try {
      await resetDataDir(migrate)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/60">
      <SettingsRow
        title="数据保存目录"
        description={
          current
            ? current
            : `默认目录 (${'userData'})：卡组库、卡牌图鉴、自建卡、决斗档案、文本素材都存这里`
        }
      >
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={() => void openDataDir()}
            className="gap-1"
            title="在文件管理器中打开当前数据目录"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>打开</span>
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => void handleSelect()}
            aria-busy={busy}
            className="gap-1"
          >
            <Folder className="w-3.5 h-3.5" />
            <span>更换...</span>
            <Loader2 className={cn('w-3 h-3', busy ? 'animate-spin opacity-100' : 'opacity-0')} />
          </Button>
          {current && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => void handleReset()}
              aria-busy={busy}
              className="text-xs text-muted-foreground"
            >
              <span>恢复默认</span>
            </Button>
          )}
        </div>
      </SettingsRow>
      <div className="px-5 py-3 border-t border-border/60 flex items-start gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={migrate}
          onClick={() => setMigrate((v) => !v)}
          className={cn(
            'mt-0.5 h-4 w-7 shrink-0 rounded-full transition-colors',
            migrate ? 'bg-primary' : 'bg-neutral-400/40'
          )}
        >
          <span
            className={cn(
              'block h-3 w-3 rounded-full bg-white transition-transform',
              migrate ? 'translate-x-3.5' : 'translate-x-0.5'
            )}
          />
        </button>
        <div className="text-xs text-muted-foreground leading-relaxed">
          <div className="font-medium text-foreground">切换时迁移现有数据</div>
          <div>
            把当前目录里的卡组库、卡牌图鉴、自建卡、决斗档案、文本素材复制到新目录（原文件保留）。
            关闭则在新目录重新开始，之后切回原目录仍能看到旧数据。
          </div>
        </div>
      </div>
    </section>
  )
}

/** 路径与目录分区：数据目录 / YGO 主程序目录 / 决斗档案目录 */
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

function DuelSection(): JSX.Element {
  const { config, setRuleCheckEnabled } = useConfigStore()
  const enabled = config.ruleCheckEnabled !== false
  return (
    <section className="rounded-xl border border-border bg-card/60">
      <SettingsRow
        title="规则校验 (ygopro 式操作过滤)"
        description={
          '开启后点击卡片只显示 ocgcore 引擎判定合法的召唤 / 特殊召唤 / 盖放 / 发动 / 攻击 / 表示形式变更。' +
          '使用无脚本的自建卡或与引擎不兼容的局面时建议临时关闭，回到自由编辑'
        }
      >
        <Switch checked={enabled} onCheckedChange={(next) => void setRuleCheckEnabled(next)} />
      </SettingsRow>
    </section>
  )
}

/** 附加卡库分区：可加载动漫卡等扩展 cdb，与主库合并搜索 */
function ExtraCdbSection(): JSX.Element {
  const { config, addExtraCdb, removeExtraCdb, setExtraCdbEnabled } = useConfigStore()
  const paths = config.extraCdbPaths || []
  const disabled = config.disabledCdbPaths || []
  const [busy, setBusy] = useState(false)

  const handleAdd = async (): Promise<void> => {
    setBusy(true)
    try {
      await addExtraCdb()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/60">
      <div className="flex items-center justify-between gap-6 px-5 py-4 border-b border-border/60">
        <div className="min-w-0">
          <div className="text-sm font-semibold">附加卡库</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            扩展卡库 (.cdb)，加载后与主库合并搜索。语言包（仅提供卡名与效果文的库）会自动识别，
            卡片数据仍取数据库
          </div>
        </div>
        <Button
          size="xs"
          variant="outline"
          onClick={() => void handleAdd()}
          disabled={busy}
          className="gap-1 shrink-0"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FolderPlus className="w-3.5 h-3.5" />
          )}
          <span>添加...</span>
        </Button>
      </div>

      {paths.length === 0 ? (
        <div className="px-5 py-4 text-xs text-muted-foreground">未添加附加卡库</div>
      ) : (
        paths.map((path) => {
          const enabled = !disabled.includes(path)
          return (
            <div key={path} className="px-5 py-3 border-b border-border/60 last:border-b-0">
              <div className="flex items-center justify-between gap-6">
                <div
                  className={cn(
                    'min-w-0 text-xs break-all',
                    enabled ? 'text-foreground/80' : 'text-muted-foreground/60'
                  )}
                >
                  {path}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="xs"
                    variant={enabled ? 'outline' : 'ghost'}
                    onClick={() => void setExtraCdbEnabled(path, !enabled)}
                    className="gap-1"
                  >
                    {enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{enabled ? '已启用' : '已停用'}</span>
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => void removeExtraCdb(path)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    移除
                  </Button>
                </div>
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}

/**
 * 全局设置独立窗口页面 (hash 路由 #settings，见 App.tsx)
 * 参照 VSCode / OpenCode：左侧分区导航 + 右侧内容，改动即时生效
 */
export function SettingsApp(): JSX.Element {
  const [section, setSection] = useState<SettingsSectionId>(() => {
    const requested = window.location.hash.split('/')[1]
    return isSettingsSectionId(requested) ? requested : 'appearance'
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    return window.api.onSettingsNavigate((next) => setSection(next))
  }, [])

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
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => window.close()}
              aria-label="关闭设置"
              className="absolute top-2 right-2 z-50 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          }
        />
        <TooltipContent>关闭</TooltipContent>
      </Tooltip>

      {/* 左侧导航 */}
      <aside className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col p-3">
        <div className="text-sm font-bold px-2">偏好设置</div>
        <div className="mt-0.5 px-2 text-[10px] text-muted-foreground">
          自定义外观、路径与背后灵行为
        </div>

        <ScrollArea className="mt-4 flex-1 min-h-0">
          <div className="flex flex-col gap-3">
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
          </div>
        </ScrollArea>
      </aside>

      {/* 右侧内容 */}
      <ScrollArea className="flex-1 min-h-0">
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
            <div className="flex flex-col gap-4">
              <DataDirectorySection />
              <PathsSection />
              <ExtraCdbSection />
            </div>
          ) : section === 'duel' ? (
            <DuelSection />
          ) : (
            <AgentSettingsContent section={section} />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
