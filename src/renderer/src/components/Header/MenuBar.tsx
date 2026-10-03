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
  Sun,
  Moon,
  Database,
  Folder,
  Keyboard,
  Info,
  Check,
  Coffee
} from 'lucide-react'
import wechatQr from '../../REMOVED'
import alipayQr from '../../REMOVED'
import { useDuelStore } from '../../stores/useDuelStore'
import { useConfigStore } from '../../stores/useConfigStore'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface MenuBarProps {
  onNew: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onImportLua: () => void
  onExportLua: () => void
}

interface MenuItemDef {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  shortcut?: string
  action?: () => void
  disabled?: boolean
  checked?: boolean
  separator?: boolean
}

interface MenuDef {
  id: string
  label: string
  items: MenuItemDef[]
}

/**
 * 桌面风格下拉菜单栏（文件 / 编辑 / 设置 / 帮助）。
 * 纯菜单 UI 组件：文件类命令由 Header 通过 props 注入，避免两处重复实现。
 */
export const MenuBar: React.FC<MenuBarProps> = ({
  onNew,
  onOpenProject,
  onSaveProject,
  onImportLua,
  onExportLua
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [showSupportDialog, setShowSupportDialog] = useState(false)
  const menuBarRef = useRef<HTMLDivElement>(null)

  const { resetDuel, swapSides } = useDuelStore()
  // temporal 经 useStore 包装成响应式订阅，撤销/重做可用状态随历史变化实时更新
  const { undo, redo, pastStates, futureStates } = useStore(useDuelStore.temporal)
  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  const { config, selectCdbFile, selectGameDir, setTheme } = useConfigStore()
  const isDark = config.theme !== 'light'

  // 点击外部 / Esc 关闭菜单
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
          label: '打开工程 (.ygoduel)',
          icon: FolderOpen,
          shortcut: 'Ctrl+O',
          action: onOpenProject
        },
        {
          label: '保存工程 (.ygoduel)',
          icon: Save,
          shortcut: 'Ctrl+S',
          action: onSaveProject
        },
        { label: '', separator: true },
        {
          label: '导入 Lua 脚本 (.lua)',
          icon: Upload,
          shortcut: 'Ctrl+I',
          action: onImportLua
        },
        {
          label: '导出 Lua 脚本 (.lua)',
          icon: Download,
          shortcut: 'Ctrl+E',
          action: onExportLua
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
          label: '翻转双方场地 (对阵互换)',
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
      id: 'settings',
      label: '设置',
      items: [
        {
          label: '浅色模式',
          icon: Sun,
          checked: !isDark,
          action: () => setTheme('light')
        },
        {
          label: '深色模式',
          icon: Moon,
          checked: isDark,
          action: () => setTheme('dark')
        },
        { label: '', separator: true },
        {
          label: config.cdbPath ? '更换 cards.cdb 数据库...' : '加载 cards.cdb 数据库...',
          icon: Database,
          action: () => selectCdbFile()
        },
        {
          label: '设置 YGOPro 游戏目录 (本地卡图)...',
          icon: Folder,
          action: () => selectGameDir()
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
                  // 已有展开菜单时，滑过即切换（桌面菜单栏惯例）
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
                            <span className="w-3.5 h-3.5 flex items-center justify-center">
                              {item.checked && <Check className="w-3.5 h-3.5" />}
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

      {/* 快捷键参考弹窗 */}
      {showShortcutsDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-popover text-popover-foreground border border-border rounded-md shadow-xl max-w-md w-full p-5 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-muted-foreground" />
                快捷键参考
              </h3>
              <button
                type="button"
                onClick={() => setShowShortcutsDialog(false)}
                className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded hover:bg-muted"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 text-xs">
              {[
                ['新建局面', 'Ctrl + N'],
                ['打开工程', 'Ctrl + O'],
                ['保存工程', 'Ctrl + S'],
                ['导入 Lua', 'Ctrl + I'],
                ['导出 Lua', 'Ctrl + E'],
                ['撤销', 'Ctrl + Z'],
                ['重做', 'Ctrl + Y / Ctrl + Shift + Z'],
                ['删除卡片', 'Delete / Del'],
                ['超量叠放', 'Alt + 拖放']
              ].map(([name, key]) => (
                <div key={name} className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{name}</span>
                  <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">{key}</kbd>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-xs pt-1">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">删除卡片</span>
                <span>鼠标指向卡片或选中卡片时按 Delete / Del 直接删除（可撤销）</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">摆卡 / 移动</span>
                <span>从搜索列表拖拽至格；场上卡拖到另一格即移动</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Alt + 拖放</span>
                <span>拖拽至怪兽格进行超量素材叠放（超量怪兽置顶，素材垫在下方）</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">超量素材管理</span>
                <span>双击怪兽卡直接查看素材列表；亦可点击右下角 ● 徽标或右键菜单管理</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Ctrl + 拖放</span>
                <span>切换默认放置状态：魔陷直接发动 / 怪兽盖守 / 手牌公开 / 额外表侧</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">双击堆叠格</span>
                <span>直接查看列表（额外/卡组/墓地/除外）并支持重排与做场</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">卡片右键菜单</span>
                <span>切换表里侧 / 攻守表示 / 编辑超量素材 / 查看列表</span>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={() => setShowShortcutsDialog(false)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 关于弹窗 */}
      {showAboutDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-popover text-popover-foreground border border-border rounded-md shadow-xl max-w-sm w-full p-5 space-y-3 animate-in fade-in">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center mx-auto">
                <Info className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-base pt-1">YGO Duel Editor</h3>
              <p className="text-xs text-muted-foreground">版本 1.0.0</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              游戏王决斗创作工作台：可视化布设对局场面，导入导出符合 ocgcore 标准的 Lua
              决斗脚本，支持同人剧情对局编排、卡组 Combo 教学与残局制作。
            </p>
            <div className="space-y-1.5 text-xs border-t border-border pt-3">
              {[
                ['作者', '知兀', null],
                ['邮箱', 'zhiwu_215@qq.com', 'mailto:zhiwu_215@qq.com'],
                [
                  'B 站',
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
                    <span className="truncate">{text}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-1">
              <Button size="sm" onClick={() => setShowAboutDialog(false)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 支持作者弹窗 */}
      {showSupportDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-popover text-popover-foreground border border-border rounded-md shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Coffee className="w-4 h-4 text-muted-foreground" />
                支持作者
              </h3>
              <button
                type="button"
                onClick={() => setShowSupportDialog(false)}
                className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded hover:bg-muted"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              如果 YGO Duel Editor 对你有帮助，欢迎请作者喝杯咖啡 ☕
            </p>
            <div className="flex items-start justify-center gap-6">
              {[
                { src: wechatQr, label: '微信支付' },
                { src: alipayQr, label: '支付宝' }
              ].map(({ src, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <img
                    src={src}
                    alt={`${label}收款码`}
                    className="h-60 w-auto rounded border border-border bg-white object-contain"
                    draggable={false}
                  />
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-1">
              <Button size="sm" onClick={() => setShowSupportDialog(false)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
