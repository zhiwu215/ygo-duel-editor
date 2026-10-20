import { ScrollArea } from '../ui/scroll-area'
import { useEffect, useState, type JSX } from 'react'
import { Palette, FolderOpen, Plug, MessageSquareText, Swords } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useConfigStore } from '../../stores/useConfigStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { WindowControls } from '../ui/window-controls'
import { AgentSettingsContent } from './AgentSettingsContent'
import { SettingsSectionId } from '@shared/index'
import { AppearanceSection } from './components/AppearanceSection'
import { DataDirectorySection } from './components/DataDirectorySection'
import { PathsSection } from './components/PathsSection'
import { DuelTestSection } from './components/DuelTestSection'
import { ExtraCdbSection } from './components/ExtraCdbSection'
import { GameLanguageDialog } from './components/GameLanguageDialog'
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
        description: 'YGO 主程序目录与卡库加载'
      },
      {
        id: 'duel-test',
        label: '对局测试',
        icon: Swords,
        description: 'ygo 菜单「使用游戏测试该局」的启动配置'
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

export function SettingsApp(): JSX.Element {
  const [section, setSection] = useState<SettingsSectionId>(() => {
    const requested = window.location.hash.split('/')[1]
    return isSettingsSectionId(requested) ? requested : 'appearance'
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    return window.api.onSettingsNavigate((next) => setSection(next))
  }, [])

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
      <div className="absolute top-0 left-0 right-16 h-10 z-50 [-webkit-app-region:drag]" />
      <WindowControls actions={['close']} className="absolute top-0.5 right-0 z-50" />

      <aside className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col p-3">
        <div className="text-sm font-bold px-2">偏好设置</div>
        <div className="mt-0.5 px-2 text-[10px] text-muted-foreground">
          自定义外观、路径、对局测试与背后灵行为
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
          ) : section === 'duel-test' ? (
            <DuelTestSection />
          ) : (
            <AgentSettingsContent section={section} />
          )}
        </div>
      </ScrollArea>

      <GameLanguageDialog />
    </div>
  )
}
