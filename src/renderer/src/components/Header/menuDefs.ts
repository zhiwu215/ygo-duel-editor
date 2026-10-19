import type { ComponentType } from 'react'
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
  Library,
  Play,
  Clapperboard,
  ShieldCheck
} from 'lucide-react'

interface MenuItemDef {
  label: string
  icon?: ComponentType<{ className?: string }>
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

export interface MenuActions {
  onNew: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onSaveProjectAs: () => void
  onTestInYgo: () => void
  onImportLua: () => void
  onExportLua: () => void
  onExportYrp: () => void
  onImportReplay: () => void
  onExportScreenplay?: () => void
  onExportSession: () => void
  onImportSession: () => void

  isEngineActive: boolean
  onToggleEngine: () => void

  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void

  onSwapSides: () => void
  onResetDuel: () => void

  tacticalView: boolean
  onToggleTacticalView: () => void
  onOpenArchives: () => void
  onOpenScreenplay: () => void

  onShowShortcutsDialog: () => void
  onShowAboutDialog: () => void
  onShowSupportDialog: () => void
}

export function buildMenus(actions: MenuActions): MenuDef[] {
  return [
    {
      id: 'file',
      label: '文件',
      items: [
        {
          label: '新建局面',
          icon: FilePlus,
          shortcut: 'Ctrl+N',
          action: actions.onNew
        },
        {
          label: '打开工程',
          icon: FolderOpen,
          shortcut: 'Ctrl+O',
          action: actions.onOpenProject
        },
        {
          label: '决斗档案库',
          icon: FolderKanban,
          action: actions.onOpenArchives
        },
        {
          label: '保存工程',
          icon: Save,
          shortcut: 'Ctrl+S',
          action: actions.onSaveProject
        },
        {
          label: '另存为...',
          shortcut: 'Ctrl+Alt+S',
          action: actions.onSaveProjectAs
        },
        { label: '', separator: true },
        {
          label: '使用 ygo 测试该局',
          icon: Play,
          shortcut: 'Ctrl+T',
          action: actions.onTestInYgo
        },
        {
          label: actions.isEngineActive ? '退出规则校验' : '启动规则校验 (ocgcore)',
          icon: ShieldCheck,
          action: actions.onToggleEngine
        },
        {
          label: '导入 Lua 脚本',
          icon: Upload,
          shortcut: 'Ctrl+I',
          action: actions.onImportLua
        },
        {
          label: '导出 Lua 脚本',
          icon: Download,
          shortcut: 'Ctrl+E',
          action: actions.onExportLua
        },
        {
          label: '导出 YRP 录像',
          icon: Clapperboard,
          action: actions.onExportYrp
        },
        {
          label: '导入 YRP 回放...',
          icon: Upload,
          action: actions.onImportReplay
        },
        {
          label: '导出同人剧本台本',
          icon: FileText,
          action: actions.onExportScreenplay
        },
        { label: '', separator: true },
        {
          label: '导出对局剧本...',
          icon: Download,
          disabled: !actions.isEngineActive,
          action: actions.onExportSession
        },
        {
          label: '载入对局剧本...',
          icon: Upload,
          action: actions.onImportSession
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
          disabled: !actions.canUndo,
          action: actions.onUndo
        },
        {
          label: '重做',
          icon: Redo2,
          shortcut: 'Ctrl+Y',
          disabled: !actions.canRedo,
          action: actions.onRedo
        },
        { label: '', separator: true },
        {
          label: '翻转双方场地',
          icon: ArrowLeftRight,
          disabled: actions.isEngineActive,
          action: actions.onSwapSides
        },
        {
          label: '清空重置局面',
          icon: RotateCcw,
          disabled: actions.isEngineActive,
          action: actions.onResetDuel
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
          checked: actions.tacticalView,
          action: actions.onToggleTacticalView
        },
        { label: '', separator: true },
        {
          label: '决斗台本',
          icon: BookOpen,
          action: actions.onOpenScreenplay
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
        },
        {
          label: '文本素材库',
          icon: Library,
          action: () => void window.api.openTextLibrary()
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
          action: actions.onShowShortcutsDialog
        },
        {
          label: '支持作者',
          icon: Coffee,
          action: actions.onShowSupportDialog
        },
        {
          label: '关于 YGO Duel Editor',
          icon: Info,
          action: actions.onShowAboutDialog
        }
      ]
    }
  ]
}
