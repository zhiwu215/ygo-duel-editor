import { useEffect, useMemo, useRef, useState, type JSX, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useAgentStore } from '../../stores/useAgentStore'
import { AgentProviderModelConfig, isProviderReady } from '@shared/index'
import { ScrollArea } from '../ui/scroll-area'
import { cn } from '../../lib/utils'

const MANAGE_KEY = 'action:manage'

interface MenuProvider {
  id: string
  name: string
  ready: boolean
  models: AgentProviderModelConfig[]
}

interface ModelPickerMenuProps {
  toolbarRef: RefObject<HTMLDivElement | null>
}

export function ModelPickerMenu({ toolbarRef }: ModelPickerMenuProps): JSX.Element {
  const config = useAgentStore((s) => s.config)
  const selectModel = useAgentStore((s) => s.selectModel)

  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [openProviderKey, setOpenProviderKey] = useState<string | null>(null)
  const [modelMenuPos, setModelMenuPos] = useState<{ right: number; bottom: number } | null>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)

  const providers = useMemo(() => config.providers ?? [], [config.providers])
  const activeProvider = useMemo(
    () => providers.find((p) => p.id === config.provider) ?? null,
    [providers, config.provider]
  )
  const activeModel = useMemo(
    () => activeProvider?.models.find((m) => m.id === config.model) ?? null,
    [activeProvider, config.model]
  )

  const chipLabel = activeProvider
    ? `${activeProvider.name}/${activeModel?.name ?? config.model}`
    : config.model || '未配置模型'

  const menuProviders = useMemo(
    (): MenuProvider[] =>
      providers
        .filter((p) => p.enabled !== false && p.models.some((m) => m.enabled))
        .map((p) => ({
          id: p.id,
          name: p.name,
          ready: isProviderReady(p),
          models: p.models.filter((m) => m.enabled)
        })),
    [providers]
  )

  const openProviderModels = useMemo(
    () => menuProviders.find((p) => p.id === openProviderKey)?.models ?? [],
    [menuProviders, openProviderKey]
  )

  useEffect(() => {
    if (!modelMenuOpen) return
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node

      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(target) &&
        !modelMenuRef.current?.contains(target)
      ) {
        setModelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [modelMenuOpen, toolbarRef])

  const openMenu = (): void => {
    const anchor = toolbarRef.current
    if (anchor) {
      const rect = anchor.getBoundingClientRect()
      setModelMenuPos({
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.top
      })
    }
    setOpenProviderKey(null)
    setModelMenuOpen(true)
  }

  const closeMenu = (): void => {
    setModelMenuOpen(false)
    setOpenProviderKey(null)
  }

  const pickModel = (providerId: string, modelId: string): void => {
    selectModel(providerId, modelId)
    closeMenu()
  }

  const openManage = (): void => {
    closeMenu()
    void window.api.openSettingsWindow('model-settings')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (modelMenuOpen ? closeMenu() : openMenu())}
        className={cn(
          'h-6 w-full min-w-0 px-1.5 rounded flex items-center gap-1 text-[11px] transition-colors',
          modelMenuOpen
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        )}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            activeProvider && isProviderReady(activeProvider)
              ? 'bg-emerald-500'
              : 'bg-muted-foreground'
          )}
        />
        <span className="font-medium truncate min-w-0">{chipLabel}</span>
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
      </button>

      {modelMenuOpen &&
        modelMenuPos &&
        createPortal(
          <div
            ref={modelMenuRef}
            style={{ right: modelMenuPos.right, bottom: modelMenuPos.bottom }}
            className="fixed z-[70] mb-1 w-52 max-w-[calc(100vw-1.5rem)]"
          >
            <div className="bg-popover border border-border rounded-md overflow-hidden shadow-lg py-1">
              {menuProviders.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-muted-foreground leading-4">
                  尚未配置可用模型，去「管理模型」连接供应商并拉取
                </div>
              ) : (
                menuProviders.map((provider) => {
                  const isCurrent = provider.id === config.provider
                  const open = openProviderKey === provider.id
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onMouseEnter={() => setOpenProviderKey(provider.id)}
                      onClick={() => setOpenProviderKey(provider.id)}
                      className={cn(
                        'w-full px-2.5 py-1.5 flex items-center gap-2 text-left transition-colors',
                        open && 'bg-muted/60'
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          provider.ready ? 'bg-emerald-500' : 'bg-muted-foreground'
                        )}
                      />
                      <span className="flex-1 min-w-0 truncate text-[11px] font-medium">
                        {provider.name}
                      </span>
                      {isCurrent && <Check className="w-3 h-3 text-foreground shrink-0" />}
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    </button>
                  )
                })
              )}

              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onMouseEnter={() => setOpenProviderKey(MANAGE_KEY)}
                onClick={openManage}
                className={cn(
                  'w-full px-2.5 py-1.5 flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors',
                  openProviderKey === MANAGE_KEY && 'bg-muted/60'
                )}
              >
                <span className="flex-1 text-left">管理模型</span>
              </button>
            </div>

            {openProviderKey && openProviderKey !== MANAGE_KEY && (
              <ScrollArea className="absolute bottom-0 left-full ml-0.5 w-52 max-w-[calc(100vw-2rem)] max-h-72 bg-popover border border-border rounded-md shadow-lg">
                <div className="py-1">
                  {openProviderModels.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-muted-foreground leading-4">
                      该供应商暂无可用模型，去「管理模型」拉取后即可选用
                    </div>
                  ) : (
                    openProviderModels.map((model) => {
                      const isCurrent =
                        openProviderKey === config.provider && config.model === model.id
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => pickModel(openProviderKey, model.id)}
                          className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-muted/60 transition-colors"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-[11px] font-medium truncate">
                              {model.name ?? model.id}
                            </span>
                            <span className="block font-mono text-[10px] text-muted-foreground truncate">
                              {model.id}
                            </span>
                          </span>
                          {model.supportsReasoning && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                              推理
                            </span>
                          )}
                          {isCurrent && <Check className="w-3 h-3 text-foreground shrink-0" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
