import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import React, { useState, useRef, useEffect } from 'react'
import { useStore } from 'zustand'
import {
  FilePlus,
  FolderOpen,
  Save,
  Upload,
  Download,
  Undo2,
  Redo2,
  RotateCcw,
  ArrowLeftRight,
  Keyboard,
  Info,
  Coffee,
  FileText,
  FolderKanban,
  BookOpen,
  BookMarked,
  SquareStack,
  Check,
  Copy,
  X
} from 'lucide-react'
import appIcon from '../../assets/app-icon.png'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { useDuelStore } from '../../stores/useDuelStore'
import { cn } from '../../lib/utils'

const AUTHOR_AFDIAN_URL = 'https://afdian.com/a/zhiwu215'

interface MenuBarProps {
  onNew: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onImportLua: () => void
  onExportLua: () => void
  onExportScreenplay?: () => void
}

interface MenuItemDef {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  shortcut?: string
  action?: () => void
  disabled?: boolean
  separator?: boolean

  checked?: boolean
}

interface MenuDef {
  id: string
  label: string
  items: MenuItemDef[]
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onNew,
  onOpenProject,
  onSaveProject,
  onImportLua,
  onExportLua,
  onExportScreenplay
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [showSupportDialog, setShowSupportDialog] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const menuBarRef = useRef<HTMLDivElement>(null)

  const handleCopyField = async (field: string, text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    } catch (err) {
      console.error('[MenuBar] Failed to copy field:', err)
    }
  }

  const {
    resetDuel,
    swapSides,
    setActiveLeftTab,
    tacticalView,
    toggleTacticalView,
    openScreenplayWithStep
  } = useDuelStore()

  const { undo, redo, pastStates, futureStates } = useStore(useDuelStore.temporal)
  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent): void => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenuId(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const menus: MenuDef[] = [
    {
      id: 'file',
      label: '文件',
      items: [
        {
          label: '新建局面',
          icon: FilePlus,
          shortcut: 'Ctrl+N',
          action: onNew
        },
        {
          label: '打开工程',
          icon: FolderOpen,
          shortcut: 'Ctrl+O',
          action: onOpenProject
        },
        {
          label: '决斗档案库',
          icon: FolderKanban,
          action: () => setActiveLeftTab('archives')
        },
        {
          label: '保存工程',
          icon: Save,
          shortcut: 'Ctrl+S',
          action: onSaveProject
        },
        { label: '', separator: true },
        {
          label: '导入 Lua 脚本',
          icon: Upload,
          shortcut: 'Ctrl+I',
          action: onImportLua
        },
        {
          label: '导出 Lua 脚本',
          icon: Download,
          shortcut: 'Ctrl+E',
          action: onExportLua
        },
        {
          label: '导出同人剧本台本',
          icon: FileText,
          action: onExportScreenplay
        }
      ]
    },
    {
      id: 'edit',
      label: '编辑',
      items: [
        {
          label: '撤销',
          icon: Undo2,
          shortcut: 'Ctrl+Z',
          disabled: !canUndo,
          action: () => undo()
        },
        {
          label: '重做',
          icon: Redo2,
          shortcut: 'Ctrl+Y',
          disabled: !canRedo,
          action: () => redo()
        },
        { label: '', separator: true },
        {
          label: '翻转双方场地',
          icon: ArrowLeftRight,
          action: () => swapSides()
        },
        {
          label: '清空重置局面',
          icon: RotateCcw,
          action: () => {
            if (confirm('确定清空当前场面上所有摆放的卡片吗？')) {
              resetDuel()
            }
          }
        }
      ]
    },
    {
      id: 'view',
      label: '查看',
      items: [
        {
          label: '战术透视',
          shortcut: 'Tab',
          checked: tacticalView,
          action: () => toggleTacticalView()
        },
        { label: '', separator: true },
        {
          label: '决斗台本',
          icon: BookOpen,
          action: () => openScreenplayWithStep()
        },
        {
          label: '卡组编辑器',
          icon: SquareStack,
          action: () => window.api.openDeckEditor()
        },
        {
          label: '卡牌图鉴',
          icon: BookMarked,
          action: () => window.api.openCardNoteWindow()
        }
      ]
    },
    {
      id: 'help',
      label: '帮助',
      items: [
        {
          label: '快捷键参考',
          icon: Keyboard,
          action: () => setShowShortcutsDialog(true)
        },
        {
          label: '支持作者',
          icon: Coffee,
          action: () => setShowSupportDialog(true)
        },
        {
          label: '关于 YGO Duel Editor',
          icon: Info,
          action: () => setShowAboutDialog(true)
        }
      ]
    }
  ]

  return (
    <>
      <div ref={menuBarRef} className="flex items-center gap-0.5 select-none relative">
        {menus.map((menu) => {
          const isOpen = activeMenuId === menu.id
          return (
            <div key={menu.id} className="relative">
              <button
                type="button"
                onClick={() => setActiveMenuId(isOpen ? null : menu.id)}
                onMouseEnter={() => {
                  if (activeMenuId !== null && !isOpen) {
                    setActiveMenuId(menu.id)
                  }
                }}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md transition-colors',
                  isOpen
                    ? 'bg-foreground/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {menu.label}
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full mt-1 min-w-[220px] bg-popover text-popover-foreground rounded-md shadow-lg border border-border p-1 z-50 text-xs animate-in fade-in-50">
                  {menu.items.map((item, idx) => {
                    if (item.separator) {
                      return <div key={`sep-${idx}`} className="h-px bg-border my-1" />
                    }
                    const Icon = item.icon
                    return (
                      <button
                        key={item.label}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => {
                          setActiveMenuId(null)
                          item.action?.()
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted text-left transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <div className="flex items-center gap-2">
                          {item.checked !== undefined ? (
                            <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                              {item.checked && <Check className="w-3.5 h-3.5 text-primary" />}
                            </span>
                          ) : (
                            Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <span>{item.label}</span>
                        </div>
                        {item.shortcut && (
                          <span className="text-[10px] text-muted-foreground/70 font-mono ml-4 tracking-tight">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showShortcutsDialog && (
        <Dialog open onOpenChange={(open) => !open && setShowShortcutsDialog(false)}>
          <DialogContent showCloseButton={false} className="max-w-md space-y-3 p-5">
            <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border pb-2.5">
              <DialogTitle className="flex items-center gap-2 font-semibold text-sm">
                <Keyboard className="w-4 h-4 text-muted-foreground" />
                快捷键参考
              </DialogTitle>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setShowShortcutsDialog(false)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  }
                />
                <TooltipContent>关闭</TooltipContent>
              </Tooltip>
            </DialogHeader>
            <div className="space-y-1 text-xs">
              {[
                ['删除卡片', 'Delete / Del'],
                ['超量叠放', 'Alt + 拖放'],
                ['战术透视', 'Tab'],
                ['攻守与指示物', 'Shift + 鼠标左键'],
                ['双击卡堆', '查看卡组列表（额外/卡组/墓地/除外）'],
                ['切换默认放置状态', 'Ctrl + 拖放']
              ].map(([name, key]) => (
                <div key={name} className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{name}</span>
                  <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">{key}</kbd>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showAboutDialog && (
        <Dialog open onOpenChange={(open) => !open && setShowAboutDialog(false)}>
          <DialogContent showCloseButton={false} className="max-w-sm space-y-3 p-5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => setShowAboutDialog(false)}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                }
              />
              <TooltipContent>关闭</TooltipContent>
            </Tooltip>

            <div className="text-center space-y-1">
              <img
                src={appIcon}
                alt=""
                aria-hidden="true"
                className="w-10 h-10 mx-auto rounded-md object-cover"
                draggable={false}
              />
              <h3 className="font-semibold text-base pt-1">YGO Duel Editor</h3>
              <p className="text-xs text-muted-foreground">版本 1.0.0</p>
            </div>
            <div className="space-y-1.5 text-xs border-t border-border pt-3">
              {[
                ['作者', '知兀', null],
                ['邮箱', 'zhiwu_215@qq.com', null],
                [
                  'B站',
                  'space.bilibili.com/3546704263514722',
                  'https://space.bilibili.com/3546704263514722'
                ],
                [
                  '项目地址',
                  'github.com/zhiwu215/ygo-duel-editor',
                  'https://github.com/zhiwu215/ygo-duel-editor'
                ]
              ].map(([label, text, href]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                      title={text ?? undefined}
                    >
                      {text}
                    </a>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => void handleCopyField(label!, text!)}
                            className="group flex items-center gap-1.5 truncate hover:text-foreground transition-colors"
                          >
                            <span className="truncate">{text}</span>
                            {copiedField === label ? (
                              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />
                            )}
                          </button>
                        }
                      />
                      <TooltipContent>点击复制</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showSupportDialog && (
        <Dialog open onOpenChange={(open) => !open && setShowSupportDialog(false)}>
          <DialogContent showCloseButton={false} className="max-w-sm space-y-4 p-5">
            <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border pb-2.5">
              <DialogTitle className="flex items-center gap-2 font-semibold text-sm">
                <Coffee className="w-4 h-4 text-muted-foreground" />
                支持作者
              </DialogTitle>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => setShowSupportDialog(false)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  }
                />
                <TooltipContent>关闭</TooltipContent>
              </Tooltip>
            </DialogHeader>

            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              如果 YGO Duel Editor 对你有帮助，欢迎请作者喝杯咖啡
            </p>

            <p className="text-[11px] text-muted-foreground/90 leading-relaxed text-center px-1 py-1.5 rounded-md bg-muted/50 border border-border/60">
              全部功能免费开放，赞助仅作自愿支持，不影响任何功能
            </p>

            <Button
              onClick={() => {
                setShowSupportDialog(false)
                void window.api.openExternal(AUTHOR_AFDIAN_URL)
              }}
              className="w-full"
            >
              <span>打开爱发电主页</span>
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
