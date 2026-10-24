import { ScrollArea } from '../ui/scroll-area'
import { useEffect, useState, type JSX } from 'react'
import { FolderOpen, Globe, Plug, SlidersHorizontal, Swords } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useConfigStore } from '../../stores/useConfigStore'
import { useAgentStore } from '../../stores/useAgentStore'
import { WindowControls } from '../ui/window-controls'
import { SettingsSectionId } from '@shared/index'
import { GeneralSettingsSection } from './components/GeneralSettingsSection'
import { DataDirectorySection } from './components/DataDirectorySection'
import { PathsSection } from './components/PathsSection'
import { DuelTestSection } from './components/DuelTestSection'
import { ExtraCdbSection } from './components/ExtraCdbSection'
import { GameLanguageDialog } from './components/GameLanguageDialog'
import { ModelSettingsSection } from './ModelSettingsSection'
import { WebSearchSection } from './WebSearchSection'
import { cn } from '../../lib/utils'

interface SettingsNavItem {
  id: SettingsSectionId
  label: string
  icon: LucideIcon
  description: string
}

const NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'general',
    label: '通用设置',
    icon: SlidersHorizontal,
    description: '自定义主题、字号与内容显示'
  },
  {
    id: 'model-settings',
    label: '模型',
    icon: Plug,
    description: '填入各提供商的 API 密钥即可使用其模型'
  },
  {
    id: 'web-search',
    label: '网页搜索',
    icon: Globe,
    description: '让背后灵搜索互联网并读取网页正文'
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

const isSettingsSectionId = (value: string | undefined): value is SettingsSectionId =>
  value !== undefined && NAV_ITEMS.some((item) => item.id === value)

export function SettingsApp(): JSX.Element {
  const [section, setSection] = useState<SettingsSectionId>(() => {
    const requested = window.location.hash.split('/')[1]
    return isSettingsSectionId(requested) ? requested : 'general'
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

  const current = NAV_ITEMS.find((i) => i.id === section) ?? NAV_ITEMS[0]

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-white text-foreground select-none dark:bg-[#151517]">
      <div className="absolute top-0 left-0 right-16 h-10 z-50 [-webkit-app-region:drag]" />
      <WindowControls actions={['close']} className="absolute top-0.5 right-0 z-50" />

      <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-[#f9fafb] p-3 dark:bg-[#1b1b1c]">
        <div className="px-2 text-sm font-bold">设置</div>

        <ScrollArea className="mt-4 flex-1 min-h-0">
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium leading-5 transition-colors',
                    active
                      ? 'bg-[#ebedf2] text-[#0f1115] dark:bg-[#43454a] dark:text-[#f9fafb]'
                      : 'text-[#61666b] hover:bg-[#f1f3f5] hover:text-[#0f1115] dark:text-[#cfd3d6] dark:hover:bg-[#2c2c2e] dark:hover:text-[#f9fafb]'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </aside>

      <div className="min-h-0 flex-1 px-1 pt-10 pb-1">
        <ScrollArea key={section} className="size-full">
          <div
            className={cn(
              'px-8 pt-3 pb-14',
              section === 'model-settings'
                ? 'max-w-[720px]'
                : section === 'general'
                  ? 'max-w-3xl'
                  : 'max-w-2xl'
            )}
          >
            <header className={cn(section === 'model-settings' ? 'mb-3' : 'mb-6')}>
              <h1
                className={cn(
                  section === 'model-settings'
                    ? 'text-base font-medium leading-6'
                    : 'text-2xl font-semibold'
                )}
              >
                {current.label}
              </h1>
              <p
                className={cn(
                  'mt-1 text-sm',
                  section === 'model-settings'
                    ? 'leading-[22px] text-[#81858c] dark:text-[#979da6]'
                    : 'text-muted-foreground'
                )}
              >
                {current.description}
              </p>
            </header>

            {!ready ? (
              <div className="text-xs text-muted-foreground">加载配置中...</div>
            ) : section === 'general' ? (
              <GeneralSettingsSection />
            ) : section === 'paths' ? (
              <div className="flex flex-col gap-4">
                <DataDirectorySection />
                <PathsSection />
                <ExtraCdbSection />
              </div>
            ) : section === 'duel-test' ? (
              <DuelTestSection />
            ) : section === 'web-search' ? (
              <WebSearchSection />
            ) : (
              <ModelSettingsSection />
            )}
          </div>
        </ScrollArea>
      </div>

      <GameLanguageDialog />
    </div>
  )
}
